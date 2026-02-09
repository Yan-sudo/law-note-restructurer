import { App, Notice, TFile, Vault } from "obsidian";
import { GeminiClient } from "../ai/gemini-client";
import {
    generateCombinedPage,
    generateCasePageLocal,
} from "../generators/concept-page-generator";
import { generateMatrixPage } from "../generators/matrix-generator";
import { generateOutlinePage } from "../generators/outline-generator";
import { ProgressModal } from "../ui/progress-modal";
import type {
    ExtractedEntities,
    LawNoteSettings,
    LegalConcept,
    RelationshipMatrix,
} from "../types";
import { normalizeConceptName } from "../types";
import { ensureFolderExists, sanitizeFilename } from "../utils/vault-helpers";
import { parallelMap } from "../utils/parallel";
import { classifyLink } from "../link-resolver/link-classifier";
import { CornellLiiFetcher } from "../link-resolver/fetchers/cornell-lii-fetcher";
import { CnLawFetcher } from "../link-resolver/fetchers/cn-law-fetcher";
import { normalizeCitation } from "../utils/citation-normalizer";

// ============================================================
// Source section markers — invisible in Obsidian reading mode
// ============================================================

function makeSourceTag(sourceFiles: string[]): string {
    return `<!-- law-restructurer-begin: ${sourceFiles.join(", ")} -->`;
}

const SOURCE_END_TAG = "<!-- law-restructurer-end -->";

const SOURCE_SECTION_RE =
    /<!-- law-restructurer-begin: (.*?) -->\n?([\s\S]*?)\n?<!-- law-restructurer-end -->/g;

function wrapInSourceSection(body: string, sourceFiles: string[]): string {
    return `${makeSourceTag(sourceFiles)}\n${body}\n${SOURCE_END_TAG}`;
}

/**
 * Strip YAML frontmatter (---...---) from content.
 * Returns [frontmatter (including ---), bodyAfterFrontmatter].
 */
function splitFrontmatter(content: string): [string, string] {
    const match = content.match(/^(---[\s\S]*?---\n*)/);
    if (match) {
        return [match[1], content.slice(match[1].length)];
    }
    return ["", content];
}

// ============================================================
// Fuzzy page matching
// ============================================================

/**
 * Find an existing file in the vault whose name fuzzy-matches the given name.
 * Prefers matches inside the output folder.
 */
function findExistingPage(
    vault: Vault,
    name: string,
    outputFolder: string
): TFile | null {
    const normalizedTarget = normalizeConceptName(name);
    const mdFiles = vault.getMarkdownFiles();

    const outputPrefix = outputFolder + "/";
    let bestMatch: TFile | null = null;

    for (const file of mdFiles) {
        const normalizedFile = normalizeConceptName(file.basename);

        if (normalizedFile === normalizedTarget) {
            if (file.path.startsWith(outputPrefix)) {
                return file; // Prefer output folder match
            }
            if (!bestMatch) {
                bestMatch = file;
            }
        }
    }

    return bestMatch;
}

// ============================================================
// Smart create / update / append
// ============================================================

/**
 * Handles three scenarios for concept/case pages:
 *
 * 1. **No existing page** → create new file, body wrapped in source markers
 * 2. **Existing page, same sources** → replace the matching source section
 *    (user edits outside markers are preserved)
 * 3. **Existing page, different sources** → append a new source section
 */
