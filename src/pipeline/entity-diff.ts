import type { ExtractedEntities } from "../types";
import { normalizeConceptName } from "../types";

/** What changed between a previous knowledge base and the freshly-merged one. */
export interface EntityDiff {
    addedConcepts: string[];
    updatedConcepts: string[];
    addedCases: string[];
    updatedCases: string[];
}

export function emptyDiff(): EntityDiff {
    return { addedConcepts: [], updatedConcepts: [], addedCases: [], updatedCases: [] };
}

export function diffIsEmpty(d: EntityDiff): boolean {
    return (
        d.addedConcepts.length === 0 &&
        d.updatedConcepts.length === 0 &&
        d.addedCases.length === 0 &&
        d.updatedCases.length === 0
    );
}

type EntityLists = Pick<ExtractedEntities, "concepts" | "cases">;

/**
 * Compare the knowledge base before and after a run (matched by normalized
 * name). A name not seen before is "added"; a name whose key content changed is
 * "updated". Used to drive the "What's New" change graph.
 */
export function diffEntities(before: EntityLists, after: EntityLists): EntityDiff {
    const beforeConcepts = new Map(before.concepts.map((c) => [normalizeConceptName(c.name), c]));
    const beforeCases = new Map(before.cases.map((c) => [normalizeConceptName(c.name), c]));

    const diff = emptyDiff();

    for (const c of after.concepts) {
        const prev = beforeConcepts.get(normalizeConceptName(c.name));
        if (!prev) diff.addedConcepts.push(c.name);
        else if (prev.definition !== c.definition) diff.updatedConcepts.push(c.name);
    }

    for (const c of after.cases) {
        const prev = beforeCases.get(normalizeConceptName(c.name));
        if (!prev) diff.addedCases.push(c.name);
        else if (prev.holding !== c.holding || prev.facts !== c.facts) diff.updatedCases.push(c.name);
    }

    return diff;
}
