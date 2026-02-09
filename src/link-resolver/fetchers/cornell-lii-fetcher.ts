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
        // Strategy: extract <body>, remove non-content elements, strip HTML,
        // then find the statute text between known start/end markers.

        let content = html;

        // Try to isolate <body> content
        const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
        if (bodyMatch) {
            content = bodyMatch[1];
        }

        // Remove non-content elements
        content = content
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<nav[\s\S]*?<\/nav>/gi, "")
            .replace(/<header[\s\S]*?<\/header>/gi, "")
            .replace(/<footer[\s\S]*?<\/footer>/gi, "")
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
            .replace(/<form[\s\S]*?<\/form>/gi, "")
            .replace(/<img[^>]*>/gi, "");

        const text = this.stripHtml(content);

        // Find the statute content between known markers.
        // Cornell LII pages have a pattern like:
        //   "X U.S. Code § NNN - Title text"
        // followed by the actual statute, ending before:
        //   "U.S. Code Toolbox" or "Editorial Notes" or similar footer

        const cleaned = this.isolateStatuteBody(text);
        if (cleaned.length > 50) {
            return cleaned;
        }

        // Fallback: title + description meta
        const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
        const descMatch =
            /<meta[^>]*name="description"[^>]*content="([^"]*)"/.exec(html);
        const parts: string[] = [];
        if (titleMatch) parts.push(titleMatch[1].trim());
        if (descMatch) parts.push(descMatch[1].trim());
        return parts.join("\n\n") || "Content could not be extracted.";
    }

    /**
     * Find the actual statute text within the stripped page text.
     * Uses known start patterns (section title) and end patterns (toolbox, sidebar).
     */
    private isolateStatuteBody(text: string): string {
        // Start markers: look for the section title
        const startPatterns = [
            // "26 U.S. Code § 741 - Recognition and character..."
            /\d+\s+U\.?\s*S\.?\s*Code\s*§\s*\d+\w*\s*[-–—]\s*/i,
            // "§ 741. Recognition and character..."
            /§\s*\d+\w*\.\s+\w/,
            // "(a) " at start of subsection
            /\n\s*\(a\)\s/,
        ];

        let startIdx = -1;
        for (const pattern of startPatterns) {
            const match = pattern.exec(text);
            if (match && match.index < text.length * 0.6) {
                startIdx = match.index;
                break;
            }
        }

        if (startIdx < 0) {
            startIdx = 0;
        }

        let result = text.substring(startIdx);

        // End markers: trim at known footer/sidebar patterns
        const endPatterns = [
            /\n\s*U\.?\s*S\.?\s*Code\s+Toolbox/i,
            /\n\s*Law about\.\.\./i,
            /\n\s*Table of Popular Names/i,
            /\n\s*Parallel Table of Authorities/i,
            /\n\s*How\s+current is this/i,
            /\n\s*Please help us improve/i,
            /\n\s*Quick search by citation/i,
            /\n\s*Search Cornell/i,
            /\n\s*About LII/i,
            /\n\s*Accessibility/i,
        ];

        for (const pattern of endPatterns) {
            const match = pattern.exec(result);
            if (match) {
                result = result.substring(0, match.index);
            }
        }

        // Clean up navigation artifacts
        result = result
            .replace(/\bprev\s*\|\s*next\b/gi, "")
            .replace(/^\s*-\s*U\.?\s*S\.?\s*Code\s*-\s*Notes\s*/im, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        return result;
    }
}
