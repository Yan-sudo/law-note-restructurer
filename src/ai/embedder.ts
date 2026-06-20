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
    /** Sub-batch size, so a large concept list doesn't become one huge request. */
    private static readonly BATCH = 64;

    private baseUrl: string;
    private model: string;

    constructor(settings: LawNoteSettings) {
        this.baseUrl = (settings.ollamaUrl || "http://localhost:11434").replace(/\/+$/, "");
        this.model = settings.ollamaEmbeddingModel || "nomic-embed-text";
    }

    async embedTexts(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) return [];
        const out: number[][] = [];
        for (let i = 0; i < texts.length; i += OllamaEmbedder.BATCH) {
            out.push(...(await this.embedBatch(texts.slice(i, i + OllamaEmbedder.BATCH))));
        }
        return out;
    }

    private async embedBatch(batch: string[]): Promise<number[][]> {
        const data = await this.post(batch);
        if (!Array.isArray(data.embeddings) || data.embeddings.length !== batch.length) {
            throw new Error(
                `Ollama returned ${data.embeddings?.length ?? 0} vectors for ${batch.length} inputs. ` +
                    `Is "${this.model}" an embedding model? (try \`ollama pull nomic-embed-text\`)`
            );
        }
        return data.embeddings;
    }

    private async post(batch: string[]): Promise<{ embeddings?: number[][] }> {
        try {
            const res = await requestUrl({
                url: `${this.baseUrl}/api/embed`,
                method: "POST",
                contentType: "application/json",
                body: JSON.stringify({ model: this.model, input: batch }),
            });
            return res.json as { embeddings?: number[][] };
        } catch (error) {
            throw new Error(this.troubleshoot(error));
        }
    }

    /** Turn a raw request failure into actionable guidance for the common gotchas. */
    private troubleshoot(error: unknown): string {
        const raw = error instanceof Error ? error.message : String(error);
        return (
            `Ollama embedding failed at ${this.baseUrl} (model "${this.model}"). Checklist:\n` +
            `1) Ollama is running (\`ollama serve\` / the app).\n` +
            `2) Model pulled: \`ollama pull ${this.model}\`.\n` +
            `3) If you see 403/CORS, allow Obsidian: set OLLAMA_ORIGINS=* (or app://obsidian.md) and restart Ollama.\n` +
            `4) Old Ollama? Update it — /api/embed requires a recent version.\n[${raw}]`
        );
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