async function createOrUpdateOrAppend(
    vault: Vault,
    path: string,
    content: string,
    appendMode: boolean,
    name: string,
    outputFolder: string,
    sourceFiles: string[]
): Promise<TFile> {
    if (appendMode) {
        const existing = findExistingPage(vault, name, outputFolder);
        if (existing) {
            const oldContent = await vault.read(existing);
            const [, newBody] = splitFrontmatter(content);
            const wrappedBody = wrapInSourceSection(newBody.trim(), sourceFiles);

            // Check if the existing page already has a section from any of the same sources
            let hasOverlap = false;
            let updatedContent = oldContent;

            // Collect all source sections
            const sections: Array<{ full: string; sources: string[] }> = [];
            let match: RegExpExecArray | null;
            const re = new RegExp(SOURCE_SECTION_RE.source, "g");
            while ((match = re.exec(oldContent)) !== null) {
                const existingSources = match[1].split(",").map((s) => s.trim());
                sections.push({ full: match[0], sources: existingSources });
            }

            for (const section of sections) {
                const overlap = sourceFiles.some((s) =>
                    section.sources.includes(s)
                );
                if (overlap) {
                    hasOverlap = true;
                    // Replace this section with the new content
                    updatedContent = updatedContent.replace(
                        section.full,
                        wrappedBody
                    );
                    break;
                }
            }

            if (!hasOverlap) {
                // New sources — append below existing content
                updatedContent =
                    oldContent + "\n\n---\n\n" + wrappedBody;
            }

            await vault.modify(existing, updatedContent);
            return existing;
        }
    }

    // No existing page or append mode is off — create / overwrite
    // Wrap the body in source markers so future runs can track it
    const [frontmatter, body] = splitFrontmatter(content);
    const markedContent =
        frontmatter + wrapInSourceSection(body.trim(), sourceFiles) + "\n";

    const existingFile = vault.getAbstractFileByPath(path);
    if (existingFile instanceof TFile) {
        await vault.modify(existingFile, markedContent);
        return existingFile;
    }
    return vault.create(path, markedContent);
}

// ============================================================
// Simple create-or-overwrite (for matrix, outline, dashboards)
// ============================================================

async function createOrOverwrite(
    vault: Vault,
    path: string,
    content: string
): Promise<TFile> {
    const existing = vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
        await vault.modify(existing, content);
        return existing;
    }
    return vault.create(path, content);
}

// ============================================================
// Main step 4
// ============================================================

