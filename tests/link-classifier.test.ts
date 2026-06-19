import { describe, it, expect } from "vitest";
import { classifyLink } from "../src/link-resolver/link-classifier";

describe("classifyLink — US statutes", () => {
    it("classifies IRC sections", () => {
        const r = classifyLink("IRC § 721");
        expect(r.category).toBe("us-statute");
        expect(r.parsed.section).toBe("721");
    });

    it("classifies US Code citations", () => {
        const r = classifyLink("26 U.S.C. § 1983");
        expect(r.category).toBe("us-statute");
        expect(r.parsed.title).toBe("26");
        expect(r.parsed.section).toBe("1983");
    });
});

describe("classifyLink — US cases", () => {
    it("classifies 'X v. Y' as a case", () => {
        const r = classifyLink("Marbury v. Madison");
        expect(r.category).toBe("us-case");
        expect(r.parsed.plaintiff).toBe("Marbury");
        expect(r.parsed.defendant).toBe("Madison");
    });
});

describe("classifyLink — Chinese law & cases", () => {
    it("classifies well-known Chinese laws", () => {
        expect(classifyLink("民法典").category).toBe("cn-law");
    });

    it("classifies full PRC law names", () => {
        expect(classifyLink("中华人民共和国合同法").category).toBe("cn-law");
    });

    it("classifies article references as law", () => {
        expect(classifyLink("第三条").category).toBe("cn-law");
    });

    it("classifies guiding cases", () => {
        expect(classifyLink("指导案例第23号").category).toBe("cn-case");
    });
});

describe("classifyLink — unknown", () => {
    it("returns unknown for unrecognized text", () => {
        const r = classifyLink("某某公司");
        expect(r.category).toBe("unknown");
        expect(r.confidence).toBe(0);
    });
});
