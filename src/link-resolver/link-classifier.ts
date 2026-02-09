import type { LinkCategory, ParsedCitation } from "./types";

export interface ClassificationResult {
    category: LinkCategory;
    confidence: number;
    parsed: ParsedCitation;
}

// ============================================================
// US Statute patterns
// ============================================================

const US_CODE_RE = /(\d+)\s*U\.?S\.?C\.?A?\.?\s*§?\s*(\d+\w*)/i;
const CFR_RE = /(\d+)\s*C\.?F\.?R\.?\s*§?\s*([\d.]+)/i;
const IRC_RE = /I\.?R\.?C\.?\s*§\s*(\d+)/i;
const TREAS_REG_RE = /Treas\.?\s*Reg\.?\s*§\s*([\d.]+(?:-[\d]+)?)/i;
const REG_SECTION_RE = /^Reg\.?\s*§\s*([\d.]+(?:-[\d]+)?)/i;
const UCC_RE = /U\.?C\.?C\.?\s*§?\s*([\d-]+)/i;
const RESTATEMENT_RE =
    /Restatement\s+\((?:Second|Third|Fourth)\)\s+of\s+/i;
const PUBLIC_LAW_RE = /P\.?L\.?\s+\d+-\d+/i;
const REV_RUL_RE = /Rev\.?\s*Rul\.?\s+[\d-]+/i;
const REV_PROC_RE = /Rev\.?\s*Proc\.?\s+[\d-]+/i;
const PLR_RE = /PLR\s+\d+/i;

// ============================================================
// US Case patterns
// ============================================================

const VS_RE = /^(.+?)\s+v\.?\s+(.+)$/i;
const REPORTER_RE =
    /(\d+)\s+(U\.S\.|S\.\s*Ct\.|F\.\s*\d+d|F\.\s*Supp|L\.\s*Ed)/i;
const IN_RE_RE = /^In\s+re\s+/i;
const EX_PARTE_RE = /^Ex\s+parte\s+/i;

// ============================================================
// Chinese law patterns
// ============================================================

const CN_LAW_SUFFIX_RE =
    /(法|条例|规定|办法|细则|解释|意见|通知|决定|规则|章程|纲要|标准)$/;
const CN_PRC_PREFIX_RE = /^中华人民共和国/;
const CN_ARTICLE_RE = /第[\d一二三四五六七八九十百千]+条/;

const CN_WELL_KNOWN_LAWS = new Set([
    "民法典",
    "刑法",
    "宪法",
    "民事诉讼法",
    "刑事诉讼法",
    "行政诉讼法",
    "公司法",
    "合同法",
    "物权法",
    "侵权责任法",
    "婚姻法",
    "继承法",
    "劳动法",
    "劳动合同法",
    "消费者权益保护法",
    "反不正当竞争法",
    "反垄断法",
    "专利法",
    "商标法",
    "著作权法",
    "证券法",
    "保险法",
    "商业银行法",
    "民法总则",
    "行政处罚法",
    "行政许可法",
    "行政强制法",
    "国家赔偿法",
    "立法法",
    "监察法",
    "个人信息保护法",
    "数据安全法",
    "网络安全法",
    "电子商务法",
    "食品安全法",
    "环境保护法",
    "土地管理法",
    "城乡规划法",
]);

// ============================================================
// Chinese case patterns
// ============================================================

const CN_CASE_NUMBER_RE = /[（(]\d{4}[）)].+[号號]/;
const CN_GUIDING_CASE_RE = /指导案例\s*(?:第?\s*)?(\d+)\s*号?/;
const CN_GONGBAO_RE = /公报案例/;

// ============================================================
// Helpers
// ============================================================

function hasChinese(text: string): boolean {
    return /[\u4e00-\u9fff]/.test(text);
}

// ============================================================
// Main classifier
// ============================================================

