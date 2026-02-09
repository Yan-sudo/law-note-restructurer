import { GoogleGenAI } from "@google/genai";
import { Notice } from "obsidian";
import type { z } from "zod";
import { normalizeExtractedEntities, normalizeRelationshipMatrix } from "./schemas";
import type { LawNoteSettings } from "../types";

export class GeminiClient {
    private ai: GoogleGenAI;
    private settings: LawNoteSettings;
    private abortController: AbortController | null = null;

    constructor(settings: LawNoteSettings) {
        this.settings = settings;
        this.ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
    }

    async generate(prompt: string): Promise<string> {
        return this.generateWithRetry(prompt, 3, false);
    }

    async generateStructured<T>(
        prompt: string,
        schema: z.ZodSchema<T>
    ): Promise<T> {
        const raw = await this.generateWithRetry(prompt, 3, true);
        return parseAndValidate(raw, schema);
    }

    async generateStreaming(
        prompt: string,
        onChunk: (text: string, accumulated: string) => void,
        jsonMode: boolean = false
    ): Promise<string> {
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            this.abortController = new AbortController();
            let accumulated = "";

            try {
                const config: Record<string, unknown> = {
                    temperature: this.settings.temperature,
                    maxOutputTokens: 65536,
                };
                if (jsonMode) {
                    config.responseMimeType = "application/json";
                }

                const response = await this.ai.models.generateContentStream({
                    model: this.settings.modelName,
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    config,
                });

                for await (const chunk of response) {
                    if (this.abortController?.signal.aborted) {
                        throw new Error("Request aborted by user");
                    }
                    const text = chunk.text ?? "";
                    accumulated += text;
                    onChunk(text, accumulated);
                }

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
        onChunk: (text: string, accumulated: string) => void
    ): Promise<T> {
        const raw = await this.generateStreaming(prompt, onChunk, true);
        return parseAndValidate(raw, schema);
    }

    abort(): void {
        this.abortController?.abort();
    }

    private async generateWithRetry(
        prompt: string,
        maxRetries: number,
        jsonMode: boolean
    ): Promise<string> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const config: Record<string, unknown> = {
                    temperature: this.settings.temperature,
                    maxOutputTokens: 65536,
                };
                if (jsonMode) {
                    config.responseMimeType = "application/json";
                }

                const response = await this.ai.models.generateContent({
                    model: this.settings.modelName,
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    config,
                });

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
    if ("concepts" in data || "cases" in data) {
        normalizeExtractedEntities(data);
    }
    if ("entries" in data && "casesInOrder" in data) {
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

    // First attempt: parse + normalize + validate
    try {
        return tryParseAndValidate(json, schema);
    } catch (firstError) {
        console.warn("[law-restructurer] JSON parse failed, attempting repair...", firstError);
    }

    // Second attempt: fix unescaped quotes/control chars
    const sanitized = fixUnescapedQuotes(json);
    try {
        return tryParseAndValidate(sanitized, schema);
    } catch (secondError) {
        console.warn("[law-restructurer] Sanitized JSON failed, trying truncation repair...", secondError);
    }

    // Third attempt: repair truncated JSON
    const repaired = repairTruncatedJson(sanitized);
    try {
        return tryParseAndValidate(repaired, schema);
    } catch (thirdError) {
        console.warn("[law-restructurer] Repaired JSON also failed, trying aggressive repair...", thirdError);
    }

    // Fourth attempt: aggressive repair
    const aggressiveRepaired = aggressiveRepairJson(sanitized);
    return tryParseAndValidate(aggressiveRepaired, schema);
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

/**
 * More aggressive repair: find the last valid array/object closure point
 * and truncate there, then close remaining brackets.
 */
function aggressiveRepairJson(json: string): string {
    let result = json.trim();

    // Find the last position where a complete JSON element ends
    // (after a }, ], ", number, true, false, null)
    let lastGoodPos = -1;
    let depth = 0;
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
            if (!inString) {
                lastGoodPos = i; // end of string
            }
            continue;
        }

        if (inString) continue;

        if (ch === "{" || ch === "[") {
            depth++;
        } else if (ch === "}" || ch === "]") {
            depth--;
            lastGoodPos = i;
        }
    }

    // Truncate at the last good position if we're in a broken state
    if (inString && lastGoodPos > 0) {
        result = result.substring(0, lastGoodPos + 1);
    }

    // Remove any trailing comma or incomplete element
    result = result.replace(/,\s*$/, "");

    // Now close remaining brackets
    const stack: string[] = [];
    inString = false;
    escape = false;

    for (let i = 0; i < result.length; i++) {
        const ch = result[i];
        if (escape) { escape = false; continue; }
        if (ch === "\\") { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") stack.push("}");
        else if (ch === "[") stack.push("]");
        else if (ch === "}" || ch === "]") {
            if (stack.length > 0 && stack[stack.length - 1] === ch) {
                stack.pop();
            }
        }
    }

    while (stack.length > 0) {
        result += stack.pop();
    }

    return result;
}

/**
 * Fix unescaped quotes and control characters inside JSON string values.
 * Gemini sometimes produces: "facts": "The court said "hello" to..."
 * which breaks JSON.parse because the internal quotes aren't escaped.
 */
function fixUnescapedQuotes(json: string): string {
    const result: string[] = [];
    let i = 0;
    let inString = false;
    let escaped = false;

    while (i < json.length) {
        const ch = json[i];

        if (escaped) {
            result.push(ch);
            escaped = false;
            i++;
            continue;
        }

        if (ch === "\\") {
            result.push(ch);
            escaped = true;
            i++;
            continue;
        }

        if (ch === '"') {
            if (!inString) {
                inString = true;
                result.push(ch);
            } else {
                // Is this a closing quote or an unescaped internal quote?
                // Look at what follows (skip whitespace)
                const rest = json.slice(i + 1);
                const nextMatch = rest.match(/^\s*([,\]}\n:]|$)/);
                if (nextMatch) {
                    // Followed by structural char → closing quote
                    inString = false;
                    result.push(ch);
                } else {
                    // Internal unescaped quote → escape it
                    result.push('\\"');
                }
            }
        } else if (inString && (ch === "\n" || ch === "\r" || ch === "\t")) {
            // Escape literal control characters inside strings
            if (ch === "\n") result.push("\\n");
            else if (ch === "\r") result.push("\\r");
            else if (ch === "\t") result.push("\\t");
        } else {
            result.push(ch);
        }
        i++;
    }
    return result.join("");
}

function removeTrailingCommas(json: string): string {
    // Remove trailing commas before } or ]
    return json.replace(/,\s*([\]}])/g, "$1");
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
