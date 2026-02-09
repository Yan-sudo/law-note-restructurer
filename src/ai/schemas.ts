import { z } from "zod";

const optionalString = z.string().optional();
const optionalNumber = z.number().optional();

// ============================================================
// Enum helpers — Sets used by normalisation, schemas by Zod
// ============================================================

const VALID_CATEGORIES = new Set([
    "doctrine", "rule", "standard", "defense", "remedy", "procedure", "other",
]);

const VALID_REL_TYPES = new Set([
    "establishes", "applies", "modifies", "distinguishes", "overrules", "illustrates",
]);

const VALID_STRENGTHS = new Set([
    "primary", "secondary", "tangential",
]);

const categorySchema = z.enum([
    "doctrine", "rule", "standard", "defense", "remedy", "procedure", "other",
]);

const relTypeSchema = z.enum([
    "establishes", "applies", "modifies", "distinguishes", "overrules", "illustrates",
]);

const strengthSchema = z.enum([
    "primary", "secondary", "tangential",
]);

// ============================================================
// Entity schemas
// ============================================================

export const LegalConceptSchema = z.object({
    id: z.string(),
    name: z.string(),
    nameChinese: optionalString,
    definition: z.string(),
    category: categorySchema,
    sourceReferences: z.array(z.string()),
});

export const LegalCaseSchema = z.object({
    id: z.string(),
    name: z.string(),
    citation: optionalString,
    year: optionalNumber,
    court: optionalString,
    facts: z.string(),
    holding: z.string(),
    significance: z.string(),
    relatedConcepts: z.array(z.string()),
    sourceReferences: z.array(z.string()),
});

export const LegalPrincipleSchema = z.object({
    id: z.string(),
    name: z.string(),
    nameChinese: optionalString,
    description: z.string(),
    relatedConcepts: z.array(z.string()),
    supportingCases: z.array(z.string()),
    sourceReferences: z.array(z.string()),
});

export const LegalRuleSchema = z.object({
    id: z.string(),
    name: z.string(),
    nameChinese: optionalString,
    statement: z.string(),
    elements: z.array(z.string()),
    exceptions: z.array(z.string()),
    applicationSteps: z.array(z.string()),
    relatedConcepts: z.array(z.string()),
    supportingCases: z.array(z.string()),
    sourceReferences: z.array(z.string()),
});

export const ExtractedEntitiesSchema = z.object({
    concepts: z.array(LegalConceptSchema),
    cases: z.array(LegalCaseSchema),
    principles: z.array(LegalPrincipleSchema),
    rules: z.array(LegalRuleSchema),
    metadata: z.object({
        sourceDocuments: z.array(z.string()),
        extractionTimestamp: z.string(),
        modelUsed: z.string(),
        totalTokensUsed: z.number(),
    }),
});

export const RelationshipEntrySchema = z.object({
    caseId: z.string(),
    conceptId: z.string(),
    relationshipType: relTypeSchema,
    description: z.string(),
    strength: strengthSchema,
});

export const RelationshipMatrixSchema = z.object({
    entries: z.array(RelationshipEntrySchema),
    casesInOrder: z.array(z.string()),
    conceptsInOrder: z.array(z.string()),
});

// ============================================================
// DATA NORMALIZATION (run BEFORE Zod validation as extra safety)
// ============================================================

function normalizeCategory(value: unknown): string {
    if (typeof value !== "string") return "other";
    const lower = value.toLowerCase().trim();
    if (VALID_CATEGORIES.has(lower)) return lower;
    if (lower.includes("concept")) return "doctrine";
    if (lower.includes("exception")) return "defense";
    return "other";
}

/** Convert null → undefined (delete), filter nulls from arrays, coerce string year */
function sanitizeObject(obj: Record<string, unknown>, arrayKeys: string[]): void {
    for (const key of Object.keys(obj)) {
        if (obj[key] === null) {
            delete obj[key];
        } else if (Array.isArray(obj[key])) {
            obj[key] = (obj[key] as unknown[]).filter((v) => v !== null);
        }
    }
    // Ensure expected array fields exist
    for (const key of arrayKeys) {
        if (!Array.isArray(obj[key])) {
            obj[key] = [];
        }
    }
    // Coerce string year to number
    if (typeof obj.year === "string") {
        const n = Number(obj.year);
        if (!isNaN(n)) obj.year = n;
        else delete obj.year;
    }
}

const CONCEPT_ARRAYS = ["sourceReferences"];
const CASE_ARRAYS = ["relatedConcepts", "sourceReferences"];
const PRINCIPLE_ARRAYS = ["relatedConcepts", "supportingCases", "sourceReferences"];
const RULE_ARRAYS = [
    "elements", "exceptions", "applicationSteps",
    "relatedConcepts", "supportingCases", "sourceReferences",
];

/**
 * Normalize raw AI output to match our Zod schemas.
 * Call this BEFORE passing data to schema.parse().
 * Also fills in defaults for missing top-level fields (handles truncated responses).
 */
