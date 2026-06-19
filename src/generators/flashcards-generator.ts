import type { ExtractedEntities } from "../types";

export interface Flashcard {
    front: string;
    back: string;
}

/**
 * Derive study flashcards from the already-extracted structured data
 * (definitions, rule statements & elements, case holdings). No AI call.
 */
export function buildFlashcards(entities: ExtractedEntities): Flashcard[] {
    const cards: Flashcard[] = [];

    for (const concept of entities.concepts) {
        if (concept.definition.trim()) {
            cards.push({ front: `Define: ${concept.name}`, back: concept.definition });
        }
    }

    for (const rule of entities.rules) {
        if (rule.statement.trim()) {
            cards.push({ front: `State the rule: ${rule.name}`, back: rule.statement });
        }
        if (rule.elements.length > 0) {
            cards.push({
                front: `Elements of ${rule.name}?`,
                back: rule.elements.join("; "),
            });
        }
    }

    for (const cas of entities.cases) {
        if (cas.holding.trim()) {
            cards.push({ front: `Holding — ${cas.name}?`, back: cas.holding });
        }
    }

    return cards;
}

/** Collapse whitespace and drop the `::` separator so it survives an inline card. */
function inline(text: string): string {
    return text.replace(/::/g, ":").replace(/\s*\n+\s*/g, " ").trim();
}

/** Collapse tabs/newlines so a field survives a tab-separated row. */
function tsvField(text: string): string {
    return text.replace(/[\t\n\r]+/g, " ").trim();
}

/**
 * Markdown page in the Obsidian Spaced Repetition plugin's inline format
 * (`Question::Answer`), tagged `#flashcard` so the plugin picks it up.
 */
export function generateFlashcardsMarkdown(entities: ExtractedEntities): string {
    const cards = buildFlashcards(entities);
    const date = new Date().toISOString().split("T")[0];

    const body =
        cards.length > 0
            ? cards.map((c) => `${inline(c.front)}::${inline(c.back)}`).join("\n\n")
            : "_No flashcards generated yet._";

    return `---
tags:
  - flashcard
  - law/flashcards
date: ${date}
generated-by: law-note-restructurer
---

# Flashcards (闪卡)

Review with the **Spaced Repetition** plugin. Each line is a card (\`Question::Answer\`).

${body}
`;
}

/**
 * Tab-separated front/back rows for direct import into Anki
 * (File → Import, field separator = Tab).
 */
export function generateAnkiExport(entities: ExtractedEntities): string {
    return buildFlashcards(entities)
        .map((c) => `${tsvField(c.front)}\t${tsvField(c.back)}`)
        .join("\n");
}
