import { GoogleGenAI, type Schema } from "@google/genai";
import { Notice } from "obsidian";
import type { z } from "zod";
import { normalizeExtractedEntities, normalizeRelationshipMatrix } from "./schemas";
import type { LawNoteSettings } from "../types";
import type { LLMClient } from "./llm-provider";

const MAX_OUTPUT_TOKENS = 65536;
const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";

/** Subset of the SDK's usage metadata we care about. */
interface UsageLike {
    totalTokenCount?: number;
}

export class GeminiClient implements LLMClient {
    private ai: GoogleGenAI;
    private settings: LawNoteSettings;
    private abortController: AbortController | null = null;
    private totalTokensUsed = 0;

    constructor(settings: LawNoteSettings) {
        this.settings = settings;
        this.ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
    }

    /** Cumulative tokens billed across every call made by this client. */
    getTotalTokensUsed(): number {
        return this.totalTokensUsed;
    }

    /** Build the shared generation config (temperature, output cap, JSON mode, thinking). */
    private buildConfig(jsonMode: boolean, responseSchema?: Schema): Record<string, unknown> {
        const config: Record<string, unknown> = {
            temperature: this.settings.temperature,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
        };
        if (jsonMode) {
            config.responseMimeType = "application/json";
            // Constrained decoding: force the model to emit conforming JSON.
            if (responseSchema) config.responseSchema = responseSchema;
        }
        // Gemini 2.5 thinking budget. -1 leaves the model default untouched;
        // 0 disables reasoning (cheapest, Flash only); positive caps it.
        if ((this.settings.thinkingBudget ?? -1) >= 0) {
            config.thinkingConfig = { thinkingBudget: this.settings.thinkingBudget };
        }
        return config;
    }

    private recordUsage(usage: UsageLike | undefined): void {
        if (usage?.totalTokenCount) {
            this.totalTokensUsed += usage.totalTokenCount;
        }
    }

    async generate(prompt: string): Promise<string> {
        return this.generateWithRetry(prompt, 3, false);
    }

    async generateStructured<T>(
        prompt: string,
        schema: z.ZodSchema<T>,
        responseSchema?: Schema
    ): Promise<T> {
        const raw = await this.generateWithRetry(prompt, 3, true, responseSchema);
        return parseAndValidate(raw, schema);
    }

    async generateStreaming(
        prompt: string,
        onChunk: (text: string, accumulated: string) => void,
        jsonMode: boolean = false,
        responseSchema?: Schema
    ): Promise<string> {
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            this.abortController = new AbortController();
            let accumulated = "";

            try {
                const config = this.buildConfig(jsonMode, responseSchema);

                const response = await this.ai.models.generateContentStream({
                    model: this.settings.modelName,
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    config,
                });

                let lastUsage: UsageLike | undefined;
                for await (const chunk of response) {
                    if (this.abortController?.signal.aborted) {
                        throw new Error("Request aborted by user");
                    }
                    const text = chunk.text ?? "";
                    accumulated += text;
                    if (chunk.usageMetadata) lastUsage = chunk.usageMetadata;
                    onChunk(text, accumulated);
                }

                this.recordUsage(lastUsage);
                return accumulated;
            } catch (error: unknown) {
                lastError = error instanceof Error ? error : new Error(String(error));
                const msg = lastError.message.toLowerCase();

                // User abort: don't retry
                if (msg.includes("aborted")) throw lastError;
                // Auth: don't retry
                if (msg.includes("401") || msg.includes("api key")) throw lastError;
                // Safety: don't retry
                if (msg.includes("safety") || msg.includes("blocked")) throw lastError;

                // Retryable: rate limit, server error, network
                if (attempt < maxRetries) {
                    const isRateLimit = msg.includes("429") || msg.includes("rate limit") || msg.includes("resource exhausted");
                    const isServerError = msg.includes("500") || msg.includes("503") || msg.includes("internal") || msg.includes("unavailable") || msg.includes("overloaded");
                    const waitMs = isRateLimit
                        ? Math.pow(2, attempt) * 1000 + Math.random() * 1000
                        : isServerError
                            ? Math.pow(2, attempt) * 2000 + Math.random() * 1000
                            : 2000;
                    const label = isRateLimit ? "Rate limited" : isServerError ? "Server error" : "Error";
                    new Notice(`${label}. Retrying in ${Math.ceil(waitMs / 1000)}s... (${attempt}/${maxRetries})`);
                    await sleep(waitMs);
                    continue;
                }
            } finally {
                this.abortController = null;
            }
        }

