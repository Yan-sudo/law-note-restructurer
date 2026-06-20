import type { Vault } from "obsidian";
import type { LLMClient } from "../ai/llm-provider";
import type { Embedder } from "../ai/embedder";
import {
    buildPrompt,
    chunkMarkdown,
    isIndexableNote,
    rankBySimilarity,
    uniqueSources,
    type AskLength,
    type AskMode,
    type ChatTurn,
    type ChunkEmbedding,
} from "./rag-core";

const EMBED_BATCH = 96;
/** Small pause between embedding batches to stay under rate limits. */
const BATCH_PAUSE_MS = 300;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** One source file's last-modified time plus its embedded chunks. */
interface FileEntry {
    mtime: number;
    chunks: ChunkEmbedding[];
}

export interface RagIndex {
    builtAt: string;
    /** Embedder identity (provider:model); a mismatch forces a full rebuild. */
    signature: string;
    /** Keyed by vault path so unchanged files can be reused across rebuilds. */
    files: Record<string, FileEntry>;
}

export interface RagAnswer {
    answer: string;
    sources: string[];
}

function allChunks(index: RagIndex): ChunkEmbedding[] {
    return Object.values(index.files).flatMap((f) => f.chunks);
}

export function indexChunkCount(index: RagIndex): number {
    return allChunks(index).length;
}

/**
 * Build or **incrementally update** the index over every markdown note under
 * `folderPrefix`. When `existing` is passed, files whose mtime is unchanged
 * keep their existing embeddings; only new/modified files are re-embedded, and
 * deleted files drop out. Pass `existing = null` to force a full rebuild.
 */
export async function buildIndex(
    vault: Vault,
    embedder: Embedder,
    folderPrefix: string,
    signature: string,
    existing?: RagIndex | null,
    onProgress?: (done: number, total: number) => void
): Promise<RagIndex> {
    // Only reuse a prior index built with the same embedder (same vector space).
    const prior = existing && existing.signature === signature ? existing : null;
    const files = vault.getMarkdownFiles().filter((f) => f.path.startsWith(folderPrefix));

    const result: Record<string, FileEntry> = {};
    const pending: { path: string; title: string; text: string }[] = [];

    for (const file of files) {
        const mtime = file.stat.mtime;
        const prev = prior?.files[file.path];
        if (prev && prev.mtime === mtime) {
            result[file.path] = prev; // unchanged → reuse embeddings, no API call
            continue;
        }
        const content = await vault.cachedRead(file);
        // Skip stub / reference pages so they don't dilute retrieval.
        if (!isIndexableNote(content)) continue;
        result[file.path] = { mtime, chunks: [] };
        for (const text of chunkMarkdown(content)) {
            pending.push({ path: file.path, title: file.basename, text });
        }
    }

    for (let i = 0; i < pending.length; i += EMBED_BATCH) {
        const batch = pending.slice(i, i + EMBED_BATCH);
        const embeddings = await embedder.embedTexts(batch.map((c) => c.text));
        batch.forEach((c, j) =>
            result[c.path].chunks.push({ ...c, embedding: embeddings[j] ?? [] })
        );
        onProgress?.(Math.min(i + EMBED_BATCH, pending.length), pending.length);
        if (i + EMBED_BATCH < pending.length) await sleep(BATCH_PAUSE_MS);
    }

    return { builtAt: new Date().toISOString(), signature, files: result };
}

export async function saveIndex(vault: Vault, path: string, index: RagIndex): Promise<void> {
    await vault.adapter.write(path, JSON.stringify(index));
}

export async function loadIndex(vault: Vault, path: string): Promise<RagIndex | null> {
    try {
        if (!(await vault.adapter.exists(path))) return null;
        const parsed = JSON.parse(await vault.adapter.read(path)) as RagIndex;
        // Reject anything that isn't the current { files } shape (e.g. an older
        // format) so it gets rebuilt cleanly.
        if (!parsed || typeof parsed.files !== "object" || parsed.files === null) return null;
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Retrieve the most relevant chunks for `question` and have the model answer.
 * `embedder` embeds the query (must match the index's embedder); `generator`
 * writes the answer.
 */
export async function answerQuestion(
    generator: LLMClient,
    embedder: Embedder,
    index: RagIndex,
    question: string,
    history: ChatTurn[] = [],
    mode: AskMode = "qa",
    topK = 6,
    onChunk?: (text: string, accumulated: string) => void,
    length: AskLength = "standard"
): Promise<RagAnswer> {
    const chunks = allChunks(index);
    if (chunks.length === 0) {
        return {
            answer: "The notes index is empty. Generate some notes first, then ask again.",
            sources: [],
        };
    }

    const [queryVec] = await embedder.embedTexts([question]);
    const ranked = rankBySimilarity(
        queryVec ?? [],
        chunks.map((c) => c.embedding),
        topK
    );
    const contexts = ranked.map((r) => chunks[r.index]);

    if (contexts.length === 0) {
        return { answer: "No relevant notes found in this folder for that topic.", sources: [] };
    }

    const prompt = buildPrompt(mode, question, contexts, history, length);
    const answer = onChunk
        ? await generator.generateStreaming(prompt, onChunk)
        : await generator.generate(prompt);
    return { answer, sources: uniqueSources(contexts) };
}
