import type { ExtractedEntities, RelationshipMatrix } from "../types";
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

/**
 * Concept names whose generated page must be re-created for this run: the
 * concepts that changed, plus any concept linked (in the matrix) to a case that
 * changed. On a first full run the diff lists every concept, so this returns
 * all of them — letting step 4 always filter by this set safely.
 */
export function affectedConceptNames(
    diff: EntityDiff,
    entities: ExtractedEntities,
    matrix: RelationshipMatrix
): Set<string> {
    const names = new Set<string>([...diff.addedConcepts, ...diff.updatedConcepts]);

    const changedCaseNames = new Set([...diff.addedCases, ...diff.updatedCases]);
    if (changedCaseNames.size > 0) {
        const caseIdByName = new Map(entities.cases.map((c) => [c.name, c.id]));
        const conceptNameById = new Map(entities.concepts.map((c) => [c.id, c.name]));
        const changedCaseIds = new Set(
            [...changedCaseNames].map((n) => caseIdByName.get(n)).filter((id): id is string => !!id)
        );
        for (const e of matrix.entries) {
            if (changedCaseIds.has(e.caseId)) {
                const cn = conceptNameById.get(e.conceptId);
                if (cn) names.add(cn);
            }
        }
    }
    return names;
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
