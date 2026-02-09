import { App, Notice } from "obsidian";
import { GeminiClient } from "../ai/gemini-client";
import { buildRelationshipMappingPrompt } from "../ai/prompts";
import { RelationshipMatrixSchema } from "../ai/schemas";
import { RelationshipReviewModal } from "../ui/relationship-review-modal";
import { ProgressModal } from "../ui/progress-modal";
import type {
    ExtractedEntities,
    LawNoteSettings,
    RelationshipMatrix,
    SourceDocument,
} from "../types";

export async function runStep3(
    app: App,
    settings: LawNoteSettings,
    entities: ExtractedEntities,
    documents: SourceDocument[]
): Promise<RelationshipMatrix | null> {
    const client = new GeminiClient(settings);

    const sourceText = documents
        .map((d) => `--- SOURCE: ${d.filename} ---\n${d.rawText}`)
        .join("\n\n");

    const prompt = buildRelationshipMappingPrompt(
        entities,
        sourceText,
        settings.language
    );

    const progressModal = new ProgressModal(app);
    progressModal.open();
    progressModal.setStep(
        "Step 3/4: Mapping relationships... (正在映射关系)"
    );
    progressModal.onCancelClick(() => client.abort());

    let matrix: RelationshipMatrix;
    try {
        if (settings.enableStreaming) {
            matrix = await client.generateStructuredStreaming(
                prompt,
                RelationshipMatrixSchema,
                (_chunk, accumulated) => {
                    progressModal.updatePreview(accumulated);
                }
            );
        } else {
            matrix = await client.generateStructured(
                prompt,
                RelationshipMatrixSchema
            );
        }
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        progressModal.addError(`Relationship mapping failed:\n${errMsg}`);
        progressModal.showStopped("Relationship Mapping Failed (关系映射失败)");
        await new Promise<void>((resolve) => {
            const origClose = progressModal.onClose.bind(progressModal);
            progressModal.onClose = () => { origClose(); resolve(); };
        });
        return null;
    }

    progressModal.close();

    new Notice(
        `Mapped ${matrix.entries.length} relationships across ${matrix.casesInOrder.length} cases and ${matrix.conceptsInOrder.length} concepts`
    );

    // User review
    return new Promise((resolve) => {
        const reviewModal = new RelationshipReviewModal(
            app,
            matrix,
            entities,
            (confirmed) => resolve(confirmed),
            () => resolve(null)
        );
        reviewModal.open();
    });
}
