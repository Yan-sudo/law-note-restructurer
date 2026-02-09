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

IMPORTANT: Do NOT create multiple entries for the same legal concept under different names.
For example, "Aggregate Principle" and "Aggregate Theory of Partnership Taxation" are the
same concept — use only one entry with the most specific name. If a concept is known by
multiple names, use the primary name for "name" and list alternatives in the definition.

## Citation Format Rules
Use CONSISTENT canonical citation formats throughout:
- Internal Revenue Code: "IRC § 721" (NOT "I.R.C. § 721", NOT "IRC §721")
- Treasury Regulations: "Treas. Reg. § 1.721-1" (NOT "Reg. § 1.721-1")
- US Code: "26 USC § 721" (NOT "26 U.S.C.A. § 721")
- CFR: "26 CFR § 1.721" (NOT "26 C.F.R. § 1.721")
- Citation wikilinks must contain ONLY the provision number — NO descriptions, titles, or labels after it:
  - GOOD: "IRC § 721", "Article 1", "第三条"
  - BAD: "IRC § 721 (Nonrecognition of gain)", "Article 1 - Freedom of Speech", "第三条 基本权利"
  - The description belongs in the surrounding text, NOT inside the [[wikilink]]

## Principle Extraction Rules
ONLY extract a principle if the source text explicitly discusses it with enough substance to fill a note.
Do NOT infer or fabricate principles that are merely implied or only briefly mentioned in passing.
A principle needs: an explicit statement in the source, supporting cases or rules, and enough content for a meaningful description.

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

## CRITICAL: No Hallucinated Links
ONLY create [[wikilinks]] to names that appear in the Data section below (cases, principles, rules, concepts).
Do NOT invent new concept names, principle names, or any other [[wikilinks]] that are not in the provided data.
If the Principles or See Also section would be empty, OMIT that section entirely.
Use canonical citation format: "IRC § 721" (not "I.R.C."), "Treas. Reg. § 1.721-1" (not "Reg. §"). Citation wikilinks must contain ONLY the provision number — NO descriptions or titles (e.g., use [[Article 1]], NOT [[Article 1 - Freedom of Speech]]).

## Requirements
1. Start DIRECTLY with --- (YAML frontmatter). Tags: law/concept, law/${concept.category}. Aliases if nameChinese exists. Date: today.
2. # ${concept.name}${concept.nameChinese ? ` (${concept.nameChinese})` : ""}
3. Definition in a callout: > [!note] Definition
4. ## Cases — for each case use ### [[Case Name]]:
   State facts, holding, relevance. Separate bullets from paragraphs with blank lines.
5. ## Principles — ONLY if principles are provided in data below. Link via [[wikilinks]].
6. ## Rules — state the rule plainly, list elements, show how to apply
7. ## See Also — ONLY link concepts that exist in the provided data. Omit if none.
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
    return `You are a legal education assistant generating a comprehensive COURSE OUTLINE in Obsidian.

## Language
${langInstruction(language)}
${FORMAT_RULES}

## Purpose
Write a structured COURSE OUTLINE that organizes the legal doctrines, rules, and principles into a coherent hierarchy. This should read like a well-organized law school outline — concise definitions, rule statements, key elements, and landmark cases that established or illustrate each doctrine.

## CRITICAL: No Hallucinated Links
ONLY create [[wikilinks]] to case names, concept names, and statute citations that appear in the Data section below.
Do NOT invent new names or links. If a concept is not in the data, mention it as plain text, not a [[wikilink]].
Use canonical citation format: "IRC § 721" (not "I.R.C."), "Treas. Reg. § 1.721-1" (not "Reg. §").

## CRITICAL: Citation Wikilink Format
Citation wikilinks must contain ONLY the provision number. NEVER append descriptions, titles, or parenthetical explanations inside a [[wikilink]]:
- CORRECT: [[Treas. Reg. § 1.721-1(a)]]
- WRONG:  [[Treas. Reg. § 1.721-1(a) (Contributor's Own Note, Installment Obligations)]]
- CORRECT: [[IRC § 721(b)]]
- WRONG:  [[IRC § 721(b) (Investment Company Exception)]]
Put the description OUTSIDE the wikilink as plain text, e.g.: [[Treas. Reg. § 1.721-1(a)]] (regarding contributor's own note).

## Content Guidelines
1. **Define each doctrine/concept** with a brief, precise statement of the rule.
2. **List elements or requirements** as numbered items where applicable.
3. **Cite landmark cases**: When a doctrine was established, refined, or best illustrated by a case in the data, mention it parenthetically — e.g., "([[Case Name]], ${new Date().getFullYear()})". Do NOT create separate case-listing sections; weave case references naturally into the rule description.
4. **Note exceptions and limitations** under the relevant rule.
5. **Statutory authority**: Reference statutes inline where relevant.
6. Do NOT repeat full case facts or holdings — a brief parenthetical (case name + what it stands for) is sufficient.
7. Not every rule needs a case citation. Only cite cases that are genuinely central to the doctrine.

## Structure Rules
1. Use Obsidian HEADINGS: # for title, ## for major topic areas, ### for specific doctrines/rules, #### for sub-rules or special cases.
2. Group related doctrines under common ## headings by subject area.
3. Use **numbered lists** for sequential elements or multi-part tests.
4. Use bullet points for non-sequential items (exceptions, factors, policy rationales).
5. ALWAYS put a blank line after every heading before any content.
6. ALWAYS put a blank line between a list and the next paragraph or heading.
7. Link concept names as [[wikilinks]] on first mention only.

## Example of Correct Format
---
tags:
  - law/outline
date: ${new Date().toISOString().slice(0, 10)}
---

# Partnership Taxation Outline

## Formation and Contributions

### Tax-Free Contributions ([[IRC § 721]])

No gain or loss is recognized when property is contributed to a partnership in exchange for a partnership interest.

**Elements:**

1. Transfer of property (including money)
2. To a partnership (formation or additional contribution)
3. In exchange for a partnership interest

**Basis consequences:** Contributing partner takes a substituted basis ([[IRC § 722]]); partnership takes a carryover basis ([[IRC § 723]]).

**Exception — Investment Company Rule** ([[IRC § 721(b)]]): Gain is recognized if the contribution results in diversification of the transferor's portfolio.

### Services for Partnership Interest

A partner who receives a capital interest for services must recognize ordinary income equal to the FMV of the interest received ([[Diamond v. Commissioner]], 1974).

- If the partner receives only a *profits interest*, generally no immediate recognition ([[Rev. Proc. 93-27]]).

## Entity vs. Aggregate Theory

The tax code treats partnerships as **entities** for some purposes and **aggregates** of individual partners for others.

### Entity Treatment

The partnership files its own return and makes certain elections at the entity level ([[IRC § 701]]).

### Aggregate Treatment

Each partner reports their distributive share as if they directly owned the underlying assets. Character of income flows through ([[IRC § 702(b)]]).

## END OF EXAMPLE

## Data
Concepts: ${JSON.stringify(entities.concepts.map((c) => ({ name: c.name, category: c.category, definition: c.definition })))}
Cases: ${JSON.stringify(entities.cases.map((c) => ({ name: c.name, year: c.year, holding: c.holding, significance: c.significance, relatedConcepts: c.relatedConcepts })))}
Rules: ${JSON.stringify(entities.rules.map((r) => ({ name: r.name, statement: r.statement, elements: r.elements, exceptions: r.exceptions, applicationSteps: r.applicationSteps })))}
Principles: ${JSON.stringify(entities.principles.map((p) => ({ name: p.name, description: p.description })))}

Output raw markdown starting with ---. No code fences.`;
}

