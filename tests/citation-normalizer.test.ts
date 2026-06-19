import { describe, it, expect } from "vitest";
import {
    normalizeCitation,
    getBaseSection,
    deduplicateCitations,
} from "../src/utils/citation-normalizer";

describe("normalizeCitation", () => {
    it("canonicalizes IRC variants", () => {
        expect(normalizeCitation("I.R.C. § 721")).toBe("IRC § 721");
        expect(normalizeCitation("IRC §721")).toBe("IRC § 721");
    });

    it("preserves subsection parentheticals", () => {
        expect(normalizeCitation("IRC § 721(b)")).toBe("IRC § 721(b)");
    });

    it("strips trailing dash descriptions", () => {
        expect(normalizeCitation("IRC § 511(a) - Imposition of tax")).toBe("IRC § 511(a)");
    });

    it("strips capitalized parenthetical descriptions", () => {
        expect(
            normalizeCitation("Treas. Reg. § 1.752-1(a)(1) (Definition of Recourse Liability)"),
        ).toBe("Treas. Reg. § 1.752-1(a)(1)");
    });

    it("canonicalizes USC and CFR", () => {
        expect(normalizeCitation("26 U.S.C.A. § 721")).toBe("26 USC § 721");
        expect(normalizeCitation("26 C.F.R. § 1.752")).toBe("26 CFR § 1.752");
    });
});

describe("getBaseSection", () => {
    it("strips IRC/USC subsection parentheticals", () => {
        expect(getBaseSection("IRC § 511(a)")).toBe("IRC § 511");
        expect(getBaseSection("IRC § 513(a)(1)")).toBe("IRC § 513");
        expect(getBaseSection("26 USC § 721(b)")).toBe("26 USC § 721");
    });

    it("keeps a regulation number that contains internal parentheticals", () => {
        expect(getBaseSection("26 CFR § 1.501(c)(3)-1")).toBe("26 CFR § 1.501(c)(3)-1");
    });

    it("is a no-op when there is no subsection", () => {
        expect(getBaseSection("IRC § 511")).toBe("IRC § 511");
        expect(getBaseSection("Treas. Reg. § 1.752-1")).toBe("Treas. Reg. § 1.752-1");
    });
});

describe("deduplicateCitations", () => {
    it("collapses citations that share a normalized form, keeping the shortest raw", () => {
        const out = deduplicateCitations(["I.R.C. § 721", "IRC § 721", "IRC §721"]);
        expect(out).toEqual(["IRC §721"]);
    });

    it("keeps genuinely distinct citations", () => {
        const out = deduplicateCitations(["IRC § 721", "IRC § 722"]);
        expect(out).toEqual(["IRC § 721", "IRC § 722"]);
    });
});