export function normalizeExtractedEntities(data: Record<string, unknown>): void {
    // Ensure all top-level arrays exist (handles truncated JSON)
    if (!Array.isArray(data.concepts)) data.concepts = [];
    if (!Array.isArray(data.cases)) data.cases = [];
    if (!Array.isArray(data.principles)) data.principles = [];
    if (!Array.isArray(data.rules)) data.rules = [];

    // Ensure metadata exists
    if (!data.metadata || typeof data.metadata !== "object") {
        data.metadata = {
            sourceDocuments: [],
            extractionTimestamp: new Date().toISOString(),
            modelUsed: "unknown",
            totalTokensUsed: 0,
        };
    } else {
        const meta = data.metadata as Record<string, unknown>;
        if (!Array.isArray(meta.sourceDocuments)) meta.sourceDocuments = [];
        if (!meta.extractionTimestamp) meta.extractionTimestamp = new Date().toISOString();
        if (!meta.modelUsed) meta.modelUsed = "unknown";
        if (typeof meta.totalTokensUsed !== "number") meta.totalTokensUsed = 0;
    }

    // Remove last element of each array if it looks incomplete (truncation artifact)
    for (const key of ["concepts", "cases", "principles", "rules"] as const) {
        const arr = data[key] as unknown[];
        if (arr.length > 0) {
            const last = arr[arr.length - 1];
            if (last && typeof last === "object" && !isCompleteEntity(last as Record<string, unknown>, key)) {
                console.warn(`[law-restructurer] Removing incomplete last ${key} entry (likely truncated)`);
                arr.pop();
            }
        }
    }

    const concepts = data.concepts as unknown[];
    for (const c of concepts) {
        if (c && typeof c === "object") {
            const obj = c as Record<string, unknown>;
            sanitizeObject(obj, CONCEPT_ARRAYS);
            obj.category = normalizeCategory(obj.category);
        }
    }

    const cases = data.cases as unknown[];
    for (const c of cases) {
        if (c && typeof c === "object") {
            sanitizeObject(c as Record<string, unknown>, CASE_ARRAYS);
        }
    }

    const principles = data.principles as unknown[];
    for (const p of principles) {
        if (p && typeof p === "object") {
            sanitizeObject(p as Record<string, unknown>, PRINCIPLE_ARRAYS);
        }
    }

    const rules = data.rules as unknown[];
    for (const r of rules) {
        if (r && typeof r === "object") {
            sanitizeObject(r as Record<string, unknown>, RULE_ARRAYS);
        }
    }
}

/** Check if an entity object has its essential fields (id + name at minimum). */
function isCompleteEntity(obj: Record<string, unknown>, type: string): boolean {
    if (!obj.id || typeof obj.id !== "string") return false;
    if (!obj.name || typeof obj.name !== "string") return false;
    // Cases need at minimum facts + holding
    if (type === "cases") {
        if (!obj.facts || typeof obj.facts !== "string") return false;
        if (!obj.holding || typeof obj.holding !== "string") return false;
    }
    return true;
}

export function normalizeRelationshipMatrix(data: Record<string, unknown>): void {
    // Ensure top-level arrays exist (handles truncated JSON)
    if (!Array.isArray(data.entries)) data.entries = [];
    if (!Array.isArray(data.casesInOrder)) data.casesInOrder = [];
    if (!Array.isArray(data.conceptsInOrder)) data.conceptsInOrder = [];

    const entries = data.entries as unknown[];

    // Remove incomplete last entry if truncated
    if (entries.length > 0) {
        const last = entries[entries.length - 1];
        if (last && typeof last === "object") {
            const obj = last as Record<string, unknown>;
            if (!obj.caseId || !obj.conceptId) {
                console.warn("[law-restructurer] Removing incomplete last matrix entry (likely truncated)");
                entries.pop();
            }
        }
    }

    for (const e of entries) {
        if (e && typeof e === "object") {
            const entry = e as Record<string, unknown>;
            sanitizeObject(entry, []);

            // Normalize relationshipType — if AI put a strength value here, swap it
            if (typeof entry.relationshipType === "string") {
                const lower = entry.relationshipType.toLowerCase().trim();
                if (VALID_REL_TYPES.has(lower)) {
                    entry.relationshipType = lower;
                } else if (VALID_STRENGTHS.has(lower)) {
                    // AI confused strength with relationshipType — use as strength, default relType
                    if (!entry.strength || !VALID_STRENGTHS.has(String(entry.strength).toLowerCase())) {
                        entry.strength = lower;
                    }
                    entry.relationshipType = "illustrates";
                } else {
                    entry.relationshipType = "illustrates";
                }
            }

            if (typeof entry.strength === "string") {
                const lower = entry.strength.toLowerCase().trim();
                entry.strength = VALID_STRENGTHS.has(lower)
                    ? lower
                    : "secondary";
            }
        }
    }

    // Auto-populate casesInOrder/conceptsInOrder from entries if missing
    if ((data.casesInOrder as string[]).length === 0 && entries.length > 0) {
        const caseIds = new Set<string>();
        for (const e of entries) {
            if (e && typeof e === "object") {
                const id = (e as Record<string, unknown>).caseId;
                if (typeof id === "string") caseIds.add(id);
            }
        }
        data.casesInOrder = Array.from(caseIds);
    }

    if ((data.conceptsInOrder as string[]).length === 0 && entries.length > 0) {
        const conceptIds = new Set<string>();
        for (const e of entries) {
            if (e && typeof e === "object") {
                const id = (e as Record<string, unknown>).conceptId;
                if (typeof id === "string") conceptIds.add(id);
            }
        }
        data.conceptsInOrder = Array.from(conceptIds);
    }
}
