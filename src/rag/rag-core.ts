import { cosineSimilarity } from "../utils/similarity";

export interface IndexedChunk {
    /** Vault path of the source note. */
    path: string;
    /** Note basename (used as the wikilink target in citations). */
    title: string;
    /** The chunk's text. */
    text: string;
}

export interface ChunkEmbedding extends IndexedChunk {
    embedding: number[];
}

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n?/;

export function stripFrontmatter(md: string): string {
    return md.replace(FRONTMATTER_RE, "").trim();
}

/** Notes whose body (sans frontmatter) is shorter than this are treated as stubs. */
const MIN_INDEX_CHARS = 100;

/** Text fragments that identify an unresolved-link / placeholder stub page. */
const STUB_MARKERS = [
    "Auto-fetch unavailable",
    "自动获取不可用",
    "*To be filled in*",
    "*待填写*",
];

/**
 * Should this note be embedded for Ask My Notes? We skip pages that would only
 * add noise to retrieval:
 *  - Link-resolver reference pages — raw fetched case/statute dumps. These carry
 *    a `source:` frontmatter field that the pipeline's own pages never set.
 *  - Unresolved-link stub placeholders ("*To be filled in*" / "*待填写*").
 *  - Near-empty notes.
 * Keeping these out keeps Ask My Notes focused on the student's curated notes.
 */
export function isIndexableNote(content: string): boolean {
    const fm = content.match(/^---\n([\s\S]*?)\n---/);
    if (fm && /^source:\s*\S/m.test(fm[1])) return false;
    if (STUB_MARKERS.some((marker) => content.includes(marker))) return false;
    return stripFrontmatter(content).length >= MIN_INDEX_CHARS;
}

/**
 * Split markdown into chunks of at most ~`maxChars`, breaking on paragraph
 * boundaries so chunks stay semantically coherent. Frontmatter is dropped.
 */
export function chunkMarkdown(md: string, maxChars = 1500): string[] {
    const text = stripFrontmatter(md);
    if (!text) return [];

    const paragraphs = text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

    const chunks: string[] = [];
    let current = "";
    for (const p of paragraphs) {
        if (current && current.length + p.length + 2 > maxChars) {
            chunks.push(current);
            current = p;
        } else {
            current = current ? `${current}\n\n${p}` : p;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

export interface ScoredChunk {
    index: number;
    score: number;
}

/** Indices of the `topK` embeddings most similar to `query`, best first. */
export function rankBySimilarity(
    query: number[],
    embeddings: number[][],
    topK: number
): ScoredChunk[] {
    const scored: ScoredChunk[] = embeddings.map((e, index) => ({
        index,
        score: cosineSimilarity(query, e),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).filter((s) => s.score > 0);
}

/** One turn of conversation, used for multi-turn follow-ups. */
export interface ChatTurn {
    question: string;
    answer: string;
    sources?: string[];
}

/** Ask My Notes interaction modes — each is a different grounded prompt. */
export type AskMode = "qa" | "irac" | "practice" | "socratic" | "compare";

// Shared policy for every mode. Notes-first, but *helpful*: supplement with
// general legal knowledge (clearly labeled) instead of refusing when the notes
// are thin — and always answer in the student's language.
const COMMON_POLICY = `You are a legal study assistant helping a law student.

- Use the student's NOTES below as your primary source, and cite them as [[Source Title]].
- If the notes don't fully answer, DO still help: add well-established general legal
  knowledge, but clearly mark those additions as "(general knowledge — not in your notes)".
  Never reply with only "the notes don't contain the answer" if you can otherwise help.
- Reply in the SAME LANGUAGE as the user's input (e.g. answer Chinese questions in Chinese).
- Write clean, direct prose. Do NOT echo note titles or headings verbatim.`;

const MODE_TASK: Record<AskMode, { task: string; inputHeading: string }> = {
    qa: { task: "Answer the question.", inputHeading: "# Question" },
    irac: {
        task: "Analyze the fact pattern in IRAC format, with bold headings **Issue**, **Rule**, **Application**, **Conclusion**.",
        inputHeading: "# Fact pattern",
    },
    practice: {
        task: "Pose ONE realistic hypothetical that tests the topic, then give a model answer in IRAC format and a short issue checklist.",
        inputHeading: "# Topic",
    },
    socratic: {
        task: "Run a Socratic cold-call: ask ONE focused, probing question about the topic and then STOP. On the student's next message, evaluate their answer and ask a harder follow-up.",
        inputHeading: "# Topic",
    },
    compare: {
        task: "Compare how US and Chinese law treat the topic in a markdown table with columns | Dimension | United States | China |, then a short paragraph on the key differences.",
        inputHeading: "# Topic",
    },
};

/** Build a grounded prompt for the given mode from the retrieved note chunks. */
export function buildPrompt(
    mode: AskMode,
    input: string,
    contexts: IndexedChunk[],
    history: ChatTurn[] = []
): string {
    const notes = contexts
        .map((c, i) => `[${i + 1}] (Source: [[${c.title}]])\n${c.text}`)
        .join("\n\n");

    // Include the last few turns so follow-ups have context.
    const recent = history.slice(-4);
    const convo = recent.length
        ? "# Conversation so far\n" +
          recent.map((h) => `User: ${h.question}\nAssistant: ${h.answer}`).join("\n\n") +
          "\n\n"
        : "";

    const m = MODE_TASK[mode];
    return `${COMMON_POLICY}

Task: ${m.task}

${convo}${m.inputHeading}
${input}

# Notes
${notes}

# Answer`;
}

/** Backwards-compatible Q&A prompt. */
export function buildRagPrompt(
    question: string,
    contexts: IndexedChunk[],
    history: ChatTurn[] = []
): string {
    return buildPrompt("qa", question, contexts, history);
}

/** Distinct source titles across the retrieved chunks, preserving order. */
export function uniqueSources(contexts: IndexedChunk[]): string[] {
    return [...new Set(contexts.map((c) => c.title))];
}