export function classifyLink(linkText: string): ClassificationResult {
    const raw = linkText.trim();

    // --- US Statute ---
    let m: RegExpExecArray | null;

    m = IRC_RE.exec(raw);
    if (m) {
        return {
            category: "us-statute",
            confidence: 0.95,
            parsed: { title: "26", section: m[1], raw },
        };
    }

    m = TREAS_REG_RE.exec(raw);
    if (m) {
        return {
            category: "us-statute",
            confidence: 0.95,
            parsed: { title: "26", section: m[1], raw },
        };
    }

    m = REG_SECTION_RE.exec(raw);
    if (m) {
        return {
            category: "us-statute",
            confidence: 0.85,
            parsed: { title: "26", section: m[1], raw },
        };
    }

    m = US_CODE_RE.exec(raw);
    if (m) {
        return {
            category: "us-statute",
            confidence: 0.95,
            parsed: { title: m[1], section: m[2], raw },
        };
    }

    m = CFR_RE.exec(raw);
    if (m) {
        return {
            category: "us-statute",
            confidence: 0.95,
            parsed: { title: m[1], section: m[2], raw },
        };
    }

    m = UCC_RE.exec(raw);
    if (m) {
        return {
            category: "us-statute",
            confidence: 0.90,
            parsed: { section: m[1], raw },
        };
    }

    if (RESTATEMENT_RE.test(raw)) {
        return {
            category: "us-statute",
            confidence: 0.85,
            parsed: { raw },
        };
    }

    if (PUBLIC_LAW_RE.test(raw)) {
        return {
            category: "us-statute",
            confidence: 0.90,
            parsed: { raw },
        };
    }

    if (REV_RUL_RE.test(raw) || REV_PROC_RE.test(raw) || PLR_RE.test(raw)) {
        return {
            category: "us-statute",
            confidence: 0.85,
            parsed: { raw },
        };
    }

    // --- Chinese case ---
    if (CN_CASE_NUMBER_RE.test(raw)) {
        return {
            category: "cn-case",
            confidence: 0.90,
            parsed: { caseNumber: raw, raw },
        };
    }

    m = CN_GUIDING_CASE_RE.exec(raw);
    if (m) {
        return {
            category: "cn-case",
            confidence: 0.90,
            parsed: { caseNumber: m[1], raw },
        };
    }

    if (CN_GONGBAO_RE.test(raw)) {
        return {
            category: "cn-case",
            confidence: 0.85,
            parsed: { caseNumber: raw, raw },
        };
    }

    // --- Chinese law ---
    if (CN_WELL_KNOWN_LAWS.has(raw)) {
        return {
            category: "cn-law",
            confidence: 0.95,
            parsed: { lawName: raw, raw },
        };
    }

    if (CN_PRC_PREFIX_RE.test(raw) && CN_LAW_SUFFIX_RE.test(raw)) {
        return {
            category: "cn-law",
            confidence: 0.95,
            parsed: { lawName: raw, raw },
        };
    }

    if (hasChinese(raw) && CN_LAW_SUFFIX_RE.test(raw)) {
        return {
            category: "cn-law",
            confidence: 0.85,
            parsed: { lawName: raw, raw },
        };
    }

    if (hasChinese(raw) && CN_ARTICLE_RE.test(raw)) {
        return {
            category: "cn-law",
            confidence: 0.80,
            parsed: { lawName: raw, raw },
        };
    }

    // --- US Case ---
    const reporterMatch = REPORTER_RE.exec(raw);
    const vsMatch = VS_RE.exec(raw);

    if (vsMatch && reporterMatch) {
        return {
            category: "us-case",
            confidence: 0.95,
            parsed: {
                plaintiff: vsMatch[1].trim(),
                defendant: vsMatch[2].trim(),
                volume: reporterMatch[1],
                reporter: reporterMatch[2],
                raw,
            },
        };
    }

    if (vsMatch) {
        return {
            category: "us-case",
            confidence: 0.85,
            parsed: {
                plaintiff: vsMatch[1].trim(),
                defendant: vsMatch[2].trim(),
                raw,
            },
        };
    }

    if (IN_RE_RE.test(raw) || EX_PARTE_RE.test(raw)) {
        return {
            category: "us-case",
            confidence: 0.80,
            parsed: { raw },
        };
    }

    if (reporterMatch) {
        return {
            category: "us-case",
            confidence: 0.75,
            parsed: {
                volume: reporterMatch[1],
                reporter: reporterMatch[2],
                raw,
            },
        };
    }

    // --- Unknown ---
    return {
        category: "unknown",
        confidence: 0,
        parsed: { raw },
    };
}
