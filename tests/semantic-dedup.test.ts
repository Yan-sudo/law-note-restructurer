import { describe, it, expect } from "vitest";
import { semanticDeduplicateConcepts } from "../src/pipeline/entity-merger";
import type { ExtractedEntities, LegalConcept } from "../src/types";

function concept(id: string, name: string, definition = ""): LegalConcept {
    return { id, name, definition, category: "doctrine", sourceReferences: [] };
}

function entities(concepts: LegalConcept[]): ExtractedEntities {
    return {
        concepts,
        cases: [],
        principles: [],
        rules: [],
        metadata: {
            sourceDocuments: [],
            extractionTimestamp: new Date(0).toISOString(),
            modelUsed: "test",
            totalTokensUsed: 0,
        },
    };
}

/** Returns canned embeddings keyed by concept id, exercising the merge logic. */
function fakeEmbedder(byText: Record<string, number[]>) {
    return {
        async embedTexts(texts: string[]): Promise<number[][]> {
            return texts.map((t) => byText[t] ?? [0, 0, 1]);
        },
    };
}

describe("semanticDeduplicateConcepts", () => {
    it("merges concepts whose embeddings exceed the threshold", async () => {
        const input = entities([
            concept("a", "Aggregate Principle", "partners taxed individually"),
            concept("b", "Aggregate Theory of Partnership Taxation", "partners taxed individually"),
            concept("c", "Adjusted Basis", "cost basis after adjustments"),
        ]);

        // a and b point the same direction; c is orthogonal.
        const embedder = fakeEmbedder({
            "Aggregate Principle: partners taxed individually": [1, 0, 0],
            "Aggregate Theory of Partnership Taxation: partners taxed individually": [0.98, 0.02, 0],
            "Adjusted Basis: cost basis after adjustments": [0, 1, 0],
        });

        const { entities: out, mergedCount } = await semanticDeduplicateConcepts(input, embedder, 0.9);

        expect(mergedCount).toBe(1);
        expect(out.concepts).toHaveLength(2);
        // The shorter name is kept as canonical.
        expect(out.concepts.map((c) => c.name).sort()).toEqual([
            "Adjusted Basis",
            "Aggregate Principle",
        ]);
    });

    it("is a no-op for fewer than two concepts", async () => {
        const input = entities([concept("a", "Only One")]);
        const { mergedCount } = await semanticDeduplicateConcepts(input, fakeEmbedder({}), 0.9);
        expect(mergedCount).toBe(0);
    });

    it("falls back gracefully when the embedder returns a wrong-sized result", async () => {
        const input = entities([concept("a", "X"), concept("b", "Y")]);
        const broken = {
            async embedTexts(): Promise<number[][]> {
                return [[1, 0]]; // only one vector for two concepts
            },
        };
        const { entities: out, mergedCount } = await semanticDeduplicateConcepts(input, broken, 0.9);
        expect(mergedCount).toBe(0);
        expect(out.concepts).toHaveLength(2);
    });
});
