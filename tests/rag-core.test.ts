import { describe, it, expect } from "vitest";
import {
    stripFrontmatter,
    chunkMarkdown,
    rankBySimilarity,
    buildRagPrompt,
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
});
