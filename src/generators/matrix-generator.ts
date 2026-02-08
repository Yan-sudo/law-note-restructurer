import type { ExtractedEntities, RelationshipMatrix } from "../types";

export function generateMatrixPage(
    matrix: RelationshipMatrix,
    entities: ExtractedEntities
): string {
    const date = new Date().toISOString().split("T")[0];

    // Build header
    const conceptNames = matrix.conceptsInOrder.map((id) => {
        const c = entities.concepts.find((c) => c.id === id);
        return c?.name ?? id;
    });

    const header =
        "| Case | " + conceptNames.map((n) => `[[${n}]]`).join(" | ") + " |";
    const separator =
        "|---|" + conceptNames.map(() => "---").join("|") + "|";

    // Build rows
    const rows = matrix.casesInOrder.map((caseId) => {
        const cas = entities.cases.find((c) => c.id === caseId);
        const caseName = cas?.name ?? caseId;

        const cells = matrix.conceptsInOrder.map((conceptId) => {
            const entry = matrix.entries.find(
                (e) => e.caseId === caseId && e.conceptId === conceptId
            );
            if (!entry) return "-";

            const typeLabel =
                entry.strength === "tangential"
                    ? `*${entry.relationshipType}*`
                    : `**${entry.relationshipType}**`;
            return `${typeLabel}: ${entry.description}`;
        });

        return `| [[${caseName}]] | ${cells.join(" | ")} |`;
    });

    return `---
tags:
  - law/matrix
  - law/overview
date: ${date}
generated-by: law-note-restructurer
---

# Case-Concept Relationship Matrix

${header}
${separator}
${rows.join("\n")}

**Legend**:
- **establishes**: Foundational authority for the concept
- **applies**: Applies the concept in a new context
- **modifies**: Limits or refines the concept
- **distinguishes**: Draws a distinction from the concept
- **overrules**: Overrules prior understanding
- **illustrates**: Provides a useful illustration
- *tangential*: Only briefly referenced
`;
}
