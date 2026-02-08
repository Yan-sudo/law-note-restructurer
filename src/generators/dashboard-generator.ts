import { GeminiClient } from "../ai/gemini-client";
import { buildDashboardPrompt } from "../ai/prompts";
import type {
    ExtractedEntities,
    LawNoteSettings,
    LegalConcept,
    RelationshipMatrix,
} from "../types";
import { cleanGeneratedMarkdown } from "../types";

export async function generateDashboardPage(
    client: GeminiClient,
    settings: LawNoteSettings,
    concept: LegalConcept,
    entities: ExtractedEntities,
    matrix: RelationshipMatrix
): Promise<string> {
    const relatedEntries = matrix.entries.filter(
        (e) => e.conceptId === concept.id
    );
    const relatedCaseIds = relatedEntries.map((e) => e.caseId);
    const relatedCases = entities.cases.filter((c) =>
        relatedCaseIds.includes(c.id)
    );

    const prompt = buildDashboardPrompt(
        concept.name,
        relatedCases,
        relatedEntries,
        settings.language
    );

    const raw = await client.generate(prompt);
    return cleanGeneratedMarkdown(raw);
}