export function buildCombinedConceptDashboardPrompt(
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

    const casesJson = JSON.stringify(relatedCases.map((c) => ({ name: c.name, year: c.year, facts: c.facts, holding: c.holding, significance: c.significance })));
    const principlesJson = JSON.stringify(relatedPrinciples.map((p) => ({ name: p.name, description: p.description })));
    const rulesJson = JSON.stringify(relatedRules.map((r) => ({ name: r.name, statement: r.statement, elements: r.elements })));
    const relsJson = JSON.stringify(relationships.map((r) => ({ case: r.caseId, type: r.relationshipType, strength: r.strength, desc: r.description })));

    return `You are a legal education assistant. Generate TWO Obsidian markdown pages for "${concept.name}".

## Language
${langInstruction(language)}
${FORMAT_RULES}

## CRITICAL: No Hallucinated Links
ONLY create [[wikilinks]] to names that appear in the SHARED DATA section below.
Do NOT invent new concept names, principle names, or any other [[wikilinks]] not in the data.
If Principles or See Also would be empty, OMIT that section entirely.
Use canonical citation format: "IRC § 721" (not "I.R.C."), "Treas. Reg. § 1.721-1" (not "Reg. §"). Citation wikilinks must contain ONLY the provision number — NO descriptions or titles (e.g., use [[Article 1]], NOT [[Article 1 - Freedom of Speech]]).

===== PAGE 1: CONCEPT PAGE =====

Requirements:
1. Start DIRECTLY with --- (YAML frontmatter). Tags: law/concept, law/${concept.category}. Aliases if nameChinese exists. Date: today.
2. # ${concept.name}${concept.nameChinese ? ` (${concept.nameChinese})` : ""}
3. Definition in a callout: > [!note] Definition
4. ## Cases — for each case use ### [[Case Name]]:
   State facts, holding, relevance. Separate bullets from paragraphs with blank lines.
5. ## Principles — ONLY if principles are provided in data. Link via [[wikilinks]].
6. ## Rules — state the rule plainly, list elements, show how to apply
7. ## See Also — ONLY link concepts from the provided data. Omit if none.
${footnoteInstruction}

===== PAGE 2: DASHBOARD PAGE =====

Requirements:
1. Start DIRECTLY with --- (YAML frontmatter). Tags: law/dashboard. Date: today.
2. # ${concept.name} Dashboard
3. ## Case Cards — for each case, use an Obsidian callout:

> [!abstract] [[Case Name]] (year)
> **Type**: relationship type | **Strength**: strength
> Brief facts + holding summary.
> **Key Takeaway**: one sentence.

4. ## Traceability Matrix — markdown table with [[wikilinks]]:
   | Case | Relationship | Description |

5. ## Structural Outline — use ### subheadings and paragraphs (not just bullets). Always blank line between bullets and paragraphs.

===== SHARED DATA =====

Definition: ${concept.definition}
Cases: ${casesJson}
Principles: ${principlesJson}
Rules: ${rulesJson}
Relationships: ${relsJson}

===== OUTPUT FORMAT =====

Output raw markdown. Write Page 1 FIRST, then on its own line write exactly:
===DASHBOARD===
Then write Page 2.

Both pages start with --- (YAML frontmatter). No wrapping code fences.`;
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
