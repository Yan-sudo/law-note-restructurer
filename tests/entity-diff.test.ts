import { describe, it, expect } from "vitest";
import { diffEntities, diffIsEmpty } from "../src/pipeline/entity-diff";
import type { LegalCase, LegalConcept } from "../src/types";

function concept(name: string, definition: string): LegalConcept {
    return { id: name, name, definition, category: "doctrine", sourceReferences: [] };
}
function legalCase(name: string, holding: string): LegalCase {
    return { id: name, name, facts: "f", holding, significance: "", relatedConcepts: [], sourceReferences: [] };
}

describe("diffEntities", () => {
    it("classifies added vs updated by name and content", () => {
        const before = { concepts: [concept("Consideration", "old")], cases: [] as LegalCase[] };
        const after = {
            concepts: [concept("Consideration", "new"), concept("Offer", "d")],
            cases: [legalCase("Hadley v. Baxendale", "foreseeable")],
        };

        const diff = diffEntities(before, after);
        expect(diff.updatedConcepts).toEqual(["Consideration"]);
        expect(diff.addedConcepts).toEqual(["Offer"]);
        expect(diff.addedCases).toEqual(["Hadley v. Baxendale"]);
        expect(diff.updatedCases).toEqual([]);
        expect(diffIsEmpty(diff)).toBe(false);
    });

    it("reports an empty diff when nothing changed", () => {
        const same = { concepts: [concept("X", "d")], cases: [] as LegalCase[] };
        expect(diffIsEmpty(diffEntities(same, same))).toBe(true);
    });
});
