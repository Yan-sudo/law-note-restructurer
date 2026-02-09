import { App, Notice, TFile } from "obsidian";
import type { LawNoteSettings } from "../types";
import type { FetchResult, LinkCategory, UnresolvedLink } from "./types";
import { scanForUnresolvedLinks } from "./link-scanner";
import { LinkReviewModal } from "./link-review-modal";
import { ProgressModal } from "../ui/progress-modal";
import { CourseSelectModal, type CourseSelection } from "../ui/course-select-modal";
import { ensureFolderExists, sanitizeFilename } from "../utils/vault-helpers";
import { BaseFetcher } from "./fetchers/base-fetcher";
import { CourtListenerFetcher } from "./fetchers/courtlistener-fetcher";
import { JustiaFetcher } from "./fetchers/justia-fetcher";
import { CornellLiiFetcher } from "./fetchers/cornell-lii-fetcher";
import { CnLawFetcher } from "./fetchers/cn-law-fetcher";
import { CnCaseFetcher } from "./fetchers/cn-case-fetcher";
import { generateUSCaseStubPage } from "./page-templates";

export function runLinkResolver(
    app: App,
    settings: LawNoteSettings
): void {
    // Step 1: Course selection — determine base output folder
    selectCourse(app, settings.outputFolder).then((courseSelection) => {
        if (!courseSelection) return;

        const baseFolder = courseSelection.courseName
            ? `${settings.outputFolder}/${courseSelection.courseName}`
            : settings.outputFolder;

        const courseLabel = courseSelection.courseName || "(default folder)";
        new Notice(`Scanning "${courseLabel}" for unresolved links... (正在扫描 "${courseLabel}")`);

        // Step 2: Scan for unresolved links (scope to course folder)
        const scopeFolder =
            settings.resolverScanScope === "output-folder"
                ? baseFolder
                : "";

        const unresolvedLinks = scanForUnresolvedLinks(app, scopeFolder);

        if (unresolvedLinks.length === 0) {
            new Notice(
                `No unresolved links found in "${courseLabel}". All wikilinks resolve to existing pages. (在 "${courseLabel}" 中未找到未解析的链接，所有链接均已指向现有页面)`,
                6000
            );
            return;
        }

        // Filter out links that are clearly not legal references
        const classifiableLinks = unresolvedLinks.filter(
            (l) => l.category !== "unknown" || l.referenceCount >= 2
        );

        const linksToShow =
            classifiableLinks.length > 0 ? unresolvedLinks : unresolvedLinks;

        new LinkReviewModal(
            app,
            linksToShow,
            (selectedLinks) =>
                resolveLinks(app, settings, selectedLinks, baseFolder),
            () => {} // onCancel: no-op
        ).open();
    });
}

function selectCourse(
    app: App,
    outputFolder: string
): Promise<CourseSelection | null> {
    return new Promise((resolve) => {
        const modal = new CourseSelectModal(
            app,
            outputFolder,
            (selection) => resolve(selection),
            () => resolve(null)
        );
        modal.open();
    });
}

/**
 * Map link category to subfolder name within the course folder.
 */
function categorySubfolder(category: LinkCategory): string {
    switch (category) {
        case "us-case":
        case "cn-case":
            return "Cases";
        case "us-statute":
        case "cn-law":
            return "Regulations";
        default:
            return "References";
    }
}

