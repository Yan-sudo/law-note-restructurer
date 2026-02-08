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

        // Step 2: Entity extraction
        this.state.currentStep = "entity-extract";
        const entities = await runStep2(
            this.app,
            this.settings,
            documents
        );
        if (!entities || this.aborted) return;
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
            matrix
        );
        this.state.generatedFiles = files;
        this.state.currentStep = "complete";

        new Notice(
            `Pipeline complete! Generated ${files.length} files. (流程完成！已生成 ${files.length} 个文件)`
        );
    }

    abort(): void {
        this.aborted = true;
    }
}