        throw lastError ?? new Error("Streaming failed after retries");
    }

    async generateStructuredStreaming<T>(
        prompt: string,
        schema: z.ZodSchema<T>,
        onChunk: (text: string, accumulated: string) => void,
        responseSchema?: Schema
    ): Promise<T> {
        const raw = await this.generateStreaming(prompt, onChunk, true, responseSchema);
        return parseAndValidate(raw, schema);
    }

    async embedTexts(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) return [];
        const response = await this.ai.models.embedContent({
            model: this.settings.embeddingModel || DEFAULT_EMBEDDING_MODEL,
            contents: texts,
        });
        return (response.embeddings ?? []).map((e) => e.values ?? []);
    }

    abort(): void {
        this.abortController?.abort();
    }

    private async generateWithRetry(
        prompt: string,
        maxRetries: number,
        jsonMode: boolean,
        responseSchema?: Schema
    ): Promise<string> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const config = this.buildConfig(jsonMode, responseSchema);

                const response = await this.ai.models.generateContent({
                    model: this.settings.modelName,
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    config,
                });

                this.recordUsage(response.usageMetadata);

                const text = response.text;
                if (!text) {
                    throw new Error("Empty response from Gemini");
                }
                return text;
            } catch (error: unknown) {
                lastError =
                    error instanceof Error ? error : new Error(String(error));
                const msg = lastError.message.toLowerCase();

                // Rate limit: backoff
                if (msg.includes("429") || msg.includes("rate limit") || msg.includes("resource exhausted")) {
                    const waitMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                    new Notice(`Rate limited. Retrying in ${Math.ceil(waitMs / 1000)}s... (${attempt}/${maxRetries})`);
                    await sleep(waitMs);
                    continue;
                }

                // Auth error: don't retry
                if (msg.includes("401") || msg.includes("api key") || msg.includes("unauthorized")) {
                    throw new Error("Invalid Gemini API key. Check Settings.");
                }

                // Safety filter: don't retry
                if (msg.includes("safety") || msg.includes("blocked")) {
                    throw new Error("Content blocked by safety filters. Try different source material.");
                }

                // Google server errors (500, 503, INTERNAL, UNAVAILABLE): backoff + retry
                if (
                    msg.includes("500") || msg.includes("503") ||
                    msg.includes("internal") || msg.includes("unavailable") ||
                    msg.includes("server error") || msg.includes("overloaded")
                ) {
                    if (attempt < maxRetries) {
                        const waitMs = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
                        new Notice(`Google server error. Retrying in ${Math.ceil(waitMs / 1000)}s... (${attempt}/${maxRetries})`);
                        await sleep(waitMs);
                        continue;
                    }
                }

                // Network: retry
                if (msg.includes("network") || msg.includes("fetch") || msg.includes("econnrefused")) {
                    if (attempt < maxRetries) {
                        new Notice(`Network error. Retrying... (${attempt}/${maxRetries})`);
                        await sleep(2000);
                        continue;
                    }
                }

                // Other: retry
                if (attempt < maxRetries) {
                    new Notice(`Error: ${lastError.message.slice(0, 100)}. Retrying... (${attempt}/${maxRetries})`);
                    await sleep(1000);
                    continue;
                }
            }
        }

        throw lastError ?? new Error("Unknown error");
    }
}

function normalizeData(data: Record<string, unknown>): void {
    // Detect type by shape and normalize accordingly
    if ("concepts" in data || "cases" in data || "principles" in data || "rules" in data) {
        normalizeExtractedEntities(data);
    }
    // Detect relationship matrix (entries alone is enough — casesInOrder may be missing from truncation)
    if ("entries" in data && Array.isArray(data.entries)) {
        normalizeRelationshipMatrix(data);
    }
}

function tryParseAndValidate<T>(json: string, schema: z.ZodSchema<T>): T {
    const parsed = JSON.parse(json);
    normalizeData(parsed);
    return schema.parse(parsed);
}

function parseAndValidate<T>(raw: string, schema: z.ZodSchema<T>): T {
    const json = extractJsonFromResponse(raw);

    // With `responseSchema` constrained decoding the model emits syntactically
    // valid, schema-conforming JSON, so the only realistic failure mode left is
    // truncation when the output hits `maxOutputTokens`. That is the one case we
    // still repair (close any open brackets/strings) before re-validating.
    try {
        return tryParseAndValidate(json, schema);
    } catch (firstError) {
        console.warn("[law-restructurer] JSON parse failed, attempting truncation repair...", firstError);
    }

    const repaired = repairTruncatedJson(removeTrailingCommas(json));
    return tryParseAndValidate(repaired, schema);
}

function extractJsonFromResponse(text: string): string {
    // Try markdown code fence
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
        return fenceMatch[1].trim();
    }

    // Try raw JSON boundaries
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return text.substring(firstBrace, lastBrace + 1);
    }

    // If we only found an opening brace (truncated), take everything from it
    if (firstBrace !== -1) {
        return text.substring(firstBrace);
    }

    return text.trim();
}

/**
 * Repair truncated JSON by:
 * 1. Removing trailing comma before adding closers
 * 2. Closing all unclosed brackets/braces
 * 3. Closing unclosed strings
 */
function repairTruncatedJson(json: string): string {
    let result = json.trim();

    // If it ends with a complete }, it might just have trailing commas
    result = removeTrailingCommas(result);

    // Check if brackets are balanced
    const stack: string[] = [];
    let inString = false;
    let escape = false;

    for (let i = 0; i < result.length; i++) {
        const ch = result[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (ch === "\\") {
            escape = true;
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            continue;
        }

        if (inString) continue;

        if (ch === "{") stack.push("}");
        else if (ch === "[") stack.push("]");
        else if (ch === "}" || ch === "]") {
            if (stack.length > 0 && stack[stack.length - 1] === ch) {
                stack.pop();
            }
        }
    }

    // If we're inside an unclosed string, close it
    if (inString) {
        result += '"';
    }

    // Remove any trailing incomplete key-value pair
    // e.g., `"key": "some truncated val` -> already closed string above
    // e.g., `"key": ` -> remove dangling key
    result = result.replace(/,\s*"[^"]*":\s*$/, "");
    result = result.replace(/,\s*$/, "");

    // Close all unclosed brackets/braces in reverse order
    while (stack.length > 0) {
        result += stack.pop();
    }

    return result;
}

function removeTrailingCommas(json: string): string {
    // Remove trailing commas before } or ]
    return json.replace(/,\s*([\]}])/g, "$1");
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
