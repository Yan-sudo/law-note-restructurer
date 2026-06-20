import type { LawNoteSettings } from "../types";
import type { LLMClient } from "./llm-provider";
import { GeminiClient } from "./gemini-client";
import { OllamaClient } from "./ollama-client";

/** Build the generation client for the current settings (Gemini cloud or local Ollama). */
export function createLLMClient(settings: LawNoteSettings): LLMClient {
    if (settings.generationProvider === "ollama") return new OllamaClient(settings);
    return new GeminiClient(settings);
}
