/**
 * Gemini response schemas (constrained decoding).
 *
 * These mirror the Zod schemas in `schemas.ts`. They are passed to the model
 * via `config.responseSchema` so Gemini is *forced* to emit JSON that already
 * conforms to the structure — no more hand-rolled bracket/quote/comma repair.
 *
 * Zod (schemas.ts) still validates at runtime as defense-in-depth; this schema
 * guarantees the *shape* the model produces.
 *
 * NOTE: `metadata` is intentionally omitted — it is filled in code (real source
 * filenames, timestamp, model name, token usage), not hallucinated by the model.
 *
 * Keep these in sync with `schemas.ts` if either changes.
 */
import { Type, type Schema } from "@google/genai";

const STRING: Schema = { type: Type.STRING };
const STRING_ARRAY: Schema = { type: Type.ARRAY, items: { type: Type.STRING } };

function nullableString(): Schema {
    return { type: Type.STRING, nullable: true };
}

function enumString(values: readonly string[]): Schema {
    return { type: Type.STRING, enum: [...values] };
}

const CATEGORY_VALUES = [
    "doctrine", "rule", "standard", "defense", "remedy", "procedure", "other",
] as const;

const REL_TYPE_VALUES = [
    "establishes", "applies", "modifies", "distinguishes", "overrules", "illustrates",
] as const;

const STRENGTH_VALUES = ["primary", "secondary", "tangential"] as const;

const conceptSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        id: STRING,
        name: STRING,
        nameChinese: nullableString(),
        definition: STRING,
        category: enumString(CATEGORY_VALUES),
        sourceReferences: STRING_ARRAY,
    },
    required: ["id", "name", "definition", "category", "sourceReferences"],
    propertyOrdering: ["id", "name", "nameChinese", "definition", "category", "sourceReferences"],
};

const caseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        id: STRING,
        name: STRING,
        citation: nullableString(),
        year: { type: Type.INTEGER, nullable: true },
        court: nullableString(),
        facts: STRING,
        holding: STRING,
        significance: STRING,
        relatedConcepts: STRING_ARRAY,
        sourceReferences: STRING_ARRAY,
    },
    required: ["id", "name", "facts", "holding", "significance", "relatedConcepts", "sourceReferences"],
    propertyOrdering: [
        "id", "name", "citation", "year", "court",
        "facts", "holding", "significance", "relatedConcepts", "sourceReferences",
    ],
};

const principleSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        id: STRING,
        name: STRING,
        nameChinese: nullableString(),
        description: STRING,
        relatedConcepts: STRING_ARRAY,
        supportingCases: STRING_ARRAY,
        sourceReferences: STRING_ARRAY,
    },
    required: ["id", "name", "description", "relatedConcepts", "supportingCases", "sourceReferences"],
    propertyOrdering: [
        "id", "name", "nameChinese", "description",
        "relatedConcepts", "supportingCases", "sourceReferences",
    ],
};

const ruleSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        id: STRING,
        name: STRING,
        nameChinese: nullableString(),
        statement: STRING,
        elements: STRING_ARRAY,
        exceptions: STRING_ARRAY,
        applicationSteps: STRING_ARRAY,
        relatedConcepts: STRING_ARRAY,
        supportingCases: STRING_ARRAY,
        sourceReferences: STRING_ARRAY,
    },
    required: [
        "id", "name", "statement", "elements", "exceptions",
        "applicationSteps", "relatedConcepts", "supportingCases", "sourceReferences",
    ],
    propertyOrdering: [
        "id", "name", "nameChinese", "statement", "elements", "exceptions",
        "applicationSteps", "relatedConcepts", "supportingCases", "sourceReferences",
    ],
};

export const ExtractedEntitiesResponseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        concepts: { type: Type.ARRAY, items: conceptSchema },
        cases: { type: Type.ARRAY, items: caseSchema },
        principles: { type: Type.ARRAY, items: principleSchema },
        rules: { type: Type.ARRAY, items: ruleSchema },
    },
    required: ["concepts", "cases", "principles", "rules"],
    propertyOrdering: ["concepts", "cases", "principles", "rules"],
};

const relationshipEntrySchema: Schema = {
    type: Type.OBJECT,
    properties: {
        caseId: STRING,
        conceptId: STRING,
        relationshipType: enumString(REL_TYPE_VALUES),
        description: STRING,
        strength: enumString(STRENGTH_VALUES),
    },
    required: ["caseId", "conceptId", "relationshipType", "description", "strength"],
    propertyOrdering: ["caseId", "conceptId", "relationshipType", "description", "strength"],
};

export const RelationshipMatrixResponseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        entries: { type: Type.ARRAY, items: relationshipEntrySchema },
        casesInOrder: STRING_ARRAY,
        conceptsInOrder: STRING_ARRAY,
    },
    required: ["entries", "casesInOrder", "conceptsInOrder"],
    propertyOrdering: ["entries", "casesInOrder", "conceptsInOrder"],
};
