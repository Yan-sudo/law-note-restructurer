import { App, Notice, TFile } from "obsidian";
import type { LawNoteSettings } from "../types";
import type { FetchResult, UnresolvedLink } from "./types";
import { scanForUnresolvedLinks } from "./link-scanner";
import { LinkReviewModal } from "./link-review-modal";
import { ProgressModal } from "../ui/progress-modal";
import { ensureFolderExists, sanitizeFilename } from "../utils/vault-helpers";
import { BaseFetcher } from "./fetchers/base-fetcher";
import { CourtListenerFetcher } from "./fetchers/courtlistener-fetcher";
import { JustiaFetcher } from "./fetchers/justia-fetcher";
import { CornellLiiFetcher } from "./fetchers/cornell-lii-fetcher";
import { CnLawFetcher } from "./fetchers/cn-law-fetcher";
import { CnCaseFetcher } from "./fetchers/cn-case-fetcher";

export function runLinkResolver(
    app: App,
    settings: LawNoteSettings
): void {
    const scopeFolder =
        settings.resolverScanScope === "output-folder"
            ? settings.outputFolder
            : "";

    const unresolvedLinks = scanForUnresolvedLinks(app, scopeFolder);

    if (unresolvedLinks.length === 0) {
        new Notice("No unresolved links found! (未找到未解析的链接)");
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
        (selectedLinks) => resolveLinks(app, settings, selectedLinks),
        () => {} // onCancel: no-op
    ).open();
}

async function resolveLinks(
    app: App,
    settings: LawNoteSettings,
    links: UnresolvedLink[]
): Promise<void> {
    if (links.length === 0) {
        new Notice("No links selected for resolution.");
        return;
    }

    const outputFolder = settings.resolvedLinksFolder
        ? settings.resolvedLinksFolder
        : `${settings.outputFolder}/References`;

    await ensureFolderExists(app.vault, outputFolder);

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
                const safeName = sanitizeFilename(link.linkText);
                const path = `${outputFolder}/${safeName}.md`;

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
                    `Created: ${link.linkText} (${result.source})`
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

    new Notice(msg + ` Pages in ${outputFolder}/`);

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
            return new JustiaFetcher(delay).fetch(
                link.linkText,
                link.parsed
            );
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
