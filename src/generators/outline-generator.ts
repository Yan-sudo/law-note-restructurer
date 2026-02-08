import { GeminiClient } from "../ai/gemini-client";
import { buildOutlinePrompt } from "../ai/prompts";
import type { ExtractedEntities, LawNoteSettings } from "../types";
import { cleanGeneratedMarkdown } from "../types";

export async function generateOutlinePage(
    client: GeminiClient,
    settings: LawNoteSettings,
    entities: ExtractedEntities
): Promise<string> {
    const prompt = buildOutlinePrompt(entities, settings.language);
    const raw = await client.generate(prompt);
    return cleanGeneratedMarkdown(raw);
}
