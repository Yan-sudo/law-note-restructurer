import { describe, it, expect } from "vitest";
import { mergeEntities, deduplicateEntities } from "../src/pipeline/entity-merger";
import type { ExtractedEntities, LegalConcept } from "../src/types";

function concept(partial: Partial<LegalConcept> & { id: string; name: string }): LegalConcept {
    return {
        definition: "",
        category: "doctrine",
        sourceReferences: [],
        ...partial,
    };
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

describe("deduplicateEntities", () => {
    it("merges near-duplicate concepts and keeps the shorter (canonical) name", () => {
        const input = entities([
            concept({ id: "a", name: "Aggregate Principle", definition: "short", sourceReferences: ["ch1"] }),
            concept({
                id: "b",
                name: "Aggregate Principle Extended",
                definition: "a longer definition here",
                sourceReferences: ["ch2"],
            }),
        ]);

        const out = deduplicateEntities(input);

        expect(out.concepts).toHaveLength(1);
        expect(out.concepts[0].name).toBe("Aggregate Principle");
        // Longer definition is preferred, and source references are unioned.
        expect(out.concepts[0].definition).toBe("a longer definition here");
        expect(out.concepts[0].sourceReferences.sort()).toEqual(["ch1", "ch2"]);
    });

    it("leaves distinct concepts untouched", () => {
        const input = entities([
            concept({ id: "a", name: "Adjusted Basis" }),
            concept({ id: "b", name: "Carryover Basis" }),
        ]);
        expect(deduplicateEntities(input).concepts).toHaveLength(2);
    });
});

describe("mergeEntities (incremental updates)", () => {
    it("updates matching concepts and appends new ones", () => {
        const existing = entities([
            concept({ id: "t", name: "Taxation", definition: "old", sourceReferences: ["ch1"] }),
        ]);
        const incoming = entities([
            concept({ id: "t2", name: "Taxation", definition: "new", sourceReferences: ["ch2"] }),
            concept({ id: "b", name: "Basis", sourceReferences: ["ch2"] }),
        ]);

        const merged = mergeEntities(existing, incoming);

        expect(merged.concepts).toHaveLength(2);
        const tax = merged.concepts.find((c) => c.name === "Taxation")!;
        expect(tax.definition).toBe("new");
        expect(tax.sourceReferences.sort()).toEqual(["ch1", "ch2"]);
    });

    it("unions metadata source documents", () => {
        const existing = entities([]);
        existing.metadata.sourceDocuments = ["ch1.md"];
        const incoming = entities([]);
        incoming.metadata.sourceDocuments = ["ch2.md"];

        const merged = mergeEntities(existing, incoming);
        expect(merged.metadata.sourceDocuments.sort()).toEqual(["ch1.md", "ch2.md"]);
    });
});
