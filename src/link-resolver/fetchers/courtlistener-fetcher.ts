import { BaseFetcher } from "./base-fetcher";
import type { FetchResult, ParsedCitation } from "../types";
import { generateUSCasePage } from "../page-templates";

interface CLSearchResult {
    caseName: string;
    citation: string;
    court: string;
    dateFiled: string;
    snippet: string;
    absoluteUrl: string;
    clusterId: number;
}

export class CourtListenerFetcher extends BaseFetcher {
    private apiToken: string;

    constructor(apiToken: string, delayMs: number) {
        super(delayMs);
        this.apiToken = apiToken;
    }

    async fetch(
        linkText: string,
        parsed: ParsedCitation
    ): Promise<FetchResult> {
        try {
            const searchResult = await this.search(linkText, parsed);
            if (!searchResult) {
                return {
                    success: false,
                    title: linkText,
                    content: "",
                    source: "courtlistener",
                    error: "No results found on CourtListener",
                };
            }

            let opinionText = this.stripHtml(searchResult.snippet);

            // Try to fetch full opinion text
            if (searchResult.clusterId) {
                const fullText = await this.fetchOpinion(
                    searchResult.clusterId
                );
                if (fullText) {
                    opinionText = fullText;
                }
            }

            const sourceUrl = searchResult.absoluteUrl.startsWith("http")
                ? searchResult.absoluteUrl
                : `https://www.courtlistener.com${searchResult.absoluteUrl}`;

            const content = generateUSCasePage({
                caseName: searchResult.caseName || linkText,
                citation: searchResult.citation,
                court: searchResult.court,
                dateFiled: searchResult.dateFiled,
                opinion: opinionText,
                sourceUrl,
                source: "courtlistener",
            });

            return {
                success: true,
                title: searchResult.caseName || linkText,
                content,
                source: "courtlistener",
                sourceUrl,
            };
        } catch (error) {
            return {
                success: false,
                title: linkText,
                content: "",
                source: "courtlistener",
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            };
        }
    }

    private async search(
        linkText: string,
        parsed: ParsedCitation
    ): Promise<CLSearchResult | null> {
        const query = encodeURIComponent(linkText);
        const url = `https://www.courtlistener.com/api/rest/v4/search/?q=${query}&type=o`;

        const response = await this.request(url, {
            headers: {
                Authorization: `Token ${this.apiToken}`,
            },
        });

        if (response.status === 401) {
            throw new Error(
                "CourtListener auth failed. Check your API token in settings."
            );
        }

        if (response.status === 429) {
            throw new Error("CourtListener rate limit exceeded. Try later.");
        }

        if (response.status !== 200) {
            throw new Error(
                `CourtListener API error: HTTP ${response.status}`
            );
        }

        const data = response.json;
        const results = data?.results;
        if (!results || results.length === 0) {
            return null;
        }

        const first = results[0];
        return {
            caseName: first.caseName || first.case_name || "",
            citation:
                first.citation?.[0] ||
                first.citations?.[0]?.toString() ||
                "",
            court: first.court || first.court_id || "",
            dateFiled: first.dateFiled || first.date_filed || "",
            snippet: first.snippet || "",
            absoluteUrl:
                first.absolute_url || first.absoluteUrl || "",
            clusterId: first.cluster_id || first.cluster || 0,
        };
    }

    private async fetchOpinion(
        clusterId: number
    ): Promise<string | null> {
        try {
            const url = `https://www.courtlistener.com/api/rest/v4/clusters/${clusterId}/`;
            const response = await this.request(url, {
                headers: {
                    Authorization: `Token ${this.apiToken}`,
                },
            });

            if (response.status !== 200) return null;

            const data = response.json;
            // Try sub_opinions for full text
            if (data.sub_opinions?.length > 0) {
                const opUrl = data.sub_opinions[0];
                if (typeof opUrl === "string") {
                    const opResponse = await this.request(opUrl, {
                        headers: {
                            Authorization: `Token ${this.apiToken}`,
                        },
                    });
                    if (opResponse.status === 200) {
                        const opData = opResponse.json;
                        if (opData.plain_text) return opData.plain_text;
                        if (opData.html)
                            return this.stripHtml(opData.html);
                        if (opData.html_lawbox)
                            return this.stripHtml(opData.html_lawbox);
                        if (opData.html_columbia)
                            return this.stripHtml(opData.html_columbia);
                    }
                }
            }
            return null;
        } catch {
            return null;
        }
    }
}
