import type {
    ExtractedEntities,
    LegalCase,
    LegalConcept,
    LegalPrinciple,
    LegalRule,
} from "../types";
import { normalizeConceptName } from "../types";

// ============================================================
// Similarity helpers
// ============================================================

/**
 * Two names are "similar" if:
 * (a) exact normalized match, OR
 * (b) one normalized name is a substring of the other
 *     and the shorter is at least 6 chars
 */
function areSimilar(a: string, b: string): boolean {
    const na = normalizeConceptName(a);
    const nb = normalizeConceptName(b);
    if (na === nb) return true;
    if (na.length < 6 && nb.length < 6) return false;
    return na.includes(nb) || nb.includes(na);
}

function unionArrays(a: string[], b: string[]): string[] {
    return [...new Set([...a, ...b])];
}

// ============================================================
// Merge entities (for incremental updates)
// ============================================================

/**
 * Merge incoming entities into existing ones.
 * - Matching entities (by normalized name) get their fields updated
 *   and sourceReferences merged.
 * - Non-matching entities are appended.
 * - metadata.sourceDocuments is the union of both.
 */
export function mergeEntities(
    existing: ExtractedEntities,
    incoming: ExtractedEntities
): ExtractedEntities {
    const merged: ExtractedEntities = JSON.parse(JSON.stringify(existing));

    // Merge concepts
    for (const inc of incoming.concepts) {
        const match = merged.concepts.find((e) => areSimilar(e.name, inc.name));
        if (match) {
            match.definition = inc.definition;
            if (inc.nameChinese) match.nameChinese = inc.nameChinese;
            match.sourceReferences = unionArrays(
                match.sourceReferences,
                inc.sourceReferences
            );
        } else {
            merged.concepts.push({ ...inc });
        }
    }

    // Merge cases
    for (const inc of incoming.cases) {
        const match = merged.cases.find((e) => areSimilar(e.name, inc.name));
        if (match) {
            match.facts = inc.facts;
            match.holding = inc.holding;
            match.significance = inc.significance;
            if (inc.citation) match.citation = inc.citation;
            if (inc.year) match.year = inc.year;
            if (inc.court) match.court = inc.court;
            match.relatedConcepts = unionArrays(
                match.relatedConcepts,
                inc.relatedConcepts
            );
            match.sourceReferences = unionArrays(
                match.sourceReferences,
                inc.sourceReferences
            );
        } else {
            merged.cases.push({ ...inc });
        }
    }

    // Merge principles
    for (const inc of incoming.principles) {
        const match = merged.principles.find((e) =>
            areSimilar(e.name, inc.name)
        );
        if (match) {
            match.description = inc.description;
            if (inc.nameChinese) match.nameChinese = inc.nameChinese;
            match.relatedConcepts = unionArrays(
                match.relatedConcepts,
                inc.relatedConcepts
            );
            match.supportingCases = unionArrays(
                match.supportingCases,
                inc.supportingCases
            );
            match.sourceReferences = unionArrays(
                match.sourceReferences,
                inc.sourceReferences
            );
        } else {
            merged.principles.push({ ...inc });
        }
    }

    // Merge rules
    for (const inc of incoming.rules) {
        const match = merged.rules.find((e) => areSimilar(e.name, inc.name));
        if (match) {
            match.statement = inc.statement;
            if (inc.nameChinese) match.nameChinese = inc.nameChinese;
            match.elements = unionArrays(match.elements, inc.elements);
            match.exceptions = unionArrays(match.exceptions, inc.exceptions);
            match.applicationSteps = unionArrays(
                match.applicationSteps,
                inc.applicationSteps
            );
            match.relatedConcepts = unionArrays(
                match.relatedConcepts,
                inc.relatedConcepts
            );
            match.supportingCases = unionArrays(
                match.supportingCases,
                inc.supportingCases
            );
            match.sourceReferences = unionArrays(
                match.sourceReferences,
                inc.sourceReferences
            );
        } else {
            merged.rules.push({ ...inc });
        }
    }

    // Merge metadata
    merged.metadata.sourceDocuments = unionArrays(
        merged.metadata.sourceDocuments,
        incoming.metadata.sourceDocuments
    );
    merged.metadata.extractionTimestamp = incoming.metadata.extractionTimestamp;

    return merged;
}

// ============================================================
// Deduplication (within a single extraction)
// ============================================================

export interface DuplicatePair {
    indexA: number;
    indexB: number;
    nameA: string;
    nameB: string;
}

/**
 * Find potential duplicate concepts by normalized name similarity.
 */
export function findDuplicateConcepts(
    concepts: LegalConcept[]
): DuplicatePair[] {
    return findDuplicatesByName(concepts);
}

