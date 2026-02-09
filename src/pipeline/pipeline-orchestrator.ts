import { App, Notice } from "obsidian";
import type {
    ExtractedEntities,
    LawNoteSettings,
    PipelineState,
    RelationshipMatrix,
    SourceDocument,
} from "../types";
import { runStep1 } from "./step1-source-select";
import { runStep2 } from "./step2-entity-extract";
import { runStep3 } from "./step3-relationship-map";
import { runStep4 } from "./step4-generate-output";
import { CourseSelectModal, type CourseSelection } from "../ui/course-select-modal";
import { loadPipelineState, savePipelineState } from "./state-persistence";
import { mergeEntities, deduplicateEntities } from "./entity-merger";
import { ensureFolderExists } from "../utils/vault-helpers";

export class PipelineOrchestrator {
    private app: App;
    private settings: LawNoteSettings;
    private state: PipelineState;
    private aborted = false;

    constructor(app: App, settings: LawNoteSettings) {
        this.app = app;
        this.settings = settings;
        this.state = {
            currentStep: "idle",
            sourceDocuments: [],
            extractedEntities: null,
            relationshipMatrix: null,
            generatedFiles: [],
            errors: [],
        };
    }

    async start(stopAfter?: string): Promise<void> {
        this.aborted = false;

        // Step 1: Source selection
        this.state.currentStep = "source-select";
        new Notice("Step 1/4: Select source files (选择源文件)");

        const documents = await runStep1(this.app);
        if (!documents || this.aborted) return;
        this.state.sourceDocuments = documents;

        // Step 1b: Course selection
        const courseSelection = await this.selectCourse();
        if (!courseSelection || this.aborted) return;

        const effectiveOutputFolder = courseSelection.courseName
            ? `${this.settings.outputFolder}/${courseSelection.courseName}`
            : this.settings.outputFolder;

        // Ensure course folder exists
        await ensureFolderExists(this.app.vault, effectiveOutputFolder);

        // Load existing state if incremental
        let existingState: { entities: ExtractedEntities; matrix: RelationshipMatrix } | null = null;
        if (courseSelection.incremental) {
            const loaded = await loadPipelineState(
                this.app.vault,
                effectiveOutputFolder
            );
            if (loaded) {
                existingState = {
                    entities: loaded.entities,
                    matrix: loaded.matrix,
                };
                new Notice(
                    `Loaded existing data: ${loaded.entities.concepts.length} concepts, ${loaded.entities.cases.length} cases (已加载历史数据)`
                );
            }
        }

        // Step 2: Entity extraction
        this.state.currentStep = "entity-extract";
        let entities = await runStep2(
            this.app,
            this.settings,
            documents
        );
        if (!entities || this.aborted) return;

        // Merge with existing state if incremental
        if (existingState) {
            entities = mergeEntities(existingState.entities, entities);
            new Notice(
                `Merged: ${entities.concepts.length} concepts, ${entities.cases.length} cases total (合并后)`
            );
        }

        // Deduplicate
        entities = deduplicateEntities(entities);

        this.state.extractedEntities = entities;

        if (stopAfter === "entity-extract") {
            this.state.currentStep = "complete";
            new Notice("Entity extraction complete! (实体提取完成)");
            return;
        }

        // Step 3: Relationship mapping
        this.state.currentStep = "relationship-map";
        const matrix = await runStep3(
            this.app,
            this.settings,
            entities,
            documents
        );
        if (!matrix || this.aborted) return;
        this.state.relationshipMatrix = matrix;

        // Step 4: Generate output
        this.state.currentStep = "generate-output";
        const files = await runStep4(
            this.app,
            this.settings,
            entities,
            matrix,
            effectiveOutputFolder
        );
        this.state.generatedFiles = files;

        // Save state for future incremental updates
        const allSourceFiles = entities.metadata.sourceDocuments;
        await savePipelineState(
            this.app.vault,
            effectiveOutputFolder,
            entities,
            matrix,
            allSourceFiles
        );

        this.state.currentStep = "complete";

        const courseLabel = courseSelection.courseName
            ? ` [${courseSelection.courseName}]`
            : "";
        new Notice(
            `Pipeline complete!${courseLabel} Generated ${files.length} files. (流程完成！已生成 ${files.length} 个文件)`
        );
    }

    private selectCourse(): Promise<CourseSelection | null> {
        return new Promise((resolve) => {
            const modal = new CourseSelectModal(
                this.app,
                this.settings.outputFolder,
                (selection) => resolve(selection),
                () => resolve(null)
            );
            modal.open();
        });
    }

    abort(): void {
        this.aborted = true;
    }
}
