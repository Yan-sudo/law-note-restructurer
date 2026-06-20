import { z } from "zod";
import { Type, type Schema } from "@google/genai";
import type { ExtractedEntities } from "../types";

// ============================================================
// Options
// ============================================================

export type OutlineDetail = "concise" | "standard" | "detailed";
export type OutlineStructure = "lecture" | "thematic" | "lifecycle" | "custom";

export interface OutlineOptions {
    detail: OutlineDetail;
    structure: OutlineStructure;
    /** Free-text instruction used when structure === "custom". */
    customInstruction: string;
    /** Heading depth: 1 = sections only, 2 = + sub-sections, 3 = + leaf groups. */
    levels: number;
    /** Target number of top-level sections, or "auto" to let the model decide. */
    sectionCount: number | "auto";
}

export const DEFAULT_OUTLINE_OPTIONS: OutlineOptions = {
    detail: "standard",
    structure: "lecture",
    customInstruction: "",
    levels: 2,
    sectionCount: "auto",
};

const DETAIL_TEXT: Record<OutlineDetail, string> = {
    concise: "High-level: major topics only, short rule statements, minimal sub-points.",
    standard: "Balanced: doctrines with key elements and landmark cases, moderate depth.",
    detailed:
        "Thorough: elements, exceptions, sub-rules, application steps, and supporting cases for each doctrine.",
};

/** Human-readable structure instruction fed to the model. */
export function structureText(o: OutlineOptions): string {
    switch (o.structure) {
        case "lecture":
            return "Organize roughly in the order the material is usually taught (as reflected by the source notes).";
        case "thematic":
            return "Reorganize by doctrine/theme, grouping related rules together regardless of lecture order.";
        case "lifecycle":
            return (
                "Reorganize chronologically by the real-world lifecycle/sequence of the subject — " +
                "e.g., for Civil Procedure follow a case's journey: pleadings → motions to dismiss → " +
                "discovery → summary judgment → trial → post-trial motions → appeal — rather than lecture order."
            );
        case "custom":
            return o.customInstruction.trim() || "Use the most logical structure for the subject.";
    }
}

// ============================================================
// Table of contents
// ============================================================

export interface TocSubsection {
    title: string;
    items: string[];
}
export interface TocSection {
    title: string;
    /** Leaf labels directly under the section (used for flat/concise outlines). */
    items: string[];
    /** Nested groups under the section (used for standard/detailed outlines). */
    subsections: TocSubsection[];
}
export interface Toc {
    sections: TocSection[];
}

const TocSubsectionSchema = z.object({
    title: z.string(),
    items: z.array(z.string()),
});

export const TocSchema = z.object({
    sections: z.array(
        z.object({
            title: z.string(),
            items: z.array(z.string()),
            // Required (the Gemini response schema always emits it; empty = flat section).
            subsections: z.array(TocSubsectionSchema),
        })
    ),
});

const TocSubsectionResponseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        items: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["title", "items"],
    propertyOrdering: ["title", "items"],
};

export const TocResponseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        sections: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    items: { type: Type.ARRAY, items: { type: Type.STRING } },
                    subsections: { type: Type.ARRAY, items: TocSubsectionResponseSchema },
                },
                required: ["title", "items", "subsections"],
                propertyOrdering: ["title", "items", "subsections"],
            },
        },
    },
    required: ["sections"],
    propertyOrdering: ["sections"],
};

/** Pure reorder helper used by the drag-and-drop TOC editor. */
export function moveSection(sections: TocSection[], from: number, to: number): TocSection[] {
    const copy = sections.slice();
    if (from < 0 || from >= copy.length || to < 0 || to >= copy.length || from === to) return copy;
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    return copy;
}

/** Reorder a subsection within one section; returns a new sections array. */
export function moveSubsection(
    sections: TocSection[],
    sectionIndex: number,
    from: number,
    to: number
): TocSection[] {
    const sec = sections[sectionIndex];
    if (!sec) return sections;
    const subs = sec.subsections;
    const n = subs.length;
    if (from < 0 || from >= n || to < 0 || to >= n || from === to) return sections;
    const nextSubs = subs.slice();
    const [moved] = nextSubs.splice(from, 1);
    nextSubs.splice(to, 0, moved);
    return sections.map((s, i) => (i === sectionIndex ? { ...s, subsections: nextSubs } : s));
}

// ============================================================
// Prompts
// ============================================================

