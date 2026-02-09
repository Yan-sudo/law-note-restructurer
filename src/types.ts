// ============================================================
// SETTINGS
// ============================================================

export interface LawNoteSettings {
    geminiApiKey: string;
    modelName: string;
    outputFolder: string;
    language: "zh" | "en" | "mixed";
    temperature: number;
    enableStreaming: boolean;
    enableSourceFootnotes: boolean;
    appendToExisting: boolean;
    concurrency: number;
    // Link Resolver settings
    courtListenerApiToken: string;
    resolvedLinksFolder: string;
    resolverRequestDelayMs: number;
    resolverScanScope: "vault" | "output-folder";
}

export const DEFAULT_SETTINGS: LawNoteSettings = {
    geminiApiKey: "",
    modelName: "gemini-2.5-flash",
    outputFolder: "LawNotes/Generated",
    language: "mixed",
    temperature: 0.3,
    enableStreaming: true,
    enableSourceFootnotes: true,
    appendToExisting: true,
    concurrency: 5,
    courtListenerApiToken: "",
    resolvedLinksFolder: "",
    resolverRequestDelayMs: 1500,
    resolverScanScope: "output-folder",
};

// ============================================================
// SOURCE DOCUMENTS
// ============================================================

export interface SourceDocument {
    path: string;
    filename: string;
    type: "md" | "docx";
    rawText: string;
    charCount: number;
    tokenEstimate: number;
}

// ============================================================
// EXTRACTED ENTITIES
// ============================================================

export type ConceptCategory =
    | "doctrine"
    | "rule"
    | "standard"
    | "defense"
    | "remedy"
    | "procedure"
    | "other";

export interface LegalConcept {
    id: string;
    name: string;
    nameChinese?: string;
    definition: string;
    category: ConceptCategory;
    sourceReferences: string[];
}

export interface LegalCase {
    id: string;
    name: string;
    citation?: string;
    year?: number;
    court?: string;
    facts: string;
    holding: string;
    significance: string;
    relatedConcepts: string[];
    sourceReferences: string[];
}

export interface LegalPrinciple {
    id: string;
    name: string;
    nameChinese?: string;
    description: string;
    relatedConcepts: string[];
    supportingCases: string[];
    sourceReferences: string[];
}

export interface LegalRule {
    id: string;
    name: string;
    nameChinese?: string;
    statement: string;
    elements: string[];
    exceptions: string[];
    applicationSteps: string[];
    relatedConcepts: string[];
    supportingCases: string[];
    sourceReferences: string[];
}

export interface ExtractedEntities {
    concepts: LegalConcept[];
    cases: LegalCase[];
    principles: LegalPrinciple[];
    rules: LegalRule[];
    metadata: {
        sourceDocuments: string[];
        extractionTimestamp: string;
        modelUsed: string;
        totalTokensUsed: number;
    };
}

// ============================================================
// RELATIONSHIP MATRIX
// ============================================================

export type RelationshipType =
    | "establishes"
    | "applies"
    | "modifies"
    | "distinguishes"
    | "overrules"
    | "illustrates";

export interface RelationshipEntry {
    caseId: string;
    conceptId: string;
    relationshipType: RelationshipType;
    description: string;
    strength: "primary" | "secondary" | "tangential";
}

export interface RelationshipMatrix {
    entries: RelationshipEntry[];
    casesInOrder: string[];
    conceptsInOrder: string[];
}

// ============================================================
// PIPELINE STATE
// ============================================================

export type PipelineStep =
    | "idle"
    | "source-select"
    | "entity-extract"
    | "relationship-map"
    | "generate-output"
    | "complete";

export interface PipelineState {
    currentStep: PipelineStep;
    sourceDocuments: SourceDocument[];
    extractedEntities: ExtractedEntities | null;
    relationshipMatrix: RelationshipMatrix | null;
    generatedFiles: string[];
    errors: PipelineError[];
}

export interface PipelineError {
    step: PipelineStep;
    message: string;
    timestamp: string;
    recoverable: boolean;
}

// ============================================================
// UTILITIES
// ============================================================

export function toWikilink(name: string): string {
    return `[[${name}]]`;
}

export function toWikilinkWithAlias(name: string, alias: string): string {
    return `[[${name}|${alias}]]`;
}

export function estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * Normalize a concept name for fuzzy matching:
 * - lowercase
 * - strip articles (the, a, an)
 * - collapse whitespace
 */
export function normalizeConceptName(name: string): string {
    return name
        .toLowerCase()
        .replace(/\b(the|a|an)\b/gi, "")
        .replace(/[^a-z0-9\u4e00-\u9fff]/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Clean AI-generated markdown:
 * - Remove wrapping ```markdown fences
 * - Remove leading whitespace before YAML ---
 */
export function cleanGeneratedMarkdown(content: string): string {
    let result = content.trim();
    // Remove wrapping ```markdown ... ``` fences
    result = result.replace(/^```(?:markdown|md)?\s*\n/i, "");
    result = result.replace(/\n```\s*$/, "");
    // Ensure YAML frontmatter starts at line 1 with no leading whitespace
    result = result.replace(/^\s*---/, "---");
    return result;
}
