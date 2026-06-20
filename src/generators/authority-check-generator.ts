import type {
    ExtractedEntities,
    LegalCase,
    RelationshipMatrix,
    RelationshipType,
} from "../types";

// Relationships that cast doubt on the continuing authority of a doctrine.
const LIMITING: ReadonlySet<RelationshipType> = new Set([
    "overrules",
    "modifies",
    "distinguishes",
]);

const today = (): string => new Date().toISOString().split("T")[0];

function oneLine(text: string): string {
    return text.replace(/\s*\n+\s*/g, " ").trim();
}

/**
 * A free, local approximation of Shepard's/KeyCite: flag each concept whose
 * doctrine a later case **overruled**, **modified**, or **distinguished**, and
 * point at the earlier cases that may now be limited. Reuses the relationship
 * matrix; no AI call. Heuristic only — always verify against a citator.
 */
export function generateAuthorityCheckPage(
    matrix: RelationshipMatrix,
    entities: ExtractedEntities
): string {
    const cases = new Map<string, LegalCase>(entities.cases.map((c) => [c.id, c]));
    const sections: string[] = [];

    for (const concept of entities.concepts) {
        const entries = matrix.entries.filter((e) => e.conceptId === concept.id);
        const limiting = entries.filter((e) => LIMITING.has(e.relationshipType));
        if (limiting.length === 0) continue;

        const established = entries.filter((e) => e.relationshipType === "establishes");
        const lines: string[] = [`## [[${concept.name}]]`, "", "> [!warning] Possibly limited authority"];

        for (const e of established) {
            const c = cases.get(e.caseId);
            if (c) lines.push(`> - Established by [[${c.name}]]${c.year ? ` (${c.year})` : ""}`);
        }
        for (const e of limiting) {
            const c = cases.get(e.caseId);
            if (!c) continue;
            const year = c.year ? ` (${c.year})` : "";
            lines.push(`> - ⚠️ **${e.relationshipType}** by [[${c.name}]]${year}: ${oneLine(e.description)}`);
        }
        lines.push(">", "> Verify the current status before relying on the earlier authority.");

        sections.push(lines.join("\n"));
    }

    const body =
        sections.length > 0
            ? sections.join("\n\n")
            : "_No overruled or modified doctrines detected in your notes. (Heuristic only — always verify.)_";

    return `---
tags:
  - law/authority-check
  - law/overview
date: ${today()}
generated-by: law-note-restructurer
---

# Authority Check (效力校验)

Doctrines flagged because a later case **overruled**, **modified**, or **distinguished** them.
This is a heuristic drawn from your own notes — **not** a substitute for Shepard's / KeyCite.

${body}
`;
}
