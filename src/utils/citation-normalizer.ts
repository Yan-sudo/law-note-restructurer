/**
 * Normalize legal citations to canonical form for deduplication.
 *
 * Examples:
 *   "I.R.C. § 721"           → "IRC § 721"
 *   "IRC §721"               → "IRC § 721"
 *   "IRC § 721(b)"           → "IRC § 721(b)"
 *   "Treas. Reg. § 1.752-1(a)(1) (Definition of Recourse Liability)"
 *                             → "Treas. Reg. § 1.752-1(a)(1)"
 *   "26 U.S.C.A. § 721"     → "26 USC § 721"
 *   "26 C.F.R. § 1.752"     → "26 CFR § 1.752"
 */
export function normalizeCitation(raw: string): string {
    let s = raw.trim();

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
