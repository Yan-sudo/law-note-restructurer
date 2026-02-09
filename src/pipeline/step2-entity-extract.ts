import { App, Notice } from "obsidian";
import { GeminiClient } from "../ai/gemini-client";
import { buildEntityExtractionPrompt } from "../ai/prompts";
import { ExtractedEntitiesSchema } from "../ai/schemas";
import { EntityReviewModal } from "../ui/entity-review-modal";
import { ProgressModal } from "../ui/progress-modal";
import { mergeEntities, deduplicateEntities } from "./entity-merger";
import type {
    ExtractedEntities,
    LawNoteSettings,
    SourceDocument,
} from "../types";
import { estimateTokens } from "../types";

/**
 * Max source tokens per extraction chunk.
 * Gemini outputs ~3-4x fewer tokens than input for extraction,
 * but very large inputs produce JSON that exceeds output token limits.
 * 40K source tokens → ~15K output tokens (safe for 65K limit).
 */
const MAX_SOURCE_TOKENS_PER_CHUNK = 40000;

export async function runStep2(
    app: App,
    settings: LawNoteSettings,
    documents: SourceDocument[]
): Promise<ExtractedEntities | null> {
    const client = new GeminiClient(settings);

    // Check if we need to chunk
    const fullSourceText = documents
        .map((d) => `--- SOURCE: ${d.filename} ---\n${d.rawText}`)
        .join("\n\n");
    const totalTokens = estimateTokens(fullSourceText);

    const progressModal = new ProgressModal(app);
    progressModal.open();
    progressModal.onCancelClick(() => client.abort());

    let entities: ExtractedEntities;

    try {
        if (totalTokens <= MAX_SOURCE_TOKENS_PER_CHUNK) {
            // Single extraction (fits in one call)
            entities = await extractSingle(
                client, settings, fullSourceText, progressModal, 1, 1
            );
        } else {
            // Chunked extraction
            const chunks = buildChunks(documents);
            new Notice(
                `Source is large (~${Math.round(totalTokens / 1000)}K tokens). Splitting into ${chunks.length} chunks. (源文档较大，分${chunks.length}批提取)`
            );

            let merged: ExtractedEntities | null = null;

            for (let i = 0; i < chunks.length; i++) {
                const chunkText = chunks[i]
                    .map((d) => `--- SOURCE: ${d.filename} ---\n${d.rawText}`)
                    .join("\n\n");

                const chunkEntities = await extractSingle(
                    client, settings, chunkText, progressModal, i + 1, chunks.length
                );

                if (!merged) {
                    merged = chunkEntities;
                } else {
                    merged = mergeEntities(merged, chunkEntities);
                }
            }

            entities = deduplicateEntities(merged!);
        }
    } catch (error) {
        progressModal.close();
        new Notice(`Entity extraction failed: ${error}`);
        return null;
    }

    progressModal.close();

    new Notice(
        `Extracted: ${entities.concepts.length} concepts, ${entities.cases.length} cases, ` +
        `${entities.principles.length} principles, ${entities.rules.length} rules`
    );

    // User review
    return new Promise((resolve) => {
        const reviewModal = new EntityReviewModal(
            app,
            entities,
            (confirmed) => resolve(confirmed),
            () => {
                // Re-extract: recursively call this step
                runStep2(app, settings, documents).then(resolve);
            },
            () => resolve(null)
        );
        reviewModal.open();
    });
}

async function extractSingle(
    client: GeminiClient,
    settings: LawNoteSettings,
    sourceText: string,
    progressModal: ProgressModal,
    chunkNum: number,
    totalChunks: number
): Promise<ExtractedEntities> {
    const label = totalChunks > 1
        ? `Step 2/4: Extracting entities (chunk ${chunkNum}/${totalChunks})...`
        : "Step 2/4: Extracting entities... (正在提取实体)";

    progressModal.setStep(label);
    const prompt = buildEntityExtractionPrompt(sourceText, settings.language);

    if (settings.enableStreaming) {
        return client.generateStructuredStreaming(
            prompt,
            ExtractedEntitiesSchema,
            (_chunk, accumulated) => {
                progressModal.updatePreview(accumulated);
            }
        );
    } else {
        return client.generateStructured(prompt, ExtractedEntitiesSchema);
    }
}

/**
 * Split documents into chunks where each chunk's total token count
 * is below MAX_SOURCE_TOKENS_PER_CHUNK.
 * Each document stays intact (never split mid-document).
 */
function buildChunks(documents: SourceDocument[]): SourceDocument[][] {
    const chunks: SourceDocument[][] = [];
    let currentChunk: SourceDocument[] = [];
    let currentTokens = 0;

    for (const doc of documents) {
        const docTokens = estimateTokens(doc.rawText);

        // If a single document exceeds the limit, it gets its own chunk
        if (docTokens > MAX_SOURCE_TOKENS_PER_CHUNK) {
            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = [];
                currentTokens = 0;
            }
            chunks.push([doc]);
            continue;
        }

        if (currentTokens + docTokens > MAX_SOURCE_TOKENS_PER_CHUNK && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = [];
            currentTokens = 0;
        }

        currentChunk.push(doc);
        currentTokens += docTokens;
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    return chunks;
}
