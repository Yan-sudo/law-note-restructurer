import { requestUrl, type RequestUrlResponse } from "obsidian";
import type { FetchResult, ParsedCitation } from "../types";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export abstract class BaseFetcher {
    protected delayMs: number;
    private lastRequestTime = 0;

    constructor(delayMs: number) {
        this.delayMs = delayMs;
    }

    abstract fetch(
        linkText: string,
        parsed: ParsedCitation
    ): Promise<FetchResult>;

    protected async request(
        url: string,
        options?: {
            method?: string;
            headers?: Record<string, string>;
            body?: string;
            contentType?: string;
        }
    ): Promise<RequestUrlResponse> {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        if (elapsed < this.delayMs) {
            await sleep(this.delayMs - elapsed);
        }
        this.lastRequestTime = Date.now();

        return requestUrl({
            url,
            method: options?.method ?? "GET",
            headers: options?.headers ?? {},
            body: options?.body,
            contentType: options?.contentType,
            throw: false,
        });
    }

    protected stripHtml(html: string): string {
        return html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n\n")
            .replace(/<\/div>/gi, "\n")
            .replace(/<\/li>/gi, "\n")
            .replace(/<li[^>]*>/gi, "- ")
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }
}
