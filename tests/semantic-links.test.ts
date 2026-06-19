import { describe, it, expect } from "vitest";
import { computeRelatedConcepts, renderRelatedSection } from "../src/pipeline/semantic-links";
import type { LegalConcept } from "../src/types";

function concept(id: string, name: string): LegalConcept {
    return { id, name, definition: "d", category: "doctrine", sourceReferences: [] };
}

function fakeEmbedder(vectors: number[][]) {
    return {
        async embedTexts(): Promise<number[][]> {
            return vectors;
        },
    };
}

describe("computeRelatedConcepts", () => {
    it("links concepts above the threshold, ranked by similarity", async () => {
        const concepts = [concept("a", "Offer"), concept("b", "Acceptance"), concept("c", "Tort Duty")];
        // a and b nearly parallel; c orthogonal.
        const embedder = fakeEmbedder([
            [1, 0],
            [0.95, 0.05],
            [0, 1],
        ]);

        const related = await computeRelatedConcepts(concepts, embedder, 0.7, 5);

        expect(related.get("a")?.map((r) => r.name)).toEqual(["Acceptance"]);
        expect(related.get("b")?.map((r) => r.name)).toEqual(["Offer"]);
        expect(related.has("c")).toBe(false);
    });

    it("is a no-op for a single concept", async () => {
        const related = await computeRelatedConcepts([concept("a", "Only")], fakeEmbedder([[1]]), 0.7, 5);
        expect(related.size).toBe(0);
    });
});

describe("renderRelatedSection", () => {
    it("renders wikilinks, or empty string when there is nothing", () => {
        expect(renderRelatedSection([{ name: "Acceptance", score: 0.9 }])).toContain("[[Acceptance]]");
        expect(renderRelatedSection([])).toBe("");
        expect(renderRelatedSection(undefined)).toBe("");
    });
});
