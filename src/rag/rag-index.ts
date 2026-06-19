import type { Vault } from "obsidian";
import type { LLMClient } from "../ai/llm-provider";
import {
    buildRagPrompt,
    chunkMarkdown,
    rankBySimilarity,
    uniqueSources,
    type ChunkEmbedding,
} from "./rag-core";

const EMBED_BATCH = 96;

/** One source file's last-modified time plus its embedded chunks. */
interface FileEntry {
    mtime: number;
    chunks: ChunkEmbedding[];
}

export interface RagIndex {
    builtAt: string;
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
    client: LLMClient,
    folderPrefix: string,
    existing?: RagIndex | null,
    onProgress?: (done: number, total: number) => void
): Promise<RagIndex> {
    const files = vault.getMarkdownFiles().filter((f) => f.path.startsWith(folderPrefix));

    const result: Record<string, FileEntry> = {};
    const pending: { path: string; title: string; text: string }[] = [];

    for (const file of files) {
        const mtime = file.stat.mtime;
        const prev = existing?.files[file.path];
        if (prev && prev.mtime === mtime) {
            result[file.path] = prev; // unchanged → reuse embeddings, no API call
            continue;
        }
        result[file.path] = { mtime, chunks: [] };
        const content = await vault.cachedRead(file);
        for (const text of chunkMarkdown(content)) {
            pending.push({ path: file.path, title: file.basename, text });
        }
    }

    for (let i = 0; i < pending.length; i += EMBED_BATCH) {
        const batch = pending.slice(i, i + EMBED_BATCH);
        const embeddings = await client.embedTexts(batch.map((c) => c.text));
        batch.forEach((c, j) =>
            result[c.path].chunks.push({ ...c, embedding: embeddings[j] ?? [] })
        );
        onProgress?.(Math.min(i + EMBED_BATCH, pending.length), pending.length);
    }

    return { builtAt: new Date().toISOString(), files: result };
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

/** Retrieve the most relevant chunks for `question` and have the model answer. */
export async function answerQuestion(
    client: LLMClient,
    index: RagIndex,
    question: string,
    topK = 6
): Promise<RagAnswer> {
    const chunks = allChunks(index);
    if (chunks.length === 0) {
        return {
            answer: "The notes index is empty. Generate some notes first, then ask again.",
            sources: [],
        };
    }

    const [queryVec] = await client.embedTexts([question]);
    const ranked = rankBySimilarity(
        queryVec ?? [],
        chunks.map((c) => c.embedding),
        topK
    );
    const contexts = ranked.map((r) => chunks[r.index]);

    if (contexts.length === 0) {
        return { answer: "No relevant notes found for that question.", sources: [] };
    }

    const answer = await client.generate(buildRagPrompt(question, contexts));
    return { answer, sources: uniqueSources(contexts) };
}
