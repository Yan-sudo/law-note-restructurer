import { GeminiClient } from "../ai/gemini-client";
import { buildConceptPagePrompt } from "../ai/prompts";
import type {
    ExtractedEntities,
    LawNoteSettings,
    LegalConcept,
    RelationshipMatrix,
} from "../types";
import { cleanGeneratedMarkdown } from "../types";

export async function generateConceptPage(
    client: GeminiClient,
    settings: LawNoteSettings,
    concept: LegalConcept,
    entities: ExtractedEntities,
    matrix: RelationshipMatrix,
    sourceFiles: string[]
): Promise<string> {
    const relatedEntries = matrix.entries.filter(
        (e) => e.conceptId === concept.id
    );
    const relatedCaseIds = relatedEntries.map((e) => e.caseId);
    const relatedCases = entities.cases.filter((c) =>
        relatedCaseIds.includes(c.id)
    );
    const relatedPrinciples = entities.principles.filter((p) =>
        p.relatedConcepts.includes(concept.id)
    );
    const relatedRules = entities.rules.filter((r) =>
        r.relatedConcepts.includes(concept.id)
    );

    const prompt = buildConceptPagePrompt(
        concept,
        relatedCases,
        relatedPrinciples,
        relatedRules,
        relatedEntries,
        settings.language,
        settings.enableSourceFootnotes,
        sourceFiles
    );

    const raw = await client.generate(prompt);
    return cleanGeneratedMarkdown(raw);
}

export function generateCasePageLocal(
    cas: import("../types").LegalCase,
    entities: ExtractedEntities,
    matrix: RelationshipMatrix
): string {
    const relatedEntries = matrix.entries.filter(
        (e) => e.caseId === cas.id
    );

    const conceptLinks = relatedEntries
        .map((e) => {
            const concept = entities.concepts.find(
                (c) => c.id === e.conceptId
            );
            return `- [[${concept?.name ?? e.conceptId}]] - ${e.relationshipType}: ${e.description}`;
        })
        .join("\n");

    return `---
tags:
  - law/case
date: ${new Date().toISOString().split("T")[0]}
generated-by: law-note-restructurer
---

# ${cas.name}

${cas.citation ? `**Citation**: ${cas.citation}` : ""}
${cas.year ? `**Year**: ${cas.year}` : ""}
${cas.court ? `**Court**: ${cas.court}` : ""}

## Facts
${cas.facts}

## Holding
${cas.holding}

## Significance
${cas.significance}

## Related Concepts
${conceptLinks || "No relationships mapped."}
`;
}
