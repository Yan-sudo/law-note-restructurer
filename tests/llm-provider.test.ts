import { describe, it, expect } from "vitest";
import type { LLMClient } from "../src/ai/llm-provider";
import { generateOutlinePage } from "../src/generators/outline-generator";
import { DEFAULT_SETTINGS, type ExtractedEntities } from "../src/types";

const CANNED = "```markdown\n---\ntags:\n  - law/outline\n---\n# Outline\n```";

/** A non-Gemini implementation, proving the pipeline depends only on LLMClient. */
class FakeLLM implements LLMClient {
    lastPrompt = "";

    async generate(prompt: string): Promise<string> {
        this.lastPrompt = prompt;
        return CANNED;
    }
    async generateStructured<T>(): Promise<T> {
        throw new Error("unused in this test");
    }
    async generateStreaming(
        prompt: string,
        onChunk: (text: string, accumulated: string) => void,
    ): Promise<string> {
        this.lastPrompt = prompt;
        onChunk(CANNED, CANNED);
        return CANNED;
    }
    async generateStructuredStreaming<T>(): Promise<T> {
        throw new Error("unused in this test");
    }
    async embedTexts(texts: string[]): Promise<number[][]> {
        return texts.map(() => [0, 0, 0]);
    }
    abort(): void {}
    getTotalTokensUsed(): number {
        return 42;
    }
}

function emptyEntities(): ExtractedEntities {
    return {
        concepts: [],
        cases: [],
        principles: [],
        rules: [],
        metadata: {
            sourceDocuments: [],
            extractionTimestamp: new Date(0).toISOString(),
            modelUsed: "fake",
            totalTokensUsed: 0,
        },
    };
}

describe("LLMClient abstraction", () => {
    it("lets a generator run against a fake client and cleans the output", async () => {
        const fake = new FakeLLM();

        const out = await generateOutlinePage(fake, DEFAULT_SETTINGS, emptyEntities());

        // The generator built a real prompt and handed it to our fake.
        expect(fake.lastPrompt).toContain("OUTLINE");
        // Wrapping code fences are stripped; frontmatter is at the top.
        expect(out.startsWith("---")).toBe(true);
        expect(out).not.toContain("```");
    });
});
