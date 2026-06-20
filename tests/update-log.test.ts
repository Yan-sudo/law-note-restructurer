import { describe, it, expect } from "vitest";
import { generateWhatsNewPage } from "../src/generators/update-log-generator";
import { emptyDiff, type EntityDiff } from "../src/pipeline/entity-diff";
import type { ExtractedEntities, RelationshipMatrix } from "../src/types";

function entities(): ExtractedEntities {
    return {
        concepts: [{ id: "o", name: "Offer", definition: "d", category: "doctrine", sourceReferences: [] }],
        cases: [{ id: "h", name: "Hadley", facts: "f", holding: "x", significance: "", relatedConcepts: [], sourceReferences: [] }],
        principles: [],
        rules: [],
        metadata: { sourceDocuments: [], extractionTimestamp: new Date(0).toISOString(), modelUsed: "t", totalTokensUsed: 0 },
    };
}

const matrix: RelationshipMatrix = {
    entries: [{ caseId: "h", conceptId: "o", relationshipType: "establishes", description: "d", strength: "primary" }],
    casesInOrder: ["h"],
    conceptsInOrder: ["o"],
};

describe("generateWhatsNewPage", () => {
    it("draws a colored change graph with the new nodes and their links", () => {
        const diff: EntityDiff = { ...emptyDiff(), addedConcepts: ["Offer"], addedCases: ["Hadley"] };
        const page = generateWhatsNewPage(diff, entities(), matrix);

        expect(page).toContain("# What's New");
        expect(page).toContain("```mermaid");
        expect(page).toContain("-->|establishes|");
        expect(page).toContain("fill:#b7e4c7"); // green = added
        expect(page).toContain("[[Offer]]");
        expect(page).toContain("added: 1 concepts, 1 cases");
    });

    it("says so when nothing changed", () => {
        const page = generateWhatsNewPage(emptyDiff(), entities(), matrix);
        expect(page).toContain("No concept or case changes");
        expect(page).not.toContain("```mermaid");
    });
});
