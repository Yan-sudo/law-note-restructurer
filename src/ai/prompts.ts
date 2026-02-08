import type { ExtractedEntities, LegalCase, LegalConcept, LegalPrinciple, LegalRule, RelationshipEntry } from "../types";

function langInstruction(language: "zh" | "en" | "mixed"): string {
    if (language === "zh") {
        return "请用中文输出所有描述性文本。保留英文案例名称、法律术语和引用原文。";
    }
    if (language === "en") {
        return "Output all descriptive text in English.";
    }
    return "Use Chinese for descriptions but preserve English case names, citations, and legal terms of art.";
}

const FORMAT_RULES = `
## CRITICAL FORMATTING RULES
- Start output DIRECTLY with --- (YAML frontmatter). NO leading spaces, NO wrapping code fences.
- Do NOT wrap output in \`\`\`markdown or \`\`\` fences. Output raw markdown only.
- Between a bullet point line (* or -) and a non-bullet paragraph, ALWAYS insert one blank line.
- After every heading (##, ###, ####), ALWAYS insert one blank line before content.
`;

export function buildEntityExtractionPrompt(
    sourceText: string,
    language: "zh" | "en" | "mixed"
): string {
    return `You are a legal education assistant specializing in structured knowledge extraction.
Analyze the following legal study notes and extract ALL distinct entities.

## Language
${langInstruction(language)}

## Entity Types

### 1. Legal Concepts
Doctrines, rules, standards, defenses, remedies, procedures.
For each: id (lowercase-kebab-case), name, nameChinese (optional), definition, category, sourceReferences.

### 2. Legal Cases
Every case mentioned. For each: id, name, citation, year, court, facts (1-2 sentences MAX), holding (1 sentence), significance (1 sentence), relatedConcepts (concept IDs), sourceReferences.

### 3. Legal Principles
Overarching principles spanning multiple concepts. For each: id, name, nameChinese, description, relatedConcepts, supportingCases, sourceReferences.

### 4. Legal Rules
Specific rules with elements and application steps. For each: id, name, nameChinese, statement, elements[], exceptions[], applicationSteps[], relatedConcepts, supportingCases, sourceReferences.

## Output Format
Return ONLY a JSON object with this structure:
{
  "concepts": [...],
  "cases": [...],
  "principles": [...],
  "rules": [...],
  "metadata": {
    "sourceDocuments": [...filenames...],
    "extractionTimestamp": "ISO timestamp",
    "modelUsed": "model name",
    "totalTokensUsed": 0
  }
}

CRITICAL: Keep each text field CONCISE (1-3 sentences max). Do NOT write long paragraphs.
No markdown fences, no extra text. Pure JSON only.

---
SOURCE DOCUMENTS:
${sourceText}
---`;
}

export function buildRelationshipMappingPrompt(
    entities: ExtractedEntities,
    sourceText: string,
    language: "zh" | "en" | "mixed"
): string {
    const conceptList = entities.concepts
        .map((c) => `- ${c.id}: ${c.name}`)
        .join("\n");
    const caseList = entities.cases
        .map((c) => `- ${c.id}: ${c.name}`)
        .join("\n");

    return `You are a legal education assistant mapping relationships between cases and concepts.

## Language
${langInstruction(language)}

## Confirmed Concepts
${conceptList}

## Confirmed Cases
${caseList}

## Task
For every case-concept pair with a meaningful relationship, produce an entry:
- caseId: the case ID
- conceptId: the concept ID
- relationshipType: "establishes" | "applies" | "modifies" | "distinguishes" | "overrules" | "illustrates"
- description: 1-2 sentence explanation
- strength: "primary" | "secondary" | "tangential"

Rules:
- Skip pairs with no meaningful relationship
- Every case should have at least one entry
- Every concept should have at least one case

## Output Format
Return ONLY a JSON object:
{
  "entries": [...],
  "casesInOrder": [...case IDs chronologically...],
  "conceptsInOrder": [...concept IDs by topic...]
}

No markdown fences, no extra text. Pure JSON only.

---
SOURCE DOCUMENTS (for verification):
${sourceText}
---`;
}

