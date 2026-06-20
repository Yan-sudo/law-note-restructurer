import { describe, it, expect } from "vitest";
import { generateAuthorityCheckPage } from "../src/generators/authority-check-generator";
import type {
    ExtractedEntities,
    LegalCase,
    RelationshipEntry,
    RelationshipMatrix,
} from "../src/types";

function fixture(): { entities: ExtractedEntities; matrix: RelationshipMatrix } {
    const cases: LegalCase[] = [
        { id: "old", name: "Old v. State", year: 1950, facts: "", holding: "", significance: "", relatedConcepts: [], sourceReferences: [] },
        { id: "new", name: "New v. State", year: 1990, facts: "", holding: "", significance: "", relatedConcepts: [], sourceReferences: [] },
    ];
    const entities: ExtractedEntities = {
        concepts: [
            { id: "x", name: "Shaky Doctrine", definition: "d", category: "doctrine", sourceReferences: [] },
            { id: "y", name: "Solid Doctrine", definition: "d", category: "doctrine", sourceReferences: [] },
        ],
        cases,
        principles: [],
        rules: [],
        metadata: { sourceDocuments: [], extractionTimestamp: new Date(0).toISOString(), modelUsed: "t", totalTokensUsed: 0 },
    };
    const entries: RelationshipEntry[] = [
        { caseId: "old", conceptId: "x", relationshipType: "establishes", description: "sets it up", strength: "primary" },
        { caseId: "new", conceptId: "x", relationshipType: "overrules", description: "no longer good law", strength: "primary" },
        { caseId: "old", conceptId: "y", relationshipType: "establishes", description: "still good", strength: "primary" },
    ];
    const matrix: RelationshipMatrix = { entries, casesInOrder: ["old", "new"], conceptsInOrder: ["x", "y"] };
    return { entities, matrix };
}

describe("generateAuthorityCheckPage", () => {
    it("flags doctrines limited by a later case", () => {
        const { entities, matrix } = fixture();
        const page = generateAuthorityCheckPage(matrix, entities);

        expect(page).toContain("# Authority Check");
        expect(page).toContain("[[Shaky Doctrine]]");
        expect(page).toContain("[!warning]");
        expect(page).toContain("Established by [[Old v. State]]");
        expect(page).toContain("**overrules** by [[New v. State]]");
    });

    it("does not flag doctrines with no limiting cases", () => {
        const { entities, matrix } = fixture();
        const page = generateAuthorityCheckPage(matrix, entities);
        expect(page).not.toContain("[[Solid Doctrine]]");
    });
});