async function resolveLinks(
    app: App,
    settings: LawNoteSettings,
    links: UnresolvedLink[],
    baseFolder: string
): Promise<void> {
    if (links.length === 0) {
        new Notice("No links selected for resolution.");
        return;
    }

    // Ensure all needed subfolders exist
    const neededSubfolders = new Set(
        links.map((l) => categorySubfolder(l.category))
    );
    for (const sub of neededSubfolders) {
        await ensureFolderExists(app.vault, `${baseFolder}/${sub}`);
    }

    const progressModal = new ProgressModal(app);
    progressModal.open();

    let cancelled = false;
    progressModal.onCancelClick(() => {
        cancelled = true;
    });

    const successes: string[] = [];
    const failures: Array<{ linkText: string; error: string }> = [];

    for (let i = 0; i < links.length; i++) {
        if (cancelled) break;

        const link = links[i];
        progressModal.setStep(
            `Resolving ${i + 1}/${links.length}: ${link.linkText}`
        );
        progressModal.setProgress(((i + 1) / links.length) * 100);

        try {
            const result = await fetchLink(link, settings);

            if (result.success) {
                const subfolder = categorySubfolder(link.category);
                const safeName = sanitizeFilename(link.linkText);
                const path = `${baseFolder}/${subfolder}/${safeName}.md`;

                const existing =
                    app.vault.getAbstractFileByPath(path);
                if (existing instanceof TFile) {
                    // Don't overwrite existing pages
                    successes.push(link.linkText);
                    progressModal.updatePreview(
                        `Skipped (page exists): ${link.linkText}`
                    );
                    continue;
                }

                await app.vault.create(path, result.content);
                successes.push(link.linkText);
                progressModal.updatePreview(
                    `Created: ${link.linkText} → ${subfolder}/ (${result.source})`
                );
            } else {
                failures.push({
                    linkText: link.linkText,
                    error: result.error || "Unknown error",
                });
                progressModal.updatePreview(
                    `Failed: ${link.linkText} — ${result.error}`
                );
            }
        } catch (error) {
            failures.push({
                linkText: link.linkText,
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            });
        }
    }

    progressModal.close();

    const msg = cancelled
        ? `Cancelled. Resolved ${successes.length}/${links.length} links.`
        : `Resolved ${successes.length}/${links.length} links. ${failures.length} failed.`;

    new Notice(msg + ` Pages in ${baseFolder}/`);

    if (failures.length > 0 && failures.length <= 5) {
        new Notice(
            `Failed: ${failures.map((f) => f.linkText).join(", ")}`,
            8000
        );
    }
}

async function fetchLink(
    link: UnresolvedLink,
    settings: LawNoteSettings
): Promise<FetchResult> {
    const delay = settings.resolverRequestDelayMs;

    switch (link.category) {
        case "us-case": {
            // Try CourtListener first if token is available
            if (settings.courtListenerApiToken) {
                const clResult = await new CourtListenerFetcher(
                    settings.courtListenerApiToken,
                    delay
                ).fetch(link.linkText, link.parsed);

                if (clResult.success) return clResult;
                console.warn(
                    `CourtListener failed for "${link.linkText}", trying Justia...`
                );
            }

            const justiaResult = await new JustiaFetcher(delay).fetch(
                link.linkText,
                link.parsed
            );
            if (justiaResult.success) return justiaResult;

            // Fallback: create stub page with search links
            console.warn(
                `Justia also failed for "${link.linkText}", creating stub page.`
            );
            return createUSCaseStub(link.linkText);
        }

        case "us-statute":
            return new CornellLiiFetcher(delay).fetch(
                link.linkText,
                link.parsed
            );

        case "cn-law":
            return new CnLawFetcher(delay).fetch(
                link.linkText,
                link.parsed
            );

        case "cn-case":
            return new CnCaseFetcher(delay).fetch(
                link.linkText,
                link.parsed
            );

        default:
            return {
                success: false,
                title: link.linkText,
                content: "",
                source: "none",
                error: `Cannot resolve link of unknown category: "${link.linkText}"`,
            };
    }
}

function createUSCaseStub(linkText: string): FetchResult {
    const q = encodeURIComponent(linkText);
    const searchLinks = [
        {
            label: "Google Scholar",
            url: `https://scholar.google.com/scholar?q=${q}&hl=en&as_sdt=4`,
        },
        {
            label: "CourtListener",
            url: `https://www.courtlistener.com/?q=${q}&type=o`,
        },
        {
            label: "Justia",
            url: `https://www.justia.com/search?q=${q}`,
        },
        {
            label: "Casetext",
            url: `https://casetext.com/search?q=${q}`,
        },
    ];

    const content = generateUSCaseStubPage({
        caseName: linkText,
        searchLinks,
    });

    return {
        success: true,
        title: linkText,
        content,
        source: "stub",
    };
}
