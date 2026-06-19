import { describe, it, expect } from "vitest";
import { cosineSimilarity, findSimilarPairs } from "../src/utils/similarity";

describe("cosineSimilarity", () => {
    it("is 1 for identical direction", () => {
        expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    });
    it("is 0 for orthogonal vectors", () => {
        expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    });
    it("is -1 for opposite vectors", () => {
        expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1);
    });
    it("returns 0 for empty, mismatched, or zero vectors", () => {
        expect(cosineSimilarity([], [])).toBe(0);
        expect(cosineSimilarity([1, 2], [1])).toBe(0);
        expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    });
});

describe("findSimilarPairs", () => {
    it("returns only pairs at or above the threshold", () => {
        const embeddings = [
            [1, 0],
            [0.99, 0.01], // near-identical to #0
            [0, 1], // orthogonal to #0
        ];
        const pairs = findSimilarPairs(embeddings, 0.9);
        expect(pairs).toHaveLength(1);
        expect(pairs[0]).toMatchObject({ indexA: 0, indexB: 1 });
    });
});
