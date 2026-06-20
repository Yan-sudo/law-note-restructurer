import type { z } from "zod";
import { normalizeExtractedEntities, normalizeRelationshipMatrix } from "./schemas";

/**
 * Parse + normalize + Zod-validate a model's JSON response. Shared by every LLM
 * provider. With constrained decoding the JSON is usually already valid; the one
 * realistic failure left is truncation, which we repair before re-validating.
 */
export function parseAndValidate<T>(raw: string, schema: z.ZodSchema<T>): T {
    const json = extractJsonFromResponse(raw);
    try {
        return tryParseAndValidate(json, schema);
    } catch (firstError) {
        console.warn("[law-restructurer] JSON parse failed, attempting truncation repair...", firstError);
    }
    const repaired = repairTruncatedJson(removeTrailingCommas(json));
    return tryParseAndValidate(repaired, schema);
}

function normalizeData(data: Record<string, unknown>): void {
    if ("concepts" in data || "cases" in data || "principles" in data || "rules" in data) {
        normalizeExtractedEntities(data);
    }
    if ("entries" in data && Array.isArray(data.entries)) {
        normalizeRelationshipMatrix(data);
    }
}

function tryParseAndValidate<T>(json: string, schema: z.ZodSchema<T>): T {
    const parsed = JSON.parse(json);
    normalizeData(parsed);
    return schema.parse(parsed);
}

export function extractJsonFromResponse(text: string): string {
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
        return fenceMatch[1].trim();
    }
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        return text.substring(firstBrace, lastBrace + 1);
    }
    if (firstBrace !== -1) {
        return text.substring(firstBrace);
    }
    return text.trim();
}

/** Close unclosed brackets/strings and drop dangling key-value pairs. */
function repairTruncatedJson(json: string): string {
    let result = removeTrailingCommas(json.trim());

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
            if (stack.length > 0 && stack[stack.length - 1] === ch) stack.pop();
        }
    }

    if (inString) result += '"';
    result = result.replace(/,\s*"[^"]*":\s*$/, "");
    result = result.replace(/,\s*$/, "");
    while (stack.length > 0) {
        result += stack.pop();
    }
    return result;
}

function removeTrailingCommas(json: string): string {
    return json.replace(/,\s*([\]}])/g, "$1");
}
