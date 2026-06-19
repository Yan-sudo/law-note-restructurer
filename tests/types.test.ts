import { describe, it, expect } from "vitest";
import {
    toWikilink,
    toWikilinkWithAlias,
    estimateTokens,
    normalizeConceptName,
    cleanGeneratedMarkdown,
} from "../src/types";

describe("wikilinks", () => {
    it("wraps names", () => {
        expect(toWikilink("Marbury v. Madison")).toBe("[[Marbury v. Madison]]");
    });
    it("supports aliases", () => {
        expect(toWikilinkWithAlias("IRC § 721", "§ 721")).toBe("[[IRC § 721|§ 721]]");
    });
});

describe("estimateTokens", () => {
    it("returns 0 for empty input", () => {
        expect(estimateTokens("")).toBe(0);
    });
    it("counts ~4 ascii chars per token", () => {
        expect(estimateTokens("aaaa")).toBe(1);
        expect(estimateTokens("a".repeat(8))).toBe(2);
    });
    it("weighs Chinese characters more heavily than ascii", () => {
        const cn = estimateTokens("你好你好"); // 4 chinese chars
        const en = estimateTokens("abcd"); // 4 ascii chars
        expect(cn).toBeGreaterThan(en);
    });
});

describe("normalizeConceptName", () => {
    it("lowercases, strips articles, and collapses punctuation", () => {
        expect(normalizeConceptName("The Aggregate Principle")).toBe("aggregate principle");
    });
    it("treats punctuation differences as equal", () => {
        expect(normalizeConceptName("Adjusted-Basis")).toBe(normalizeConceptName("Adjusted Basis"));
    });
});

describe("cleanGeneratedMarkdown", () => {
    it("strips wrapping markdown code fences", () => {
        const input = "```markdown\n---\ntitle: x\n---\nbody\n```";
        expect(cleanGeneratedMarkdown(input)).toBe("---\ntitle: x\n---\nbody");
    });
    it("removes leading whitespace before frontmatter", () => {
        expect(cleanGeneratedMarkdown("   ---\nhi")).toBe("---\nhi");
    });
    it("leaves clean markdown untouched", () => {
        expect(cleanGeneratedMarkdown("---\nhi")).toBe("---\nhi");
    });
});
