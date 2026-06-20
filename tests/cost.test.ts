import { describe, it, expect } from "vitest";
import {
    estimateCostUSD,
    formatTokens,
    formatUSD,
    isLocalGeneration,
    usageSummary,
} from "../src/ai/cost";
import { DEFAULT_SETTINGS, type LawNoteSettings } from "../src/types";

const settings = (over: Partial<LawNoteSettings> = {}): LawNoteSettings => ({
    ...DEFAULT_SETTINGS,
    ...over,
});

describe("estimateCostUSD", () => {
    it("prices known models per 1M tokens", () => {
        expect(estimateCostUSD("gemini-2.5-flash", 1_000_000)).toBeCloseTo(0.3, 5);
        expect(estimateCostUSD("gemini-2.5-pro", 1_000_000)).toBeCloseTo(5, 5);
    });

    it("falls back to the flash rate for unknown models", () => {
        expect(estimateCostUSD("mystery-model", 1_000_000)).toBeCloseTo(0.3, 5);
    });
});

describe("formatTokens / formatUSD", () => {
    it("scales token counts", () => {
        expect(formatTokens(950)).toBe("950");
        expect(formatTokens(12_300)).toBe("12.3K");
        expect(formatTokens(2_500_000)).toBe("2.50M");
    });

    it("formats small and large costs", () => {
        expect(formatUSD(0)).toBe("$0.00");
        expect(formatUSD(0.004)).toBe("<$0.01");
        expect(formatUSD(1.5)).toBe("$1.50");
    });
});

describe("isLocalGeneration / usageSummary", () => {
    it("detects local generation", () => {
        expect(isLocalGeneration(settings({ generationProvider: "ollama" }))).toBe(true);
        expect(isLocalGeneration(settings({ generationProvider: "gemini" }))).toBe(false);
    });

    it("labels local runs as free and cloud runs with a cost", () => {
        expect(usageSummary(settings({ generationProvider: "ollama" }), 8000)).toContain("free");
        const cloud = usageSummary(settings({ generationProvider: "gemini", modelName: "gemini-2.5-flash" }), 1_000_000);
        expect(cloud).toContain("$0.30");
    });
});
