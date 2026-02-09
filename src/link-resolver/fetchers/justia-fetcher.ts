import { BaseFetcher } from "./base-fetcher";
import type { FetchResult, ParsedCitation } from "../types";
import { generateUSCasePage } from "../page-templates";

export class JustiaFetcher extends BaseFetcher {
    constructor(delayMs: number) {
        super(delayMs);
    }

    async fetch(
        linkText: string,
        parsed: ParsedCitation
    ): Promise<FetchResult> {
        try {
            // Step 1: Try direct URL construction from citation data
            let caseUrl = this.buildDirectUrl(linkText, parsed);

            // Step 2: If no direct URL, search Justia
            if (!caseUrl) {
                caseUrl = await this.searchCase(linkText);
            }

            if (!caseUrl) {
                return {
                    success: false,
                    title: linkText,
                    content: "",
                    source: "justia",
                    error: "No results found on Justia",
                };
            }

            // Step 3: Fetch case page
            const caseData = await this.fetchCasePage(caseUrl);

            // Validate we got actual case content, not a listing page
            if (!caseData.opinion && !caseData.court && !caseData.dateFiled) {
                return {
                    success: false,
                    title: linkText,
                    content: "",
                    source: "justia",
                    error: "Fetched page appears to be a listing, not a case",
                };
            }

            const content = generateUSCasePage({
                caseName: caseData.caseName || linkText,
                citation: caseData.citation,
                court: caseData.court,
                dateFiled: caseData.dateFiled,
                opinion: caseData.opinion,
                sourceUrl: caseUrl,
                source: "justia",
            });

            return {
                success: true,
                title: caseData.caseName || linkText,
                content,
                source: "justia",
                sourceUrl: caseUrl,
            };
        } catch (error) {
            return {
                success: false,
                title: linkText,
                content: "",
                source: "justia",
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            };
        }
    }

    /**
     * Construct a direct Justia URL from citation data.
     * Supreme Court: https://supreme.justia.com/cases/federal/us/{volume}/{page}/
     */
    private buildDirectUrl(
        linkText: string,
        parsed: ParsedCitation
    ): string | null {
        // Supreme Court: "XXX U.S. YYY"
        const usReportsMatch = linkText.match(
            /(\d+)\s+U\.?\s*S\.?\s+(\d+)/i
        );
        if (usReportsMatch) {
            return `https://supreme.justia.com/cases/federal/us/${usReportsMatch[1]}/${usReportsMatch[2]}/`;
        }

        // S. Ct. citations → Supreme Court
        const sCtMatch = linkText.match(
            /(\d+)\s+S\.\s*Ct\.\s+(\d+)/i
        );
        if (sCtMatch) {
            // Can't construct direct URL from S.Ct. citation, fall through to search
            return null;
        }

        // Use parsed volume/reporter if available
        if (parsed.volume && parsed.reporter) {
            const reporter = parsed.reporter.toLowerCase().replace(/\s+/g, "");
            if (reporter === "u.s." || reporter === "us") {
                return `https://supreme.justia.com/cases/federal/us/${parsed.volume}/${linkText.match(/\d+\s+U\.?\s*S\.?\s+(\d+)/i)?.[1] || "1"}/`;
            }
        }

        return null;
    }

    private async searchCase(query: string): Promise<string | null> {
        // Try Justia's general search
        const encodedQuery = encodeURIComponent(query);
        const searchUrls = [
            `https://www.justia.com/search?q=${encodedQuery}`,
            `https://law.justia.com/search?q=${encodedQuery}`,
        ];

        for (const searchUrl of searchUrls) {
            try {
                const response = await this.request(searchUrl);

                if (response.status !== 200) continue;

                const html = response.text;
                const found = this.extractCaseUrl(html);
                if (found) return found;
            } catch {
                // Try next search URL
            }
        }

        return null;
    }