export function findDuplicatePrinciples(
    principles: LegalPrinciple[]
): DuplicatePair[] {
    return findDuplicatesByName(principles);
}

export function findDuplicateRules(rules: LegalRule[]): DuplicatePair[] {
    return findDuplicatesByName(rules);
}

function findDuplicatesByName(
    items: Array<{ name: string }>
): DuplicatePair[] {
    const pairs: DuplicatePair[] = [];
    for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
            if (areSimilar(items[i].name, items[j].name)) {
                pairs.push({
                    indexA: i,
                    indexB: j,
                    nameA: items[i].name,
                    nameB: items[j].name,
                });
            }
        }
    }
    return pairs;
}

/**
 * Automatically deduplicate entities by merging similar names.
 * Keeps the shorter name (more canonical), merges fields.
 */
export function deduplicateEntities(
    entities: ExtractedEntities
): ExtractedEntities {
    const result: ExtractedEntities = JSON.parse(JSON.stringify(entities));

    result.concepts = deduplicateList(result.concepts, mergeConcepts);
    result.principles = deduplicateList(result.principles, mergePrinciples);
    result.rules = deduplicateList(result.rules, mergeRules);
    // Cases: less likely to have duplicates, use exact normalized match only
    result.cases = deduplicateList(result.cases, mergeCases);

    return result;
}

function deduplicateList<T extends { name: string }>(
    items: T[],
    mergeFn: (a: T, b: T) => T
): T[] {
    const result: T[] = [];
    const merged = new Set<number>();

    for (let i = 0; i < items.length; i++) {
        if (merged.has(i)) continue;

        let current = items[i];
        for (let j = i + 1; j < items.length; j++) {
            if (merged.has(j)) continue;
            if (areSimilar(current.name, items[j].name)) {
                current = mergeFn(current, items[j]);
                merged.add(j);
            }
        }
        result.push(current);
    }

    return result;
}

function mergeConcepts(a: LegalConcept, b: LegalConcept): LegalConcept {
    // Keep the shorter name as canonical
    const [keep, other] = a.name.length <= b.name.length ? [a, b] : [b, a];
    return {
        ...keep,
        definition: keep.definition.length >= other.definition.length
            ? keep.definition
            : other.definition,
        nameChinese: keep.nameChinese || other.nameChinese,
        sourceReferences: unionArrays(
            keep.sourceReferences,
            other.sourceReferences
        ),
    };
}

function mergeCases(a: LegalCase, b: LegalCase): LegalCase {
    const [keep, other] = a.name.length <= b.name.length ? [a, b] : [b, a];
    return {
        ...keep,
        citation: keep.citation || other.citation,
        year: keep.year || other.year,
        court: keep.court || other.court,
        facts: keep.facts.length >= other.facts.length
            ? keep.facts
            : other.facts,
        holding: keep.holding.length >= other.holding.length
            ? keep.holding
            : other.holding,
        significance: keep.significance.length >= other.significance.length
            ? keep.significance
            : other.significance,
        relatedConcepts: unionArrays(
            keep.relatedConcepts,
            other.relatedConcepts
        ),
        sourceReferences: unionArrays(
            keep.sourceReferences,
            other.sourceReferences
        ),
    };
}

function mergePrinciples(a: LegalPrinciple, b: LegalPrinciple): LegalPrinciple {
    const [keep, other] = a.name.length <= b.name.length ? [a, b] : [b, a];
    return {
        ...keep,
        description: keep.description.length >= other.description.length
            ? keep.description
            : other.description,
        nameChinese: keep.nameChinese || other.nameChinese,
        relatedConcepts: unionArrays(
            keep.relatedConcepts,
            other.relatedConcepts
        ),
        supportingCases: unionArrays(
            keep.supportingCases,
            other.supportingCases
        ),
        sourceReferences: unionArrays(
            keep.sourceReferences,
            other.sourceReferences
        ),
    };
}

function mergeRules(a: LegalRule, b: LegalRule): LegalRule {
    const [keep, other] = a.name.length <= b.name.length ? [a, b] : [b, a];
    return {
        ...keep,
        statement: keep.statement.length >= other.statement.length
            ? keep.statement
            : other.statement,
        nameChinese: keep.nameChinese || other.nameChinese,
        elements: unionArrays(keep.elements, other.elements),
        exceptions: unionArrays(keep.exceptions, other.exceptions),
        applicationSteps: unionArrays(
            keep.applicationSteps,
            other.applicationSteps
        ),
        relatedConcepts: unionArrays(
            keep.relatedConcepts,
            other.relatedConcepts
        ),
        supportingCases: unionArrays(
            keep.supportingCases,
            other.supportingCases
        ),
        sourceReferences: unionArrays(
            keep.sourceReferences,
            other.sourceReferences
        ),
    };
}
