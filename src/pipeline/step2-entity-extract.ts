import { App, Notice } from "obsidian";
import { GeminiClient } from "../ai/gemini-client";
import { buildEntityExtractionPrompt } from "../ai/prompts";
import { ExtractedEntitiesSchema } from "../ai/schemas";
import { EntityReviewModal } from "../ui/entity-review-modal";
import { ProgressModal } from "../ui/progress-modal";
import type {
    ExtractedEntities,
    LawNoteSettings,
    SourceDocument,
} from "../types";

export async function runStep2(
    app: App,
    settings: LawNoteSettings,
    documents: SourceDocument[]
): Promise<ExtractedEntities | null> {
    const client = new GeminiClient(settings);

    // Build source text with markers
    const sourceText = documents
        .map((d) => `--- SOURCE: ${d.filename} ---\n${d.rawText}`)
        .join("\n\n");

    const prompt = buildEntityExtractionPrompt(sourceText, settings.language);

    // Show progress modal
    const progressModal = new ProgressModal(app);
    progressModal.open();
    progressModal.setStep("Step 2/4: Extracting entities... (正在提取实体)");
    progressModal.onCancelClick(() => client.abort());

    let entities: ExtractedEntities;
    try {
        if (settings.enableStreaming) {
            entities = await client.generateStructuredStreaming(
                prompt,
                ExtractedEntitiesSchema,
                (_chunk, accumulated) => {
                    progressModal.updatePreview(accumulated);
                }
            );
        } else {
            entities = await client.generateStructured(
                prompt,
                ExtractedEntitiesSchema
            );
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