function langText(language: "zh" | "en" | "mixed"): string {
    if (language === "zh") return "请用中文输出，保留英文案例名、法律术语和引用原文。";
    if (language === "en") return "Output in English.";
    return "Use Chinese for prose but preserve English case names, citations, and terms of art.";
}

function entityNames(entities: ExtractedEntities): string {
    const list = (arr: { name: string }[]) => arr.map((x) => x.name).join(", ");
    return (
        `Concepts: ${list(entities.concepts)}\n` +
        `Cases: ${list(entities.cases)}\n` +
        `Rules: ${list(entities.rules)}\n` +
        `Principles: ${list(entities.principles)}`
    );
}

export function buildTocPrompt(
    entities: ExtractedEntities,
    options: OutlineOptions,
    language: "zh" | "en" | "mixed"
): string {
    const flat = options.levels <= 1 || options.detail === "concise";
    const nesting = flat
        ? "Keep it FLAT: each section just lists its item labels in `items`; leave `subsections` empty."
        : "Use a TWO-LEVEL hierarchy: break each large section into a few `subsections`, each with its own title and 2–6 item labels. Put a doctrine directly in the section's `items` only when it doesn't belong under any subsection.";

    const sectionTarget =
        options.sectionCount === "auto"
            ? "Use as many top-level sections as the material naturally needs."
            : `Aim for about ${options.sectionCount} top-level sections (merge or split to land near that number).`;

    return `You are organizing a law-school outline. Propose a hierarchical TABLE OF CONTENTS: a list of
sections, each with optional sub-sections, where the leaf labels name the doctrines/cases covered.

## Structure
${structureText(options)}

## Detail
${DETAIL_TEXT[options.detail]}

## Nesting
${nesting}

## Section count
${sectionTarget}

## Language
${langText(language)}

## Rules
- Cover the material below; group it sensibly per the Structure instruction.
- Section title = a clear top-level heading. Subsection title = a coherent sub-group within it.
- Leaf item labels are short and drawn from the data (doctrine/case names) — not full sentences.
- Order sections (and subsections within them) to match the Structure instruction.
- Return ONLY the structured TOC.

## Data
${entityNames(entities)}`;
}

export function buildOutlineFromTocPrompt(
    entities: ExtractedEntities,
    toc: Toc,
    options: OutlineOptions,
    language: "zh" | "en" | "mixed",
    today: string
): string {
    const tocText = toc.sections
        .map((s, i) => {
            const lines = [`${i + 1}. ${s.title}`];
            for (const item of s.items) lines.push(`   - ${item}`);
            (s.subsections ?? []).forEach((sub, j) => {
                lines.push(`   ${i + 1}.${j + 1} ${sub.title}`);
                for (const item of sub.items) lines.push(`      - ${item}`);
            });
            return lines.join("\n");
        })
        .join("\n");

    const headingRule =
        options.levels <= 1
            ? "- Use `##` for each numbered TOC section. Keep everything else as prose/bullets — no deeper headings."
            : options.levels === 2
              ? "- Use `##` for each numbered TOC section and `###` for each `x.y` subsection. Do not go deeper than `###`; leaf items become bold sub-points or bullets."
              : "- Use `##` for each numbered TOC section, `###` for each `x.y` subsection, and `####` (or bold sub-points) for the leaf items inside a subsection.";

    return `Write a full law-school OUTLINE in Obsidian markdown, following EXACTLY this table of
contents, hierarchy, and order:

${tocText}

## Detail
${DETAIL_TEXT[options.detail]}

## Structure intent
${structureText(options)}

## Language
${langText(language)}

## Rules
${headingRule}
- ONLY create [[wikilinks]] to case/concept/statute names that appear in the Data. Never invent links.
- Canonical citations: "IRC § 721" (not "I.R.C."), "Treas. Reg. § 1.721-1". A wikilink holds ONLY the provision number.
- Blank line after every heading and between a list and the next paragraph.
- Start DIRECTLY with --- frontmatter (tags: law/outline; date: ${today}). No code fences.

## Data
Concepts: ${JSON.stringify(entities.concepts.map((c) => ({ name: c.name, definition: c.definition })))}
Cases: ${JSON.stringify(entities.cases.map((c) => ({ name: c.name, year: c.year, holding: c.holding })))}
Rules: ${JSON.stringify(entities.rules.map((r) => ({ name: r.name, statement: r.statement, elements: r.elements })))}
Principles: ${JSON.stringify(entities.principles.map((p) => ({ name: p.name, description: p.description })))}

Output raw markdown starting with ---.`;
}