export async function runStep4(
    app: App,
    settings: LawNoteSettings,
    entities: ExtractedEntities,
    matrix: RelationshipMatrix,
    outputFolderOverride?: string
): Promise<string[]> {
    const client = new GeminiClient(settings);
    const outputFolder = outputFolderOverride ?? settings.outputFolder;
    const generatedFiles: string[] = [];
    const failedPages: string[] = [];
    const sourceFiles = entities.metadata.sourceDocuments;
    const allGeneratedContent: string[] = [];
    const concurrency = settings.concurrency ?? 5;

    const progressModal = new ProgressModal(app);
    progressModal.open();
    progressModal.onCancelClick(() => client.abort());

    try {
        // Ensure output folders exist
        await ensureFolderExists(app.vault, `${outputFolder}/Concepts`);
        await ensureFolderExists(app.vault, `${outputFolder}/Cases`);
        await ensureFolderExists(app.vault, `${outputFolder}/Dashboards`);

        // Total: concepts (incl. dashboards) + cases + matrix + outline
        const totalSteps =
            entities.concepts.length +
            entities.cases.length +
            2; // matrix + outline
        let completedSteps = 0;

        // 1. Generate concept + dashboard pages in parallel (AI-powered, combined prompt)
        progressModal.setStep(
            `Step 4/4: Generating concept & dashboard pages (0/${entities.concepts.length})...`
        );

        const { errors: conceptErrors } = await parallelMap<LegalConcept, void>(
            entities.concepts,
            async (concept) => {
                const { conceptPage, dashboardPage } = await generateCombinedPage(
                    client,
                    settings,
                    concept,
                    entities,
                    matrix,
                    sourceFiles
                );

                // Write concept page
                const conceptPath = `${outputFolder}/Concepts/${sanitizeFilename(concept.name)}.md`;
                await createOrUpdateOrAppend(
                    app.vault,
                    conceptPath,
                    conceptPage,
                    settings.appendToExisting,
                    concept.name,
                    outputFolder,
                    sourceFiles
                );
                generatedFiles.push(conceptPath);
                allGeneratedContent.push(conceptPage);

                // Write dashboard page
                const dashPath = `${outputFolder}/Dashboards/${sanitizeFilename(concept.name)} Dashboard.md`;
                await createOrUpdateOrAppend(
                    app.vault,
                    dashPath,
                    dashboardPage,
                    settings.appendToExisting,
                    `${concept.name} Dashboard`,
                    outputFolder,
                    sourceFiles
                );
                generatedFiles.push(dashPath);
                allGeneratedContent.push(dashboardPage);
            },
            concurrency,
            200,
            (completed, total, concept) => {
                completedSteps++;
                progressModal.setStep(
                    `Step 4/4: Generating pages (${completed}/${total}): ${concept.name}`
                );
                progressModal.setProgress((completedSteps / totalSteps) * 100);
            },
            (_idx, concept, error) => {
                progressModal.addError(`[${concept.name}] ${error.message}`);
            }
        );

        // Collect failure names for summary
        for (const { index, error } of conceptErrors) {
            const name = entities.concepts[index].name;
            console.warn(`[law-restructurer] Failed: ${name}`, error.message);
            failedPages.push(name);
        }

        // 2. Generate case pages (local, no AI needed)
        for (const cas of entities.cases) {
            completedSteps++;
            progressModal.setStep(
                `Step 4/4: Generating case page: ${cas.name}`
            );
            progressModal.setProgress((completedSteps / totalSteps) * 100);

            const content = generateCasePageLocal(cas, entities, matrix);
            const path = `${outputFolder}/Cases/${sanitizeFilename(cas.name)}.md`;
            await createOrUpdateOrAppend(
                app.vault,
                path,
                content,
                settings.appendToExisting,
                cas.name,
                outputFolder,
                sourceFiles
            );
            generatedFiles.push(path);
        }

        // 3. Generate relationship matrix (local, always overwrite)
        completedSteps++;
        progressModal.setStep(
            `Step 4/4: Generating relationship matrix`
        );
        progressModal.setProgress((completedSteps / totalSteps) * 100);

        const matrixContent = generateMatrixPage(matrix, entities);
        const matrixPath = `${outputFolder}/Relationship Matrix.md`;
        await createOrOverwrite(app.vault, matrixPath, matrixContent);
        generatedFiles.push(matrixPath);

        // 4. Generate outline (AI-powered, supports append)
        completedSteps++;
        progressModal.setStep(
            `Step 4/4: Generating outline`
        );
        progressModal.setProgress((completedSteps / totalSteps) * 100);

        try {
            const outlineContent = await generateOutlinePage(
                client,
                settings,
                entities
            );
            const outlinePath = `${outputFolder}/Outline.md`;
            await createOrUpdateOrAppend(
                app.vault,
                outlinePath,
                outlineContent,
                settings.appendToExisting,
                "Outline",
                outputFolder,
                sourceFiles
            );
            generatedFiles.push(outlinePath);
            allGeneratedContent.push(outlineContent);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(`[law-restructurer] Failed to generate outline`, msg);
            failedPages.push("Outline");
            progressModal.addError(`[Outline] ${msg}`);
        }

        // 5. Create regulation/statute pages from wikilinks found in generated content
        const statuteLinks = extractStatuteLinks(allGeneratedContent);
        if (statuteLinks.length > 0) {
            await createRegulationPages(
                app, settings, statuteLinks, outputFolder, progressModal
            );
        }

        // Report results
        const summary = `Generated ${generatedFiles.length} files in ${outputFolder}/`;

        if (progressModal.hasErrors()) {
            // Keep modal open so user can see and copy errors
            progressModal.showStopped(
                `Done with ${failedPages.length} error(s) (完成，${failedPages.length} 个错误)`
            );
            progressModal.updatePreview(summary);
            // Wait for user to close
            await new Promise<void>((resolve) => {
                const origClose = progressModal.onClose.bind(progressModal);
                progressModal.onClose = () => { origClose(); resolve(); };
            });
        } else {
            progressModal.close();
            new Notice(summary);
        }

        // Open the outline file
        const outlinePath = `${outputFolder}/Outline.md`;
        const outlineFile = app.vault.getAbstractFileByPath(outlinePath);
        if (outlineFile instanceof TFile) {
            await app.workspace.getLeaf().openFile(outlineFile);
        }

        return generatedFiles;
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        progressModal.addError(`Generation failed:\n${errMsg}`);
        progressModal.showStopped("Generation Failed (生成失败)");
        // Wait for user to close
        await new Promise<void>((resolve) => {
            const origClose = progressModal.onClose.bind(progressModal);
            progressModal.onClose = () => { origClose(); resolve(); };
        });
        return generatedFiles;
    }
}

// ============================================================
// Regulation/Statute page creation
// ============================================================

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

