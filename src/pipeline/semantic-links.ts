import type { LegalConcept } from "../types";
import type { LLMClient } from "../ai/llm-provider";
import { cosineSimilarity } from "../utils/similarity";

export interface RelatedConcept {
    name: string;
    score: number;
}

/**
 * For each concept, the most semantically-similar *other* concepts (by
 * embedding cosine similarity), above `threshold`, capped at `topK`. Surfaces
 * connections that share no explicit wikilink. Returns an empty map (no-op) on
 * <2 concepts or an unusable embedder result.
 */
export async function computeRelatedConcepts(
    concepts: LegalConcept[],
    embedder: Pick<LLMClient, "embedTexts">,
    threshold: number,
    topK: number
): Promise<Map<string, RelatedConcept[]>> {
    const result = new Map<string, RelatedConcept[]>();
    if (concepts.length < 2) return result;

    const texts = concepts.map((c) => `${c.name}: ${c.definition}`);
    const embeddings = await embedder.embedTexts(texts);
    if (embeddings.length !== concepts.length) return result;

    for (let i = 0; i < concepts.length; i++) {
        const scored: RelatedConcept[] = [];
        for (let j = 0; j < concepts.length; j++) {
            if (i === j) continue;
            const score = cosineSimilarity(embeddings[i], embeddings[j]);
            if (score >= threshold) scored.push({ name: concepts[j].name, score });
        }
        scored.sort((a, b) => b.score - a.score);
        if (scored.length > 0) result.set(concepts[i].id, scored.slice(0, topK));
    }

    return result;
}

/** Markdown section linking related concepts; empty string when there are none. */
export function renderRelatedSection(related: RelatedConcept[] | undefined): string {
    if (!related || related.length === 0) return "";
    const bullets = related.map((r) => `- [[${r.name}]]`).join("\n");
    return `\n\n## Related Concepts (语义相关)\n\n${bullets}\n`;
}
