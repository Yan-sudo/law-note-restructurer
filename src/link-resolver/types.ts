export type LinkCategory =
    | "us-case"
    | "us-statute"
    | "cn-law"
    | "cn-case"
    | "unknown";

export interface UnresolvedLink {
    linkText: string;
    referencedIn: string[];
    referenceCount: number;
    category: LinkCategory;
    confidence: number;
    parsed: ParsedCitation;
}

export interface ParsedCitation {
    /** US cases: party names */
    plaintiff?: string;
    defendant?: string;
    /** US statutes: title and section numbers */
    title?: string;
    section?: string;
    /** US cases: reporter citation parts */
    volume?: string;
    reporter?: string;
    page?: string;
    /** Chinese laws: law name */
    lawName?: string;
    /** Chinese cases: case number or guiding case number */
    caseNumber?: string;
    /** Raw normalized text */
    raw: string;
}

export interface FetchResult {
    success: boolean;
    title: string;
    content: string;
    source: string;
    sourceUrl?: string;
    error?: string;
}