export function buildConceptPagePrompt(
    concept: LegalConcept,
    relatedCases: LegalCase[],
    relatedPrinciples: LegalPrinciple[],
    relatedRules: LegalRule[],
    relationships: RelationshipEntry[],
    language: "zh" | "en" | "mixed",
    enableFootnotes: boolean,
    sourceFiles: string[]
): string {
    const footnoteInstruction = enableFootnotes
        ? `\nAfter each case subsection or rule description, add a footnote marker [^src-FILENAME].
At the bottom, add definitions like:
[^src-ch1]: Source: ch1.md
[^src-ch2]: Source: ch2.docx
Available source files: ${sourceFiles.join(", ")}`
        : "";

    return `You are a legal education assistant generating an Obsidian markdown note for "${concept.name}".

## Language
${langInstruction(language)}
${FORMAT_RULES}

## Requirements
1. Start DIRECTLY with --- (YAML frontmatter). Tags: law/concept, law/${concept.category}. Aliases if nameChinese exists. Date: today.
2. # ${concept.name}${concept.nameChinese ? ` (${concept.nameChinese})` : ""}
3. Definition in a callout: > [!note] Definition
4. ## Cases — for each case use ### [[Case Name]]:
   State facts, holding, relevance. Separate bullets from paragraphs with blank lines.
5. ## Principles — link via [[wikilinks]]
6. ## Rules — state the rule plainly, list elements, show how to apply
7. ## See Also — link related concepts
${footnoteInstruction}

## Data
Definition: ${concept.definition}
Cases: ${JSON.stringify(relatedCases.map((c) => ({ name: c.name, facts: c.facts, holding: c.holding, significance: c.significance })))}
Principles: ${JSON.stringify(relatedPrinciples.map((p) => ({ name: p.name, description: p.description })))}
Rules: ${JSON.stringify(relatedRules.map((r) => ({ name: r.name, statement: r.statement, elements: r.elements })))}
Relationships: ${JSON.stringify(relationships.map((r) => ({ case: r.caseId, type: r.relationshipType, desc: r.description })))}

Output raw markdown starting with ---. No code fences.`;
}

export function buildOutlinePrompt(
    entities: ExtractedEntities,
    language: "zh" | "en" | "mixed"
): string {
    return `You are a legal education assistant generating a practical legal study outline in Obsidian.

## Language
${langInstruction(language)}
${FORMAT_RULES}

## Purpose
Write a PRACTICAL STUDY GUIDE. State rules DIRECTLY and CLEARLY so a student can read, understand, and apply them. Use [[wikilinks]] as authority citations after the rule statement, not as the main content.

## Structure Rules
1. Use Obsidian HEADINGS: # for title, ## for major topics, ### for subtopics, #### for sub-subtopics.
2. Under each heading, write the RULE as a plain paragraph. State it directly and applicably.
3. After the rule paragraph, list elements/requirements with bullet points (* or -).
4. After the bullet list, cite authority on its own line: See [[Case Name]]; [[Principle Name]].
5. ALWAYS put a blank line between a bullet list and the next paragraph or heading.
6. ALWAYS put a blank line after every heading before any content.
7. Do NOT make the entire outline only bullets. Use headings + paragraphs + bullet lists.

## Example of Correct Format
---
tags:
  - law/outline
date: 2026-02-08
---

# Contract Law Outline

## Formation

### Consideration

A valid contract requires consideration: a bargained-for exchange in which each party suffers a legal detriment or receives a legal benefit.

**Elements:**

* Legal value (benefit to promisor or detriment to promisee)

* Bargained-for exchange (mutual inducement)

See [[Hamer v. Sidway]] (forbearance as detriment); [[Pennsy Supply v. American Ash]] (hidden mutual benefit).

**How to Apply:** Ask (1) did the promisee give up a legal right or confer a benefit? (2) was this the inducement for the promise?

### Pre-existing Duty Rule

Performance of a pre-existing duty is NOT valid consideration for a new promise. A modification requires NEW consideration beyond the original obligation.

* The pre-existing duty must be owed to the same promisor.

* Unforeseen circumstances may justify modification without new consideration.

See [[Alaska Packers v. Domenico]].

## END OF EXAMPLE — follow this format exactly.

## Entities to Include
Concepts: ${JSON.stringify(entities.concepts.map((c) => ({ name: c.name, category: c.category, definition: c.definition })))}
Cases: ${JSON.stringify(entities.cases.map((c) => ({ name: c.name, year: c.year, holding: c.holding })))}
Rules: ${JSON.stringify(entities.rules.map((r) => ({ name: r.name, statement: r.statement, elements: r.elements, applicationSteps: r.applicationSteps })))}
Principles: ${JSON.stringify(entities.principles.map((p) => ({ name: p.name, description: p.description })))}

Output raw markdown starting with ---. No code fences.`;
}

export function buildDashboardPrompt(
    conceptName: string,
    cases: LegalCase[],
    relationships: RelationshipEntry[],
    language: "zh" | "en" | "mixed"
): string {
    return `You are a legal education assistant generating a Dashboard page for "${conceptName}" in Obsidian.

## Language
${langInstruction(language)}
${FORMAT_RULES}

## Structure
1. Start DIRECTLY with --- (YAML frontmatter). Tags: law/dashboard. Date: today.
2. # ${conceptName} Dashboard
3. ## Case Cards — for each case, use an Obsidian callout:

> [!abstract] [[Case Name]] (year)
> **Type**: relationship type | **Strength**: strength
> Brief facts + holding summary.
> **Key Takeaway**: one sentence.

4. ## Traceability Matrix — markdown table with [[wikilinks]]:
   | Case | Relationship | Description |

5. ## Structural Outline — use ### subheadings and paragraphs (not just bullets). Always blank line between bullets and paragraphs.

## Data
Cases: ${JSON.stringify(cases.map((c) => ({ name: c.name, year: c.year, facts: c.facts, holding: c.holding })))}
Relationships: ${JSON.stringify(relationships.map((r) => ({ caseId: r.caseId, type: r.relationshipType, strength: r.strength, desc: r.description })))}

Output raw markdown starting with ---. No code fences.`;
}
