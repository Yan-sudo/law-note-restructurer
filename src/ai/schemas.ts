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
 */
export function normalizeExtractedEntities(data: Record<string, unknown>): void {
    const concepts = data.concepts;
    if (Array.isArray(concepts)) {
        for (const c of concepts) {
            if (c && typeof c === "object") {
                const obj = c as Record<string, unknown>;
                sanitizeObject(obj, CONCEPT_ARRAYS);
                obj.category = normalizeCategory(obj.category);
            }
        }
    }

    const cases = data.cases;
    if (Array.isArray(cases)) {
        for (const c of cases) {
            if (c && typeof c === "object") {
                sanitizeObject(c as Record<string, unknown>, CASE_ARRAYS);
            }
        }
    }

    const principles = data.principles;
    if (Array.isArray(principles)) {
        for (const p of principles) {
            if (p && typeof p === "object") {
                sanitizeObject(p as Record<string, unknown>, PRINCIPLE_ARRAYS);
            }
        }
    }

    const rules = data.rules;
    if (Array.isArray(rules)) {
        for (const r of rules) {
            if (r && typeof r === "object") {
                sanitizeObject(r as Record<string, unknown>, RULE_ARRAYS);
            }
        }
    }
}

export function normalizeRelationshipMatrix(data: Record<string, unknown>): void {
    const entries = data.entries;
    if (Array.isArray(entries)) {
        for (const e of entries) {
            if (e && typeof e === "object") {
                const entry = e as Record<string, unknown>;
                sanitizeObject(entry, []);
                if (typeof entry.relationshipType === "string") {
                    const lower = entry.relationshipType.toLowerCase().trim();
                    entry.relationshipType = VALID_REL_TYPES.has(lower)
                        ? lower
                        : "illustrates";
                }
                if (typeof entry.strength === "string") {
                    const lower = entry.strength.toLowerCase().trim();
                    entry.strength = VALID_STRENGTHS.has(lower)
                        ? lower
                        : "secondary";
                }
            }
        }
    }
}
