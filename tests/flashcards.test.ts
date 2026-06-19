import { describe, it, expect } from "vitest";
import {
    buildFlashcards,
    generateFlashcardsMarkdown,
    generateAnkiExport,
} from "../src/generators/flashcards-generator";
import type { ExtractedEntities } from "../src/types";

function entities(): ExtractedEntities {
    return {
        concepts: [
            { id: "c", name: "Consideration", definition: "a bargained-for exchange", category: "doctrine", sourceReferences: [] },
        ],
        cases: [
            {
                id: "k",
                name: "Hadley v. Baxendale",
                facts: "f",
                holding: "damages must be foreseeable",
                significance: "",
                relatedConcepts: [],
                sourceReferences: [],
            },
        ],
        principles: [],
        rules: [
            {
                id: "r",
                name: "Promissory Estoppel",
                statement: "a promise reasonably relied upon is enforceable",
                elements: ["promise", "reliance", "injustice"],
                exceptions: [],
                applicationSteps: [],
                relatedConcepts: [],
                supportingCases: [],
                sourceReferences: [],
            },
        ],
        metadata: {
            sourceDocuments: [],
            extractionTimestamp: new Date(0).toISOString(),
            modelUsed: "test",
            totalTokensUsed: 0,
        },
    };
}

describe("buildFlashcards", () => {
    it("creates cards from definitions, rules (statement + elements), and holdings", () => {
        const cards = buildFlashcards(entities());
        const fronts = cards.map((c) => c.front);
        expect(fronts).toContain("Define: Consideration");
        expect(fronts).toContain("State the rule: Promissory Estoppel");
        expect(fronts).toContain("Elements of Promissory Estoppel?");
        expect(fronts).toContain("Holding — Hadley v. Baxendale?");
        const elements = cards.find((c) => c.front === "Elements of Promissory Estoppel?");
        expect(elements?.back).toBe("promise; reliance; injustice");
    });
});

describe("generateFlashcardsMarkdown", () => {
    it("emits #flashcard frontmatter and inline Q::A cards", () => {
        const md = generateFlashcardsMarkdown(entities());
        expect(md).toContain("- flashcard");
        expect(md).toContain("Define: Consideration::a bargained-for exchange");
    });
});

describe("generateAnkiExport", () => {
    it("emits tab-separated front/back rows", () => {
        const tsv = generateAnkiExport(entities());
        const line = tsv.split("\n").find((l) => l.startsWith("Define: Consideration"));
        expect(line).toBe("Define: Consideration\ta bargained-for exchange");
    });
});