function extractStatuteLinks(contents: string[]): string[] {
    const seenNormalized = new Map<string, string>(); // normalized → shortest raw

    for (const content of contents) {
        let match: RegExpExecArray | null;
        const re = new RegExp(WIKILINK_RE.source, "g");
        while ((match = re.exec(content)) !== null) {
            const linkTarget = match[1].trim();

            const { category } = classifyLink(linkTarget);
            if (category !== "us-statute" && category !== "cn-law") continue;

            const normalized = normalizeCitation(linkTarget);
            const existing = seenNormalized.get(normalized);
            if (!existing || linkTarget.length < existing.length) {
                seenNormalized.set(normalized, linkTarget);
            }
        }
    }
    return Array.from(seenNormalized.values());
}

function generateStatuteStubPage(linkText: string, liiUrl: string | null): string {
    const today = new Date().toISOString().slice(0, 10);
    const externalLinks = liiUrl
        ? `- [View on Cornell LII](${liiUrl})`
        : "- [Search on Cornell LII](https://www.law.cornell.edu/search)";

    return `---
tags:
  - law/statute
date: ${today}
generated-by: law-note-restructurer
---

# ${linkText}

## Text

*Content not yet fetched. Use "Resolve Unresolved Links" command or visit the link below.*

## External Links

${externalLinks}

## Notes

*Add your study notes here.*
`;
}

async function createRegulationPages(
    app: App,
    settings: LawNoteSettings,
    statuteLinks: string[],
    outputFolder: string,
    progressModal: ProgressModal
): Promise<void> {
    const regFolder = `${outputFolder}/Regulations`;
    await ensureFolderExists(app.vault, regFolder);

    const delay = settings.resolverRequestDelayMs;
    const cornellFetcher = new CornellLiiFetcher(delay);
    const cnLawFetcher = new CnLawFetcher(delay);

    for (let i = 0; i < statuteLinks.length; i++) {
        const linkText = statuteLinks[i];
        progressModal.setStep(
            `Creating regulation pages ${i + 1}/${statuteLinks.length}: ${linkText}`
        );
        progressModal.setProgress(((i + 1) / statuteLinks.length) * 100);

        const safeName = sanitizeFilename(linkText);
        const path = `${regFolder}/${safeName}.md`;

        // Skip if page already exists
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing instanceof TFile) continue;

        const { category, parsed } = classifyLink(linkText);

        try {
            let result;
            if (category === "us-statute") {
                result = await cornellFetcher.fetch(linkText, parsed);
            } else if (category === "cn-law") {
                result = await cnLawFetcher.fetch(linkText, parsed);
            }

            if (result?.success) {
                await app.vault.create(path, result.content);
            } else {
                // Create stub page with link to source
                const liiUrl = buildCornellUrl(linkText);
                await app.vault.create(path, generateStatuteStubPage(linkText, liiUrl));
            }
        } catch {
            // Fetching failed — create stub page
            const liiUrl = buildCornellUrl(linkText);
            await app.vault.create(path, generateStatuteStubPage(linkText, liiUrl));
        }
    }
}

function buildCornellUrl(linkText: string): string | null {
    // IRC § X → 26 USC X
    const ircMatch = linkText.match(/I\.?R\.?C\.?\s*§\s*(\d+)/i);
    if (ircMatch) {
        return `https://www.law.cornell.edu/uscode/text/26/${ircMatch[1]}`;
    }

    // Treas. Reg. § X or Reg. § X → 26 CFR X
    const tregMatch = linkText.match(/(?:Treas\.?\s*)?Reg\.?\s*§\s*([\d.]+(?:-[\d]+(?:\w+)?)?)/i);
    if (tregMatch) {
        return `https://www.law.cornell.edu/cfr/text/26/${tregMatch[1]}`;
    }

    // USC
    const uscMatch = linkText.match(/(\d+)\s*U\.?S\.?C\.?A?\.?\s*§?\s*(\d+\w*)/i);
    if (uscMatch) {
        return `https://www.law.cornell.edu/uscode/text/${uscMatch[1]}/${uscMatch[2]}`;
    }

    // CFR
    const cfrMatch = linkText.match(/(\d+)\s*C\.?F\.?R\.?\s*§?\s*([\d.]+(?:-[\d]+(?:\w+)?)?)/i);
    if (cfrMatch) {
        return `https://www.law.cornell.edu/cfr/text/${cfrMatch[1]}/${cfrMatch[2]}`;
    }

    return null;
}
