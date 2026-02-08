import { BaseFetcher } from "./base-fetcher";
import type { FetchResult, ParsedCitation } from "../types";
import { generateCNLawPage } from "../page-templates";

interface NpcSearchResult {
    id: string;
    title: string;
    publish: string;
    status: string;
    url: string;
}

export class CnLawFetcher extends BaseFetcher {
    constructor(delayMs: number) {
        super(delayMs);
    }

    async fetch(
        linkText: string,
        parsed: ParsedCitation
    ): Promise<FetchResult> {
        try {
            const searchResult = await this.searchLaw(
                parsed.lawName || linkText
            );
            if (!searchResult) {
                return {
                    success: false,
                    title: linkText,
                    content: "",
                    source: "flk-npc",
                    error: "在国家法律法规数据库中未找到该法律",
                };
            }

            const bodyText = await this.fetchLawBody(searchResult.id);
            const sourceUrl = `https://flk.npc.gov.cn/detail2.html?ZmY4MDgxODE=${searchResult.id}`;

            const content = generateCNLawPage({
                lawName: searchResult.title || linkText,
                publishDate: searchResult.publish || "",
                status: searchResult.status || "",
                bodyPreview: bodyText || "",
                sourceUrl,
            });

            return {
                success: true,
                title: searchResult.title || linkText,
                content,
                source: "flk-npc",
                sourceUrl,
            };
        } catch (error) {
            return {
                success: false,
                title: linkText,
                content: "",
                source: "flk-npc",
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            };
        }
    }

    private async searchLaw(
        lawName: string
    ): Promise<NpcSearchResult | null> {
        const params = new URLSearchParams({
            type: "flfg",
            searchType: "title;vague",
            sortTr: "f_bbrq_s;desc",
            title: lawName,
            page: "1",
            size: "5",
        });

        const url = `https://flk.npc.gov.cn/api/?${params.toString()}`;
        const response = await this.request(url);

        if (response.status !== 200) {
            throw new Error(
                `NPC API error: HTTP ${response.status}`
            );
        }

        const data = response.json;
        if (!data || data.code !== 200) {
            return null;
        }

        const results = data.result?.data;
        if (!results || results.length === 0) {
            return null;
        }

        // Prefer exact title match
        const exactMatch = results.find(
            (r: Record<string, string>) =>
                r.title === lawName ||
                r.title?.includes(lawName) ||
                lawName.includes(r.title)
        );
        const best = exactMatch || results[0];

        return {
            id: best.id || "",
            title: best.title || "",
            publish: best.publish || "",
            status: best.status || "",
            url: best.url || "",
        };
    }

    private async fetchLawBody(id: string): Promise<string> {
        const url = `https://flk.npc.gov.cn/api/detail?id=${encodeURIComponent(id)}`;
        const response = await this.request(url);

        if (response.status !== 200) {
            return "";
        }

        const data = response.json;
        if (!data || data.code !== 200) {
            return "";
        }

        const result = data.result;

        // Try to get HTML body directly
        if (result?.body && typeof result.body === "string") {
            return this.stripHtml(result.body);
        }

        // Try body array for download links
        if (Array.isArray(result?.body)) {
            for (const item of result.body) {
                if (item.type === "HTML" && item.url) {
                    return await this.fetchHtmlBody(item.url);
                }
            }
            // Try WORD format as fallback
            for (const item of result.body) {
                if (item.type === "WORD" && item.url) {
                    return await this.fetchDocxBody(item.url);
                }
            }
        }

        return "";
    }

    private async fetchHtmlBody(relativeUrl: string): Promise<string> {
        try {
            const url = relativeUrl.startsWith("http")
                ? relativeUrl
                : `https://wb.flk.npc.gov.cn${relativeUrl}`;
            const response = await this.request(url);
            if (response.status !== 200) return "";
            return this.stripHtml(response.text);
        } catch {
            return "";
        }
    }

    private async fetchDocxBody(relativeUrl: string): Promise<string> {
        try {
            const url = relativeUrl.startsWith("http")
                ? relativeUrl
                : `https://wb.flk.npc.gov.cn${relativeUrl}`;
            const response = await this.request(url);
            if (response.status !== 200) return "";

            // Use mammoth to convert DOCX to text
            const mammoth = await import("mammoth");
            const result = await mammoth.extractRawText({
                arrayBuffer: response.arrayBuffer,
            });
            return result.value || "";
        } catch {
            return "";
        }
    }
}
