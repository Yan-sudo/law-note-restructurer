import type { LawNoteSettings } from "../types";

/**
 * A tiny, ballpark cost meter. Token counts come straight from the API's usage
 * metadata; prices are approximate blended (input+output) Gemini rates and are
 * only meant to give the student a rough sense of spend — not an invoice.
 */

/** Approximate blended Gemini price in USD per 1M tokens. */
const PRICE_PER_MTOK: Record<string, number> = {
    "gemini-2.5-pro": 5,
    "gemini-2.5-flash": 0.3,
    "gemini-2.5-flash-lite": 0.1,
};

const DEFAULT_RATE = 0.3;

/** A mutable accumulator threaded through the pipeline steps. */
export interface TokenUsage {
    tokens: number;
}

/** Local generation (Ollama) has no API cost. */
export function isLocalGeneration(settings: LawNoteSettings): boolean {
    return settings.generationProvider === "ollama";
}

/** Approximate USD cost of `tokens` for the given Gemini model. */
export function estimateCostUSD(model: string, tokens: number): number {
    const rate = PRICE_PER_MTOK[model] ?? DEFAULT_RATE;
    return (tokens / 1_000_000) * rate;
}

export function formatUSD(usd: number): string {
    if (usd <= 0) return "$0.00";
    return usd < 0.01 ? "<$0.01" : `$${usd.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
    return String(Math.max(0, Math.round(tokens)));
}

/** One-line usage summary, e.g. "12.3K tokens · ~$0.02" or "8.0K tokens · local — free". */
export function usageSummary(settings: LawNoteSettings, tokens: number): string {
    if (isLocalGeneration(settings)) {
        return `${formatTokens(tokens)} tokens · local — free`;
    }
    return `${formatTokens(tokens)} tokens · ~${formatUSD(estimateCostUSD(settings.modelName, tokens))}`;
}
