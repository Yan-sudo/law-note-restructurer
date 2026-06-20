import { requestUrl } from "obsidian";
import type { LawNoteSettings } from "../types";
import { GeminiClient } from "./gemini-client";

/** Anything that can turn texts into vectors (decoupled from text generation). */
export interface Embedder {
    embedTexts(texts: string[]): Promise<number[][]>;
}

/**
 * Local, offline embeddings via an Ollama server — no API key, no quota, and
 * notes never leave the machine. Requires Ollama running with the model pulled
 * (e.g. `ollama pull nomic-embed-text`).
 */
export class OllamaEmbedder implements Embedder {
    private baseUrl: string;
    private model: string;

    constructor(settings: LawNoteSettings) {
        this.baseUrl = (settings.ollamaUrl || "http://localhost:11434").replace(/\/+$/, "");
        this.model = settings.ollamaEmbeddingModel || "nomic-embed-text";
    }

    async embedTexts(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) return [];
        try {
            const res = await requestUrl({
                url: `${this.baseUrl}/api/embed`,
                method: "POST",
                contentType: "application/json",
                body: JSON.stringify({ model: this.model, input: texts }),
            });
            const data = res.json as { embeddings?: number[][] };
            return data.embeddings ?? [];
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            throw new Error(
                `Ollama embedding failed at ${this.baseUrl} (model "${this.model}"). ` +
                    `Is Ollama running and the model pulled? Try: ollama pull ${this.model}. [${msg}]`
            );
        }
    }
}

/** Build the embedder for the current settings (Gemini cloud or local Ollama). */
export function createEmbedder(settings: LawNoteSettings): Embedder {
    if (settings.embeddingProvider === "ollama") return new OllamaEmbedder(settings);
    return new GeminiClient(settings);
}

/**
 * A short signature of the active embedding config. The index stores it so that
 * switching provider/model (which changes vector dimensions) forces a rebuild
 * instead of mixing incompatible vectors.
 */
export function embedderSignature(settings: LawNoteSettings): string {
    return settings.embeddingProvider === "ollama"
        ? `ollama:${settings.ollamaEmbeddingModel || "nomic-embed-text"}`
        : `gemini:${settings.embeddingModel || "gemini-embedding-001"}`;
}
