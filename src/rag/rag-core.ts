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

const MODE_INSTRUCTIONS: Record<AskMode, { intro: string; inputHeading: string }> = {
    qa: {
        intro:
            "You are a legal study assistant. Answer the question using ONLY the notes below. " +
            "Cite the sources you rely on as [[Source Title]]. If the notes do not contain the " +
            "answer, say so plainly rather than guessing.",
        inputHeading: "# Question",
    },
    irac: {
        intro:
            "You are a legal study assistant. Analyze the fact pattern using ONLY the notes below. " +
            "Respond in IRAC format with bold headings **Issue**, **Rule**, **Application**, " +
            "**Conclusion**. Cite authorities as [[Source Title]]. If the notes lack a rule you need, say so.",
        inputHeading: "# Fact pattern",
    },
    practice: {
        intro:
            "You are a law professor writing an exam question. Using ONLY the notes below: " +
            "(1) pose ONE realistic hypothetical that tests the topic, (2) give a model answer in " +
            "IRAC format, and (3) add a short issue checklist. Cite authorities as [[Source Title]].",
        inputHeading: "# Topic",
    },
    socratic: {
        intro:
            "You are a law professor running a Socratic cold-call. Using the notes below, ask the " +
            "student ONE focused, probing question about the topic and then STOP — do not answer it. " +
            "On the student's next message, evaluate their answer against the notes and ask a harder " +
            "follow-up. Cite authorities as [[Source Title]].",
        inputHeading: "# Topic",
    },
    compare: {
        intro:
            "You are a comparative-law assistant. Using ONLY the notes below, compare how US and " +
            "Chinese law treat the topic. Output a markdown table with columns " +
            "| Dimension | United States | China |, then a short paragraph on the key differences. " +
            "Cite authorities as [[Source Title]]. If the notes cover only one jurisdiction, say so.",
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

    const m = MODE_INSTRUCTIONS[mode];
    return `${m.intro}

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
