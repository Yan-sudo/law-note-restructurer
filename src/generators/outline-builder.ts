import type { LLMClient } from "../ai/llm-provider";
import type { ExtractedEntities } from "../types";
import { cleanGeneratedMarkdown } from "../types";
import {
    TocSchema,
    TocResponseSchema,
    buildTocPrompt,
    buildOutlineFromTocPrompt,
    type OutlineOptions,
    type Toc,
} from "../ai/outline";

type Lang = "zh" | "en" | "mixed";

/** Ask the model for a proposed table of contents (structured output). */
export function generateToc(
    client: LLMClient,
    entities: ExtractedEntities,
    options: OutlineOptions,
    language: Lang
): Promise<Toc> {
    return client.generateStructured(
        buildTocPrompt(entities, options, language),
        TocSchema,
        TocResponseSchema
    );
}

/** Generate the full outline markdown following the (user-edited) TOC. */
export async function generateOutlineFromToc(
    client: LLMClient,
    entities: ExtractedEntities,
    toc: Toc,
    options: OutlineOptions,
    language: Lang
): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const raw = await client.generate(
        buildOutlineFromTocPrompt(entities, toc, options, language, today)
    );
    return cleanGeneratedMarkdown(raw);
}