    private extractCaseUrl(html: string): string | null {
        // Look for case law result links — must be specific case pages
        // Specific cases have patterns like:
        //   /cases/federal/us/347/483/  (Supreme Court)
        //   /cases/federal/appellate-courts/F2/825/1081/  (Federal appellate)
        //   /cases/federal/district-courts/...
        // But NOT directory pages like /cases/federal/appellate-courts/ (no trailing path)
        const caseUrlPatterns = [
            // Supreme Court cases: /cases/federal/us/{volume}/{page}/
            /href="(https:\/\/supreme\.justia\.com\/cases\/federal\/us\/\d+\/\d+\/[^"]*)"/,
            // Federal cases with volume/page: /cases/federal/.../F2/825/1081/
            /href="(https:\/\/law\.justia\.com\/cases\/federal\/(?:appellate-courts|district-courts)\/[^"]*\/\d+\/\d+\/[^"]*)"/,
            // State cases with year and identifier
            /href="(https:\/\/law\.justia\.com\/cases\/[^"]*\/\d{4}\/[^"]*)"/,
            // Any justia case URL with case-like path segments
            /href="(https:\/\/(?:supreme|law)\.justia\.com\/cases\/[^"]*\/\d+\/[^"]*\d+[^"]*)"/,
        ];

        for (const pattern of caseUrlPatterns) {
            const match = pattern.exec(html);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    private async fetchCasePage(url: string): Promise<{
        caseName: string;
        citation: string;
        court: string;
        dateFiled: string;
        opinion: string;
    }> {
        const response = await this.request(url);

        if (response.status !== 200) {
            throw new Error(
                `Failed to fetch Justia case page: HTTP ${response.status}`
            );
        }

        const html = response.text;

        const caseName = this.extractMeta(html, "og:title") ||
            this.extractTitle(html) ||
            "";

        const citation = this.extractBetween(
            html,
            'class="citation"',
            "</",
            ">"
        );

        const court = this.extractBetween(
            html,
            'class="court"',
            "</",
            ">"
        );

        const dateFiled = this.extractBetween(
            html,
            'class="date-filed"',
            "</",
            ">"
        ) || this.extractBetween(
            html,
            "Decided",
            "<",
            ""
        );

        // Extract opinion using subtraction approach (same as Cornell LII fix)
        const opinion = this.extractCaseBody(html);

        return { caseName, citation, court, dateFiled, opinion };
    }

    /**
     * Extract case body using subtraction approach:
     * take <body>, remove non-content, strip HTML.
     */
    private extractCaseBody(html: string): string {
        let content = html;

        // Try to isolate body
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
            .replace(/<div[^>]*(?:class|id)="[^"]*(?:sidebar|menu|nav|breadcrumb|footer|header|ad-|gpt-ad|share|social|cookie|banner|related)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
            .replace(/<form[\s\S]*?<\/form>/gi, "")
            .replace(/<img[^>]*>/gi, "");

        const text = this.stripHtml(content);

        // Try to find opinion start markers
        const opinionMarkers = [
            /\n\s*(?:OPINION|Opinion of the Court|PER CURIAM|MEMORANDUM OPINION)/,
            /\n\s*(?:MR\.|MS\.|JUSTICE|CHIEF JUSTICE)\s+\w+/,
            /\n\s*(?:delivered the opinion|wrote the opinion)/i,
        ];

        for (const marker of opinionMarkers) {
            const match = marker.exec(text);
            if (match && match.index < text.length * 0.6) {
                return text.substring(match.index).trim();
            }
        }

        // If text is reasonable length, return it
        if (text.length > 200) {
            return text;
        }

        // Fallback: meta description
        return this.extractMeta(html, "og:description") ||
            this.extractMeta(html, "description") ||
            "";
    }

    private extractMeta(html: string, property: string): string {
        const re = new RegExp(
            `<meta[^>]*(?:property|name)="${property}"[^>]*content="([^"]*)"`,
            "i"
        );
        const match = re.exec(html);
        return match ? match[1] : "";
    }

    private extractTitle(html: string): string {
        const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
        return match ? match[1].trim() : "";
    }

    private extractBetween(
        html: string,
        marker: string,
        endMarker: string,
        startAfter: string
    ): string {
        const idx = html.indexOf(marker);
        if (idx === -1) return "";
        const start = startAfter
            ? html.indexOf(startAfter, idx) + startAfter.length
            : idx + marker.length;
        if (start <= 0) return "";
        const end = html.indexOf(endMarker, start);
        if (end === -1) return "";
        return html.slice(start, end).trim();
    }
}
