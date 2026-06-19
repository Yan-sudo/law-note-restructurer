import type { Vault } from "obsidian";
import type { LLMClient } from "../ai/llm-provider";
import {
    buildRagPrompt,
    chunkMarkdown,
    rankBySimilarity,
    uniqueSources,
    type ChunkEmbedding,
    type IndexedChunk,
} from "./rag-core";

const EMBED_BATCH = 96;

export interface RagIndex {
    builtAt: string;
    chunks: ChunkEmbedding[];
}

export interface RagAnswer {
    answer: string;
    sources: string[];
}

/**
 * Build a retrieval index over every markdown note under `folderPrefix`:
 * chunk each note, embed the chunks in batches, and keep the vectors.
 */
export async function buildIndex(
    vault: Vault,
    client: LLMClient,
    folderPrefix: string,
    onProgress?: (done: number, total: number) => void
): Promise<RagIndex> {
    const files = vault
        .getMarkdownFiles()
        .filter((f) => f.path.startsWith(folderPrefix));

    const raw: IndexedChunk[] = [];
    for (const file of files) {
        const content = await vault.cachedRead(file);
        for (const text of chunkMarkdown(content)) {
            raw.push({ path: file.path, title: file.basename, text });
        }
    }

    const chunks: ChunkEmbedding[] = [];
    for (let i = 0; i < raw.length; i += EMBED_BATCH) {
        const batch = raw.slice(i, i + EMBED_BATCH);
        const embeddings = await client.embedTexts(batch.map((c) => c.text));
        batch.forEach((c, j) => chunks.push({ ...c, embedding: embeddings[j] ?? [] }));
        onProgress?.(Math.min(i + EMBED_BATCH, raw.length), raw.length);
    }

    return { builtAt: new Date().toISOString(), chunks };
}

export async function saveIndex(vault: Vault, path: string, index: RagIndex): Promise<void> {
    await vault.adapter.write(path, JSON.stringify(index));
}

export async function loadIndex(vault: Vault, path: string): Promise<RagIndex | null> {
    try {
        if (!(await vault.adapter.exists(path))) return null;
        const raw = await vault.adapter.read(path);
        const parsed = JSON.parse(raw) as RagIndex;
        if (!Array.isArray(parsed.chunks)) return null;
        return parsed;
    } catch {
        return null;
    }
}

/** Retrieve the most relevant chunks for `question` and have the model answer. */
export async function answerQuestion(
    client: LLMClient,
    index: RagIndex,
    question: string,
    topK = 6
): Promise<RagAnswer> {
    if (index.chunks.length === 0) {
        return { answer: "The notes index is empty. Rebuild it and try again.", sources: [] };
    }

    const [queryVec] = await client.embedTexts([question]);
    const ranked = rankBySimilarity(
        queryVec ?? [],
        index.chunks.map((c) => c.embedding),
        topK
    );
    const contexts = ranked.map((r) => index.chunks[r.index]);

    if (contexts.length === 0) {
        return { answer: "No relevant notes found for that question.", sources: [] };
    }

    const answer = await client.generate(buildRagPrompt(question, contexts));
    return { answer, sources: uniqueSources(contexts) };
}
