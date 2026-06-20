import { describe, it, expect } from "vitest";
import {
    moveSection,
    moveSubsection,
    structureText,
    buildTocPrompt,
    buildOutlineFromTocPrompt,
    buildHeadingRule,
    DEFAULT_OUTLINE_OPTIONS,
    type Toc,
    type TocSection,
} from "../src/ai/outline";
import type { ExtractedEntities } from "../src/types";

function entities(): ExtractedEntities {
    return {
        concepts: [{ id: "p", name: "Personal Jurisdiction", definition: "d", category: "doctrine", sourceReferences: [] }],
        cases: [{ id: "i", name: "Int'l Shoe", year: 1945, facts: "f", holding: "h", significance: "", relatedConcepts: [], sourceReferences: [] }],
        principles: [],
        rules: [],
        metadata: { sourceDocuments: [], extractionTimestamp: new Date(0).toISOString(), modelUsed: "t", totalTokensUsed: 0 },
    };
}

const sections = (...titles: string[]): TocSection[] =>
    titles.map((t) => ({ title: t, items: [], subsections: [] }));

describe("moveSection", () => {
    it("reorders an item", () => {
        expect(moveSection(sections("A", "B", "C"), 0, 2).map((s) => s.title)).toEqual(["B", "C", "A"]);
    });
    it("is a no-op for out-of-range or same index", () => {
        expect(moveSection(sections("A"), 0, 5).map((s) => s.title)).toEqual(["A"]);
        expect(moveSection(sections("A", "B"), 1, 1).map((s) => s.title)).toEqual(["A", "B"]);
    });
    it("does not mutate the input", () => {
        const input = sections("A", "B");
        moveSection(input, 0, 1);
        expect(input.map((s) => s.title)).toEqual(["A", "B"]);
    });
});

describe("moveSubsection", () => {
    const withSubs = (): TocSection[] => [
        {
            title: "S",
            items: [],
            subsections: [
                { title: "a", items: [] },
                { title: "b", items: [] },
                { title: "c", items: [] },
            ],
        },
    ];
    it("reorders a subsection within its section", () => {
        const out = moveSubsection(withSubs(), 0, 0, 2);
        expect(out[0].subsections.map((s) => s.title)).toEqual(["b", "c", "a"]);
    });
    it("is a no-op for a bad section or sub index", () => {
        const titles = (out: TocSection[]) => out[0].subsections.map((s) => s.title);
        expect(titles(moveSubsection(withSubs(), 9, 0, 1))).toEqual(["a", "b", "c"]);
        expect(titles(moveSubsection(withSubs(), 0, 0, 0))).toEqual(["a", "b", "c"]);
    });
    it("does not mutate the input", () => {
        const input = withSubs();
        moveSubsection(input, 0, 0, 2);
        expect(input[0].subsections.map((s) => s.title)).toEqual(["a", "b", "c"]);
    });
});

describe("structureText", () => {
    it("lifecycle describes a case's journey", () => {
        const text = structureText({ ...DEFAULT_OUTLINE_OPTIONS, structure: "lifecycle" });
        expect(text).toMatch(/pleadings|appeal|lifecycle/i);
    });
    it("custom uses the user's instruction", () => {
        const text = structureText({ ...DEFAULT_OUTLINE_OPTIONS, structure: "custom", customInstruction: "group by remedy" });
        expect(text).toContain("group by remedy");
    });
});

describe("prompts", () => {
    it("TOC prompt reflects detail + structure", () => {
        const p = buildTocPrompt(
            entities(),
            { ...DEFAULT_OUTLINE_OPTIONS, detail: "detailed", structure: "lifecycle" },
            "en"
        );
        expect(p).toContain("TABLE OF CONTENTS");
        expect(p).toMatch(/appeal|lifecycle/i);
        expect(p).toContain("Thorough");
        expect(p).toContain("Personal Jurisdiction");
    });

    it("TOC prompt honors a section-count target and a flat (1-level) request", () => {
        const p = buildTocPrompt(
            entities(),
            { ...DEFAULT_OUTLINE_OPTIONS, levels: 1, sectionCount: 8 },
            "en"
        );
        expect(p).toContain("about 8 top-level sections");
        expect(p).toContain("Keep it FLAT");
    });

    it("buildHeadingRule scales depth and caps at h6", () => {
        expect(buildHeadingRule(1)).toContain("no deeper headings");
        expect(buildHeadingRule(3)).toContain("####");
        // h2..h6 = 5 heading levels; level 5 reaches ######.
        expect(buildHeadingRule(5)).toContain("######");
        // Beyond 5, real headings cap at h6 and deeper nesting uses lists.
        const deep = buildHeadingRule(7);
        expect(deep).toContain("######");
        expect(deep).toContain("bold lead-ins");
        // Auto goes as deep as needed.
        expect(buildHeadingRule(0)).toMatch(/as deep as the material/i);
    });

    it("outline heading rule deepens with levels", () => {
        const toc: Toc = { sections: [{ title: "A", items: [], subsections: [] }] };
        const oneLevel = buildOutlineFromTocPrompt(
            entities(),
            toc,
            { ...DEFAULT_OUTLINE_OPTIONS, levels: 1 },
            "en",
            "2026-01-01"
        );
        expect(oneLevel).toContain("no deeper headings");
        const threeLevel = buildOutlineFromTocPrompt(
            entities(),
            toc,
            { ...DEFAULT_OUTLINE_OPTIONS, levels: 3 },
            "en",
            "2026-01-01"
        );
        expect(threeLevel).toContain("####");
    });

    it("outline-from-TOC enforces the given section order and renders subsections", () => {
        const toc: Toc = {
            sections: [
                {
                    title: "Pleadings",
                    items: ["Complaint"],
                    subsections: [{ title: "Motions", items: ["12(b)(6)", "12(b)(2)"] }],
                },
                { title: "Appeal", items: [], subsections: [] },
            ],
        };
        const p = buildOutlineFromTocPrompt(entities(), toc, DEFAULT_OUTLINE_OPTIONS, "en", "2026-01-01");
        expect(p).toContain("EXACTLY this table");
        expect(p.indexOf("Pleadings")).toBeLessThan(p.indexOf("Appeal"));
        // Nested subsection + its leaf item are present and ordered under the section.
        expect(p).toContain("1.1 Motions");
        expect(p).toContain("12(b)(6)");
        expect(p.indexOf("Motions")).toBeLessThan(p.indexOf("Appeal"));
    });
});
