import { BaseFetcher } from "./base-fetcher";
import type { FetchResult, ParsedCitation } from "../types";
import { generateUSStatutePage } from "../page-templates";

export class CornellLiiFetcher extends BaseFetcher {
    constructor(delayMs: number) {
        // Enforce Cornell's 10-second crawl delay from robots.txt
        super(Math.max(delayMs, 10000));
    }

    async fetch(
        linkText: string,
        parsed: ParsedCitation
    ): Promise<FetchResult> {
        try {
            const url = this.buildUrl(linkText, parsed);
            if (!url) {
                return {
                    success: false,
                    title: linkText,
                    content: "",
                    source: "cornell-lii",
                    error: "Could not construct Cornell LII URL from citation",
                };
            }

            const response = await this.request(url);

            if (response.status === 404) {
                return {
                    success: false,
                    title: linkText,
                    content: "",
                    source: "cornell-lii",
                    error: `Statute not found at ${url}`,
                };
            }

            if (response.status !== 200) {
                throw new Error(
                    `Cornell LII error: HTTP ${response.status}`
                );
            }

            const html = response.text;
            const statuteText = this.extractStatuteText(html);

            const content = generateUSStatutePage({
                fullCitation: linkText,
                text: statuteText,
                sourceUrl: url,
            });

            return {
                success: true,
                title: linkText,
                content,
                source: "cornell-lii",
                sourceUrl: url,
            };
        } catch (error) {
            return {
                success: false,
                title: linkText,
                content: "",
                source: "cornell-lii",
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            };
        }
    }

    private buildUrl(
        linkText: string,
        parsed: ParsedCitation
    ): string | null {
        // IRC § X → 26 USC X
        const ircMatch = linkText.match(/I\.?R\.?C\.?\s*§\s*(\d+)/i);
        if (ircMatch) {
            return `https://www.law.cornell.edu/uscode/text/26/${ircMatch[1]}`;
        }

        // Treas. Reg. § X.Y → 26 CFR X.Y
        const tregMatch = linkText.match(
            /Treas\.?\s*Reg\.?\s*§\s*([\d.]+(?:-[\d]+)?)/i
        );
        if (tregMatch) {
            return `https://www.law.cornell.edu/cfr/text/26/section-${tregMatch[1]}`;
        }

        // Reg. § X.Y (shorthand) → 26 CFR X.Y
        const regMatch = linkText.match(
            /^Reg\.?\s*§\s*([\d.]+(?:-[\d]+)?)/i
        );
        if (regMatch) {
            return `https://www.law.cornell.edu/cfr/text/26/section-${regMatch[1]}`;
        }

        // USC: law.cornell.edu/uscode/text/{title}/{section}
        const uscMatch = linkText.match(
            /(\d+)\s*U\.?S\.?C\.?A?\.?\s*§?\s*(\d+\w*)/i
        );
        if (uscMatch) {
            return `https://www.law.cornell.edu/uscode/text/${uscMatch[1]}/${uscMatch[2]}`;
        }

        // CFR: law.cornell.edu/cfr/text/{title}/section-{section}
        const cfrMatch = linkText.match(
            /(\d+)\s*C\.?F\.?R\.?\s*§?\s*([\d.]+)/i
        );
        if (cfrMatch) {
            return `https://www.law.cornell.edu/cfr/text/${cfrMatch[1]}/section-${cfrMatch[2]}`;
        }

        // UCC: law.cornell.edu/ucc/{article}/{section}
        const uccMatch = linkText.match(
            /U\.?C\.?C\.?\s*§?\s*((\d+)-(\d+\w*))/i
        );
        if (uccMatch) {
            return `https://www.law.cornell.edu/ucc/${uccMatch[2]}/${uccMatch[1]}`;
        }

        // Fallback using parsed data
        if (parsed.title && parsed.section) {
            if (parsed.title === "26" && parsed.section.includes(".")) {
                return `https://www.law.cornell.edu/cfr/text/26/section-${parsed.section}`;
            }
            return `https://www.law.cornell.edu/uscode/text/${parsed.title}/${parsed.section}`;
        }

        return null;
    }

    private extractStatuteText(html: string): string {
        // Try multiple content selectors
        const patterns = [
            // Main content area for USC sections
            /<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*(?:sidebar|footer)/i,
            /<div[^>]*class="[^"]*field-items[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
            // Broader content area
            /<div[^>]*class="[^"]*tab-pane[^"]*active[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
            // Fallback: main tag
            /<main[^>]*>([\s\S]*?)<\/main>/i,
        ];

        for (const pattern of patterns) {
            const match = pattern.exec(html);
            if (match) {
                const text = this.stripHtml(match[1]);
                if (text.length > 50) return text;
            }
        }

        // Last fallback: extract title and og:description
        const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
        const descMatch =
            /<meta[^>]*name="description"[^>]*content="([^"]*)"/.exec(
                html
            );
        const parts: string[] = [];
        if (titleMatch) parts.push(titleMatch[1].trim());
        if (descMatch) parts.push(descMatch[1].trim());
        return parts.join("\n\n") || "Content could not be extracted.";
    }
}
