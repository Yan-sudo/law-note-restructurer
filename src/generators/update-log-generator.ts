import type { ExtractedEntities, RelationshipMatrix } from "../types";
import { diffIsEmpty, type EntityDiff } from "../pipeline/entity-diff";

const MAX_GRAPH_NODES = 24;

const today = (): string => new Date().toISOString().split("T")[0];

function mermaidLabel(text: string): string {
    return `"${text.replace(/["[\]{}|]/g, "")}"`;
}

interface GraphNode {
    name: string;
    id: string;
    status: "added" | "updated";
}

function bullets(title: string, names: string[]): string {
    if (names.length === 0) return "";
    return `\n**${title}** (${names.length})\n\n` + names.map((n) => `- [[${n}]]`).join("\n") + "\n";
}

/**
 * "What's New" page: a Mermaid graph of the entities that changed in the latest
 * run (added = green, updated = orange) with the relationships among them, plus
 * a textual summary. Pure — derived from the diff + matrix, no AI call.
 */
export function generateWhatsNewPage(
    diff: EntityDiff,
    entities: ExtractedEntities,
    matrix: RelationshipMatrix
): string {
    const header = `---
tags:
  - law/whats-new
  - law/overview
date: ${today()}
generated-by: law-note-restructurer
---

# What's New (本次更新)

`;

    if (diffIsEmpty(diff)) {
        return header + "_No concept or case changes in the latest run._\n";
    }

    const conceptId = new Map(entities.concepts.map((c) => [c.name, c.id]));
    const caseId = new Map(entities.cases.map((c) => [c.name, c.id]));

    // Collect changed nodes (updated first so they survive the cap), capped.
    const nodes: GraphNode[] = [];
    const push = (name: string, id: string | undefined, status: "added" | "updated") => {
        if (id) nodes.push({ name, id, status });
    };
    diff.updatedConcepts.forEach((n) => push(n, conceptId.get(n), "updated"));
    diff.updatedCases.forEach((n) => push(n, caseId.get(n), "updated"));
    diff.addedConcepts.forEach((n) => push(n, conceptId.get(n), "added"));
    diff.addedCases.forEach((n) => push(n, caseId.get(n), "added"));

    const capped = nodes.slice(0, MAX_GRAPH_NODES);
    const mid = new Map<string, string>();
    capped.forEach((n, i) => mid.set(n.id, `n${i}`));
    const included = new Set(capped.map((n) => n.id));

    const nodeLines = capped.map((n) => `    ${mid.get(n.id)}[${mermaidLabel(n.name)}]`);

    const edgeLines: string[] = [];
    for (const e of matrix.entries) {
        const cm = mid.get(e.caseId);
        const km = mid.get(e.conceptId);
        if (included.has(e.caseId) && included.has(e.conceptId) && cm && km) {
            edgeLines.push(`    ${cm} -->|${e.relationshipType}| ${km}`);
        }
    }

    const styleLines = capped.map((n) =>
        n.status === "added"
            ? `    style ${mid.get(n.id)} fill:#b7e4c7,stroke:#2d6a4f`
            : `    style ${mid.get(n.id)} fill:#ffd6a5,stroke:#bc6c25`
    );

    const graph = ["```mermaid", "graph LR", ...nodeLines, ...edgeLines, ...styleLines, "```"].join("\n");

    const summary =
        `> [!info] Summary\n` +
        `> 🟢 added: ${diff.addedConcepts.length} concepts, ${diff.addedCases.length} cases · ` +
        `🟠 updated: ${diff.updatedConcepts.length} concepts, ${diff.updatedCases.length} cases`;

    const truncated =
        nodes.length > MAX_GRAPH_NODES
            ? `\n\n_Graph capped at ${MAX_GRAPH_NODES} of ${nodes.length} changed items._`
            : "";

    const lists =
        bullets("🟢 New concepts", diff.addedConcepts) +
        bullets("🟠 Updated concepts", diff.updatedConcepts) +
        bullets("🟢 New cases", diff.addedCases) +
        bullets("🟠 Updated cases", diff.updatedCases);

    return `${header}${summary}

**Legend:** 🟢 green = newly added · 🟠 orange = updated

${graph}${truncated}

---
${lists}`;
}
