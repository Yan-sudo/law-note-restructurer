import { BaseFetcher } from "./base-fetcher";
import type { FetchResult, ParsedCitation } from "../types";
import { generateCNCaseStubPage } from "../page-templates";

export class CnCaseFetcher extends BaseFetcher {
    constructor(delayMs: number) {
        super(delayMs);
    }

    async fetch(
        linkText: string,
        _parsed: ParsedCitation
    ): Promise<FetchResult> {
        const content = generateCNCaseStubPage({
            caseIdentifier: linkText,
        });

        return {
            success: true,
            title: linkText,
            content,
            source: "stub",
        };
    }
}
