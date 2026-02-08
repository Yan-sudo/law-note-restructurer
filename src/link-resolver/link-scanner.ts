import { App } from "obsidian";
import type { UnresolvedLink } from "./types";
import { classifyLink } from "./link-classifier";

/**
 * Scan markdown files for wikilinks that don't resolve to existing pages.
 * Uses Obsidian's internal unresolvedLinks cache when available,
 * falling back to manual regex scanning.
 */
export function scanForUnresolvedLinks(
    app: App,
    scopeFolder: string
): UnresolvedLink[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = app.metadataCache as any;
    const unresolvedMap =
        cache.unresolvedLinks as Record<string, Record<string, number>> | undefined;

    if (unresolvedMap) {
        return scanFromCache(unresolvedMap, scopeFolder);
    }

    return scanManually(app, scopeFolder);
}

function scanFromCache(
    unresolvedMap: Record<string, Record<string, number>>,
    scopeFolder: string
): UnresolvedLink[] {
    const result = new Map<string, UnresolvedLink>();

    for (const [filePath, links] of Object.entries(unresolvedMap)) {
        if (scopeFolder && !filePath.startsWith(scopeFolder)) continue;

        for (const [linkTarget, count] of Object.entries(links)) {
            const existing = result.get(linkTarget);
            if (existing) {
                existing.referenceCount += count;
                existing.referencedIn.push(filePath);
            } else {
                const { category, confidence, parsed } =
                    classifyLink(linkTarget);
                result.set(linkTarget, {
                    linkText: linkTarget,
                    referencedIn: [filePath],
                    referenceCount: count,
                    category,
                    confidence,
                    parsed,
                });
            }
        }
    }

    return Array.from(result.values()).sort(
        (a, b) => b.referenceCount - a.referenceCount
    );
}

function scanManually(app: App, scopeFolder: string): UnresolvedLink[] {
    const result = new Map<string, UnresolvedLink>();
    const mdFiles = app.vault.getMarkdownFiles();

    for (const file of mdFiles) {
        if (scopeFolder && !file.path.startsWith(scopeFolder)) continue;

        const cached = app.metadataCache.getFileCache(file);
        if (!cached?.links) continue;

        for (const link of cached.links) {
            const target = link.link;
            const resolved = app.metadataCache.getFirstLinkpathDest(
                target,
                file.path
            );
            if (resolved) continue;

            const existing = result.get(target);
            if (existing) {
                existing.referenceCount++;
                if (!existing.referencedIn.includes(file.path)) {
                    existing.referencedIn.push(file.path);
                }
            } else {
                const { category, confidence, parsed } =
                    classifyLink(target);
                result.set(target, {
                    linkText: target,
                    referencedIn: [file.path],
                    referenceCount: 1,
                    category,
                    confidence,
                    parsed,
                });
            }
        }
    }

    return Array.from(result.values()).sort(
        (a, b) => b.referenceCount - a.referenceCount
    );
}
