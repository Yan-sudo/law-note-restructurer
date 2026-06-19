import type {
    ExtractedEntities,
    LegalCase,
    RelationshipEntry,
    RelationshipMatrix,
    RelationshipType,
} from "../types";

// Relationship types that represent doctrinal *evolution* (vs. mere application).
const EVOLUTION_TYPES: ReadonlySet<RelationshipType> = new Set([
    "establishes",
    "modifies",
    "distinguishes",
    "overrules",
]);

interface CaseEntry {
    entry: RelationshipEntry;
    cas: LegalCase;
}

const today = (): string => new Date().toISOString().split("T")[0];

/** Make a string safe to drop inside a markdown table cell. */
function cell(text: string): string {
    return text.replace(/\|/g, "\\|").replace(/\s*\n+\s*/g, " ").trim();
}

/** Sort cases by year ascending; undated cases go last, stable by name. */
function byYear(a: CaseEntry, b: CaseEntry): number {
    const ay = a.cas.year ?? Number.POSITIVE_INFINITY;
    const by = b.cas.year ?? Number.POSITIVE_INFINITY;
    if (ay !== by) return ay - by;
    return a.cas.name.localeCompare(b.cas.name);
}

function caseById(entities: ExtractedEntities): Map<string, LegalCase> {
    return new Map(entities.cases.map((c) => [c.id, c]));
}

/** Entries for one concept, resolved to their cases and sorted chronologically. */
function entriesForConcept(
    conceptId: string,
    matrix: RelationshipMatrix,
    cases: Map<string, LegalCase>,
    only?: ReadonlySet<RelationshipType>
): CaseEntry[] {
    const rows: CaseEntry[] = [];
    for (const entry of matrix.entries) {
        if (entry.conceptId !== conceptId) continue;
        if (only && !only.has(entry.relationshipType)) continue;
        const cas = cases.get(entry.caseId);
        if (cas) rows.push({ entry, cas });
    }
    return rows.sort(byYear);
}

function mermaidLabel(text: string): string {
    // Quote the label and strip characters that break mermaid node syntax.
    return `"${text.replace(/["\[\]{}|]/g, "")}"`;
}

/**
 * Doctrinal evolution chains: for each concept, the cases that established,
 * modified, distinguished, or overruled it, in chronological order — plus a
 * Mermaid diagram. Reuses the relationship matrix; no AI call.
 */
export function generateEvolutionPage(
    matrix: RelationshipMatrix,
    entities: ExtractedEntities
): string {
    const cases = caseById(entities);
    const sections: string[] = [];

    for (const concept of entities.concepts) {
        const chain = entriesForConcept(concept.id, matrix, cases, EVOLUTION_TYPES);
        if (chain.length === 0) continue;

        const bullets = chain.map(({ entry, cas }) => {
            const year = cas.year ? ` (${cas.year})` : "";
            return `- [[${cas.name}]]${year} — *${entry.relationshipType}*: ${entry.description}`;
        });

        const lines: string[] = [`## [[${concept.name}]]`, "", ...bullets];

        if (chain.length >= 2) {
            const nodes = chain.map(({ cas }, i) => `    c${i}[${mermaidLabel(cas.name)}]`);
            const edges = chain
                .slice(1)
                .map(({ entry }, i) => `    c${i} -->|${entry.relationshipType}| c${i + 1}`);
            lines.push("", "```mermaid", "graph LR", ...nodes, ...edges, "```");
        }

        sections.push(lines.join("\n"));
    }

    const body =
        sections.length > 0 ? sections.join("\n\n") : "_No doctrinal evolution detected yet._";

    return `---
tags:
  - law/evolution
  - law/overview
date: ${today()}
generated-by: law-note-restructurer
---

# Doctrinal Evolution (学说演进)

How each doctrine was established and refined over time, in chronological order.

${body}
`;
}

/**
 * Case synthesis tables: for every concept addressed by two or more cases, a
 * side-by-side comparison (year, relationship, facts, holding). Reuses the
 * relationship matrix; no AI call.
 */
export function generateSynthesisPage(
    matrix: RelationshipMatrix,
    entities: ExtractedEntities
): string {
    const cases = caseById(entities);
    const sections: string[] = [];

    for (const concept of entities.concepts) {
        const rows = entriesForConcept(concept.id, matrix, cases);
        if (rows.length < 2) continue;

        const header = "| Case | Year | Relationship | Facts | Holding |";
        const sep = "|---|---|---|---|---|";
        const body = rows.map(({ entry, cas }) => {
            const year = cas.year ? String(cas.year) : "—";
            return `| [[${cas.name}]] | ${year} | ${entry.relationshipType} | ${cell(cas.facts)} | ${cell(cas.holding)} |`;
        });

        sections.push([`## [[${concept.name}]]`, "", header, sep, ...body].join("\n"));
    }

    const content =
        sections.length > 0 ? sections.join("\n\n") : "_No multi-case concepts to synthesize yet._";

    return `---
tags:
  - law/synthesis
  - law/overview
date: ${today()}
generated-by: law-note-restructurer
---

# Case Synthesis (案例综合)

Concepts addressed by multiple cases, compared side by side.

${content}
`;
}
