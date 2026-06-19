import { describe, it, expect } from "vitest";
import {
    generateEvolutionPage,
    generateSynthesisPage,
} from "../src/generators/study-aids-generator";
import type {
    ExtractedEntities,
    LegalCase,
    RelationshipEntry,
    RelationshipMatrix,
} from "../src/types";

function fixture(): { entities: ExtractedEntities; matrix: RelationshipMatrix } {
    const cases: LegalCase[] = [
        {
            id: "later",
            name: "Later v. State",
            year: 1990,
            facts: "Facts B with a | pipe",
            holding: "Refines the rule",
            significance: "",
            relatedConcepts: ["x"],
            sourceReferences: [],
        },
        {
            id: "early",
            name: "Early v. State",
            year: 1970,
            facts: "Facts A",
            holding: "Establishes the rule",
            significance: "",
            relatedConcepts: ["x"],
            sourceReferences: [],
        },
    ];
    const entities: ExtractedEntities = {
        concepts: [
            { id: "x", name: "Some Doctrine", definition: "d", category: "doctrine", sourceReferences: [] },
            { id: "y", name: "Lonely Doctrine", definition: "d", category: "doctrine", sourceReferences: [] },
        ],
        cases,
        principles: [],
        rules: [],
        metadata: {
            sourceDocuments: [],
            extractionTimestamp: new Date(0).toISOString(),
            modelUsed: "test",
            totalTokensUsed: 0,
        },
    };
    const entries: RelationshipEntry[] = [
        { caseId: "early", conceptId: "x", relationshipType: "establishes", description: "first", strength: "primary" },
        { caseId: "later", conceptId: "x", relationshipType: "modifies", description: "narrows it", strength: "primary" },
    ];
    const matrix: RelationshipMatrix = {
        entries,
        casesInOrder: ["early", "later"],
        conceptsInOrder: ["x", "y"],
    };
    return { entities, matrix };
}

describe("generateEvolutionPage", () => {
    it("orders cases chronologically and draws a mermaid chain", () => {
        const { entities, matrix } = fixture();
        const page = generateEvolutionPage(matrix, entities);

        expect(page).toContain("# Doctrinal Evolution");
        expect(page).toContain("[[Some Doctrine]]");
        // Earlier case appears before later case.
        expect(page.indexOf("Early v. State")).toBeLessThan(page.indexOf("Later v. State"));
        // Two cases -> a mermaid diagram with the relationship edge.
        expect(page).toContain("```mermaid");
        expect(page).toContain("-->|modifies|");
        // Concepts with no evolution entries are omitted.
        expect(page).not.toContain("Lonely Doctrine");
    });
});

describe("generateSynthesisPage", () => {
    it("builds a comparison table and escapes pipes in cells", () => {
        const { entities, matrix } = fixture();
        const page = generateSynthesisPage(matrix, entities);

        expect(page).toContain("# Case Synthesis");
        expect(page).toContain("| Case | Year | Relationship | Facts | Holding |");
        // Pipe inside a fact is escaped so it doesn't break the table.
        expect(page).toContain("Facts B with a \\| pipe");
        // Single-case concepts are skipped.
        expect(page).not.toContain("Lonely Doctrine");
    });
});
