/**
 * Vector similarity helpers used by semantic (embedding-based) deduplication.
 * Pure functions — no I/O, no SDK — so they are trivially unit-tested.
 */

/** Cosine similarity of two equal-length vectors. Returns 0 for empty/mismatched/zero vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || a.length !== b.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface SimilarPair {
    indexA: number;
    indexB: number;
    similarity: number;
}

/**
 * All index pairs whose embeddings are at least `threshold` cosine-similar.
 * `embeddings[i]` must correspond to item `i`.
 */
export function findSimilarPairs(embeddings: number[][], threshold: number): SimilarPair[] {
    const pairs: SimilarPair[] = [];
    for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
            const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
            if (similarity >= threshold) {
                pairs.push({ indexA: i, indexB: j, similarity });
            }
        }
    }
    return pairs;
}
