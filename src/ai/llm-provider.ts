import type { Schema } from "@google/genai";
import type { z } from "zod";

/**
 * Provider-agnostic contract for the LLM the pipeline talks to.
 *
 * Pipeline steps and generators depend on this interface rather than the
 * concrete `GeminiClient`, so the underlying model can be swapped (or replaced
 * by a fake in tests) without touching pipeline code.
 *
 * `responseSchema` is a JSON-schema-shaped structured-output contract. It is
 * typed against the Gemini SDK's `Schema` today (a type-only import, erased at
 * build time); other providers accept the same JSON-schema object.
 */
export interface LLMClient {
    /** Single-shot free-text generation. */
    generate(prompt: string): Promise<string>;

    /** Single-shot generation validated against a Zod schema. */
    generateStructured<T>(
        prompt: string,
        schema: z.ZodSchema<T>,
        responseSchema?: Schema,
    ): Promise<T>;

    /** Streaming free-text/JSON generation; `onChunk` receives incremental text. */
    generateStreaming(
        prompt: string,
        onChunk: (text: string, accumulated: string) => void,
        jsonMode?: boolean,
        responseSchema?: Schema,
    ): Promise<string>;

    /** Streaming generation validated against a Zod schema once complete. */
    generateStructuredStreaming<T>(
        prompt: string,
        schema: z.ZodSchema<T>,
        onChunk: (text: string, accumulated: string) => void,
        responseSchema?: Schema,
    ): Promise<T>;

    /** Embed a batch of texts; `result[i]` is the vector for `texts[i]`. */
    embedTexts(texts: string[]): Promise<number[][]>;

    /** Abort the in-flight request, if any. */
    abort(): void;

    /** Cumulative tokens billed across every call made by this client. */
    getTotalTokensUsed(): number;
}
