import { describe, it, expect } from "vitest";
import {
    stripFrontmatter,
    chunkMarkdown,
    isIndexableNote,
    rankBySimilarity,
    buildRagPrompt,
    buildPrompt,
    uniqueSources,
    type IndexedChunk,
} from "../src/rag/rag-core";

const MD = "---\ntags: x\n---\n\nAlpha paragraph.\n\nBeta paragraph.\n\nGamma paragraph.";

describe("stripFrontmatter / chunkMarkdown", () => {
    it("removes YAML frontmatter", () => {
        expect(stripFrontmatter(MD).startsWith("Alpha")).toBe(true);
        expect(stripFrontmatter(MD)).not.toContain("tags");
    });

    it("splits on paragraph boundaries when over the size budget", () => {
        const chunks = chunkMarkdown(MD, 20);
        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toBe("Alpha paragraph.");
        expect(chunks.join("")).not.toContain("tags");
    });

    it("packs paragraphs together under a large budget", () => {
        const chunks = chunkMarkdown(MD, 1000);
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toContain("Gamma paragraph.");
    });
});

describe("isIndexableNote", () => {
    const longBody = "This is a substantive concept definition. ".repeat(5);

    it("indexes a normal pipeline concept page", () => {
        const md = `---\ntags:\n  - law/concept\ngenerated-by: law-note-restructurer\n---\n\n# Estoppel\n\n${longBody}`;
        expect(isIndexableNote(md)).toBe(true);
    });

    it("skips link-resolver reference pages (frontmatter has a source field)", () => {
        const md = `---\ntags:\n  - law/case\nsource: courtlistener\nsource-url: "http://x"\n---\n\n# Some v. Case\n\n${longBody}`;
        expect(isIndexableNote(md)).toBe(false);
    });

    it("skips US/CN stub placeholder pages", () => {
        const us = `---\nsource: stub\n---\n\n# Foo v. Bar\n\n> [!warning] Auto-fetch unavailable\n\n## Holding\n\n*To be filled in*`;
        const cn = `---\ntags:\n  - law/cn-case\n---\n\n# 某案\n\n> [!warning] 自动获取不可用\n\n## 裁判要旨\n\n*待填写*`;
        expect(isIndexableNote(us)).toBe(false);
        expect(isIndexableNote(cn)).toBe(false);
    });

    it("skips near-empty notes", () => {
        expect(isIndexableNote("---\ntags: x\n---\n\nTBD")).toBe(false);
    });
});

describe("rankBySimilarity", () => {
    it("returns the most similar indices first, dropping zero-similarity hits", () => {
        const ranked = rankBySimilarity([1, 0], [
            [1, 0],
            [0, 1],
            [0.9, 0.1],
        ], 3);
        expect(ranked.map((r) => r.index)).toEqual([0, 2]);
    });
});

describe("buildRagPrompt / uniqueSources", () => {
    const contexts: IndexedChunk[] = [
        { path: "p1.md", title: "Promissory Estoppel", text: "a promise relied upon" },
        { path: "p2.md", title: "Promissory Estoppel", text: "reliance must be reasonable" },
    ];

    it("embeds the question, source links, and note text in the prompt", () => {
        const prompt = buildRagPrompt("What is reliance?", contexts);
        expect(prompt).toContain("What is reliance?");
        expect(prompt).toContain("[[Promissory Estoppel]]");
        expect(prompt).toContain("reliance must be reasonable");
    });

    it("dedupes source titles", () => {
        expect(uniqueSources(contexts)).toEqual(["Promissory Estoppel"]);
    });

    it("includes recent conversation history for follow-ups", () => {
        const prompt = buildRagPrompt("And its exceptions?", contexts, [
            { question: "What is promissory estoppel?", answer: "A promise relied upon is enforceable." },
        ]);
        expect(prompt).toContain("Conversation so far");
        expect(prompt).toContain("What is promissory estoppel?");
    });

    it("switches framing by mode", () => {
        const irac = buildPrompt("irac", "Facts: A promised B…", contexts);
        expect(irac).toContain("IRAC");
        expect(irac).toContain("# Fact pattern");

        const compare = buildPrompt("compare", "consideration", contexts);
        expect(compare).toContain("United States");
        expect(compare).toContain("China");
    });

    it("encodes the requested answer length", () => {
        expect(buildPrompt("qa", "x", contexts, [], "brief")).toContain("BRIEF");
        expect(buildPrompt("qa", "x", contexts, [], "detailed")).toContain("THOROUGH");
    });
});
