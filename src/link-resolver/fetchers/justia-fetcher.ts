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
            // Step 1: Search Justia
            const caseUrl = await this.searchCase(linkText);
            if (!caseUrl) {
                return {
                    success: false,
                    title: linkText,
                    content: "",
                    source: "justia",
                    error: "No results found on Justia",
                };
            }

            // Step 2: Fetch case page
            const caseData = await this.fetchCasePage(caseUrl);

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

    private async searchCase(query: string): Promise<string | null> {
        const url = `https://www.justia.com/search?q=${encodeURIComponent(query)}`;
        const response = await this.request(url);

        if (response.status !== 200) {
            throw new Error(`Justia search failed: HTTP ${response.status}`);
        }

        const html = response.text;

        // Look for case law result links
        // Justia search results contain links like:
        // https://supreme.justia.com/cases/federal/us/...
        // https://law.justia.com/cases/federal/...
        const caseUrlPatterns = [
            /href="(https:\/\/supreme\.justia\.com\/cases\/[^"]+)"/,
            /href="(https:\/\/law\.justia\.com\/cases\/[^"]+)"/,
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

        // Extract opinion text from case body
        let opinion = "";
        const bodyPatterns = [
            /<div[^>]*id="tab-opinion"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
            /<div[^>]*class="[^"]*case-body[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div|<\/section)/i,
            /<div[^>]*id="opinion"[^>]*>([\s\S]*?)<\/div>/i,
        ];

        for (const pattern of bodyPatterns) {
            const match = pattern.exec(html);
            if (match) {
                opinion = this.stripHtml(match[1]);
                break;
            }
        }

        // Fallback: extract description meta
        if (!opinion) {
            opinion =
                this.extractMeta(html, "og:description") ||
                this.extractMeta(html, "description") ||
                "";
        }

        return { caseName, citation, court, dateFiled, opinion };
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
