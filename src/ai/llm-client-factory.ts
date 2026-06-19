import type { LawNoteSettings } from "../types";
import type { LLMClient } from "./llm-provider";
import { GeminiClient } from "./gemini-client";

/**
 * Build the LLM client for the current settings.
 *
 * Gemini is the only provider today; add a branch here (e.g. on a future
 * `settings.provider`) to support others without changing pipeline code.
 */
export function createLLMClient(settings: LawNoteSettings): LLMClient {
    return new GeminiClient(settings);
}
