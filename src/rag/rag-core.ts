import { cosineSimilarity } from "../utils/similarity";

export interface IndexedChunk {
    /** Vault path of the source note. */
    path: string;
    /** Note basename (used as the wikilink target in citations). */
    title: string;
    /** The chunk's text. */
    text: string;
}

export interface ChunkEmbedding extends IndexedChunk {
    embedding: number[];
}

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n?/;

export function stripFrontmatter(md: string): string {
    return md.replace(FRONTMATTER_RE, "").trim();
}

/**
 * Split markdown into chunks of at most ~`maxChars`, breaking on paragraph
 * boundaries so chunks stay semantically coherent. Frontmatter is dropped.
 */
export function chunkMarkdown(md: string, maxChars = 1500): string[] {
    const text = stripFrontmatter(md);
    if (!text) return [];

    const paragraphs = text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

    const chunks: string[] = [];
    let current = "";
    for (const p of paragraphs) {
        if (current && current.length + p.length + 2 > maxChars) {
            chunks.push(current);
            current = p;
        } else {
            current = current ? `${current}\n\n${p}` : p;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

export interface ScoredChunk {
    index: number;
    score: number;
}

/** Indices of the `topK` embeddings most similar to `query`, best first. */
export function rankBySimilarity(
    query: number[],
    embeddings: number[][],
    topK: number
): ScoredChunk[] {
    const scored: ScoredChunk[] = embeddings.map((e, index) => ({
        index,
        score: cosineSimilarity(query, e),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).filter((s) => s.score > 0);
}

/** Build the grounded-answer prompt from the retrieved note chunks. */
export function buildRagPrompt(question: string, contexts: IndexedChunk[]): string {
    const notes = contexts
        .map((c, i) => `[${i + 1}] (Source: [[${c.title}]])\n${c.text}`)
        .join("\n\n");

    return `You are a legal study assistant. Answer the question using ONLY the notes below.
Cite the sources you rely on as [[Source Title]]. If the notes do not contain the
answer, say so plainly rather than guessing.

# Question
${question}

# Notes
${notes}

# Answer`;
}

/** Distinct source titles across the retrieved chunks, preserving order. */
export function uniqueSources(contexts: IndexedChunk[]): string[] {
    return [...new Set(contexts.map((c) => c.title))];
}
