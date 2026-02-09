/**
 * Normalize legal citations to canonical form for deduplication.
 *
 * Examples:
 *   "I.R.C. § 721"           → "IRC § 721"
 *   "IRC §721"               → "IRC § 721"
 *   "IRC § 721(b)"           → "IRC § 721(b)"
 *   "IRC § 511(a) - Imposition of tax" → "IRC § 511(a)"
 *   "Treas. Reg. § 1.752-1(a)(1) (Definition of Recourse Liability)"
 *                             → "Treas. Reg. § 1.752-1(a)(1)"
 *   "26 U.S.C.A. § 721"     → "26 USC § 721"
 *   "26 C.F.R. § 1.752"     → "26 CFR § 1.752"
 */
export function normalizeCitation(raw: string): string {
    let s = raw.trim();

    // Strip " - Description text" (e.g. "IRC § 511(a) - Imposition of tax...")
    s = s.replace(/\s+-\s+[A-Z].+$/, "");

    // Strip trailing parenthetical descriptions: "(Definition of ...)"
    // But preserve section parentheticals like (a)(1)(B)
    s = s.replace(/\s+\([A-Z][^)]*\)\s*$/, "");

    // I.R.C. / IRC → IRC
    s = s.replace(/I\.?\s*R\.?\s*C\.?\s*/g, "IRC ");

    // Treas. Reg. → Treas. Reg.  (normalize dots and spacing)
    s = s.replace(/Treas\.?\s*Reg\.?\s*/gi, "Treas. Reg. ");

    // Standalone Reg. § → Treas. Reg. §
    s = s.replace(/^Reg\.?\s*§/i, "Treas. Reg. §");

    // U.S.C.A. / U.S.C. / USC → USC
    s = s.replace(/U\.?\s*S\.?\s*C\.?\s*A?\.?\s*/g, "USC ");

    // C.F.R. / CFR → CFR
    s = s.replace(/C\.?\s*F\.?\s*R\.?\s*/g, "CFR ");

    // U.C.C. / UCC → UCC
    s = s.replace(/U\.?\s*C\.?\s*C\.?\s*/g, "UCC ");

    // Rev. Rul. / Rev Rul → Rev. Rul.
    s = s.replace(/Rev\.?\s*Rul\.?\s*/gi, "Rev. Rul. ");

    // Rev. Proc. / Rev Proc → Rev. Proc.
    s = s.replace(/Rev\.?\s*Proc\.?\s*/gi, "Rev. Proc. ");

    // Normalize § spacing: "§721" → "§ 721", "§  721" → "§ 721"
    s = s.replace(/§\s*/g, "§ ");

    // Collapse multiple spaces
    s = s.replace(/\s+/g, " ").trim();

    return s;
}

/**
 * Extract the base section number from a citation, stripping subsection parentheticals.
 * Used for deduplication so that "IRC § 511" and "IRC § 511(a)" collapse to one file.
 *
 * Examples:
 *   "IRC § 511(a)"             → "IRC § 511"
 *   "IRC § 513(a)(1)"          → "IRC § 513"
 *   "26 USC § 721(b)"          → "26 USC § 721"
 *   "Treas. Reg. § 1.752-1(a)" → "Treas. Reg. § 1.752-1"
 *   "26 CFR § 1.501(c)(3)-1"   → "26 CFR § 1.501(c)(3)-1"  (reg number preserved)
 */
export function getBaseSection(normalized: string): string {
    // For Treasury Regs / CFR: the section number can contain dots, hyphens, and
    // parentheticals that are PART of the regulation number (e.g., § 1.501(c)(3)-1).
    // Strip only trailing parentheticals after the last hyphen-number segment.
    const regMatch = normalized.match(
        /^((?:Treas\. Reg\.|[\d]+ CFR) § [\d]+\.[\d]+(?:\([^)]+\))*(?:-[\d]+(?:\([^)]+\))*)*)/
    );
    if (regMatch) {
        return regMatch[1];
    }

    // For IRC / USC / UCC / other: strip all trailing (a)(1)(B) etc.
    return normalized.replace(/(\([\da-zA-Z]+\))+$/, "").trim();
}

/**
 * Deduplicate an array of citation strings by normalized form.
 * Keeps the first occurrence (shortest or most canonical form preferred).
 * Returns the deduplicated array preserving insertion order.
 */
export function deduplicateCitations(citations: string[]): string[] {
    const seen = new Map<string, string>(); // normalized → first raw

    for (const raw of citations) {
        const norm = normalizeCitation(raw);
        if (!seen.has(norm)) {
            // Prefer shorter form (no parenthetical description)
            seen.set(norm, raw);
        } else {
            // Keep whichever is shorter (more canonical)
            const existing = seen.get(norm)!;
            if (raw.length < existing.length) {
                seen.set(norm, raw);
            }
        }
    }

    return Array.from(seen.values());
}
