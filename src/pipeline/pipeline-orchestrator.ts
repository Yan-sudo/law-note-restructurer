import { App, Notice, TFile } from "obsidian";
import type { LawNoteSettings, PipelineState, SourceDocument } from "../types";
import { runStep1 } from "./step1-source-select";
import { runStep2 } from "./step2-entity-extract";
import { runStep3 } from "./step3-relationship-map";
import { runStep4 } from "./step4-generate-output";
import { parseMarkdownFile } from "../parsers/markdown-parser";
import { parseDocxFile } from "../parsers/docx-parser";
import { CourseSelectModal, type CourseSelection } from "../ui/course-select-modal";
import { loadPipelineState, savePipelineState, type PersistedState } from "./state-persistence";
import { mergeEntities, deduplicateEntities } from "./entity-merger";
import { diffEntities } from "./entity-diff";
import {
    detectChangedSources,
    mergeSignatures,
    watchedFolders,
    type SourceSignature,
} from "./source-tracking";
import { ensureFolderExists } from "../utils/vault-helpers";
import { addCrossCourseLinks } from "../utils/cross-course-linker";
import {
    estimateCostUSD,
    formatTokens,
    formatUSD,
    isLocalGeneration,
    usageSummary,
    type TokenUsage,
} from "../ai/cost";

export class PipelineOrchestrator {
    private app: App;
    private settings: LawNoteSettings;
    private state: PipelineState;
    private aborted = false;
    private persistSettings?: () => Promise<void>;

    constructor(app: App, settings: LawNoteSettings, persistSettings?: () => Promise<void>) {
        this.app = app;
        this.settings = settings;
        this.persistSettings = persistSettings;
        this.state = {
            currentStep: "idle",
            sourceDocuments: [],
            extractedEntities: null,
            relationshipMatrix: null,
            generatedFiles: [],
            errors: [],
        };
    }

    /** Full pipeline: pick files + course interactively, then process. */
    async start(stopAfter?: string): Promise<void> {
        this.aborted = false;

        this.state.currentStep = "source-select";
        new Notice("Step 1/4: Select source files (选择源文件)");

        const documents = await runStep1(this.app);
        if (!documents || this.aborted) return;

        const courseSelection = await this.selectCourse();
        if (!courseSelection || this.aborted) return;

        await this.process(documents, courseSelection, stopAfter);
    }

    /**
     * One-command incremental update: pick a course, auto-detect which source
     * notes are new/changed (by mtime), and process only those — no file picker,
     * no redoing old material.
     */
    async startIncremental(): Promise<void> {
        this.aborted = false;

        const courseSelection = await this.selectCourse();
        if (!courseSelection || this.aborted) return;

        await this.incrementalForCourse(courseSelection.courseName, { silent: false });
    }

    /**
     * Incremental update for one course without the course picker. `silent`
     * suppresses the "nothing to do" notices (used by the background
     * auto-updater). Returns the number of changed notes processed.
     */
    async incrementalForCourse(
        courseName: string,
        opts: { silent?: boolean } = {}
    ): Promise<number> {
        this.aborted = false;
        const silent = opts.silent ?? false;

        const folder = this.effectiveOutputFolder(courseName);
        const state = await loadPipelineState(this.app.vault, folder);
        if (!state) {
            if (!silent) {
                new Notice("No saved knowledge base for this course yet. Run 'Restructure Legal Notes' first.");
            }
            return 0;
        }
        const recorded = state.sources ?? [];
        if (recorded.length === 0) {
            if (!silent) {
                new Notice("This course predates change-tracking. Run the full pipeline once to enable updates.");
            }
            return 0;
        }

        const current = this.scanSignatures(watchedFolders(recorded));
        const changedPaths = detectChangedSources(current, recorded);
        if (changedPaths.length === 0) {
            if (!silent) {
                new Notice("Knowledge base is up to date — no new or changed notes. (无新增/改动)");
            }
            return 0;
        }

        if (!silent) {
            new Notice(`Found ${changedPaths.length} new/changed note(s). Updating… (发现 ${changedPaths.length} 个改动，增量更新中)`);
        }

        const documents: SourceDocument[] = [];
        for (const path of changedPaths) {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!(file instanceof TFile)) continue;
            if (file.extension === "md") documents.push(await parseMarkdownFile(this.app, file));
            else if (file.extension === "docx") documents.push(await parseDocxFile(this.app, file));
        }
        if (documents.length === 0 || this.aborted) return 0;

        await this.process(documents, { courseName, incremental: true });
        return documents.length;
    }

    /** Shared pipeline body: extract → merge → map → generate → save, given documents + course. */
    private async process(
        documents: SourceDocument[],
        courseSelection: CourseSelection,
        stopAfter?: string
    ): Promise<void> {
        this.state.sourceDocuments = documents;
        const usage: TokenUsage = { tokens: 0 };

        // Pre-run cost estimate (input tokens only — output adds more). Cloud only.
        if (!isLocalGeneration(this.settings)) {
            const inputTokens = documents.reduce((sum, d) => sum + d.tokenEstimate, 0);
            new Notice(
                `Estimated input: ${formatTokens(inputTokens)} tokens · ~${formatUSD(
                    estimateCostUSD(this.settings.modelName, inputTokens)
                )}+ (预计花费，输出另计)`
            );
        }

        const effectiveOutputFolder = this.effectiveOutputFolder(courseSelection.courseName);
        await ensureFolderExists(this.app.vault, effectiveOutputFolder);

        // Load existing state if incremental
        let existingState: PersistedState | null = null;
        if (courseSelection.incremental) {
            existingState = await loadPipelineState(this.app.vault, effectiveOutputFolder);
            if (existingState) {
                new Notice(
                    `Loaded existing data: ${existingState.entities.concepts.length} concepts, ${existingState.entities.cases.length} cases (已加载历史数据)`
                );
            }
        }

        // Step 2: Entity extraction (from the supplied documents only)
        this.state.currentStep = "entity-extract";
        let entities = await runStep2(this.app, this.settings, documents, usage);
        if (!entities || this.aborted) return;

        if (existingState) {
            entities = mergeEntities(existingState.entities, entities);
            new Notice(
                `Merged: ${entities.concepts.length} concepts, ${entities.cases.length} cases total (合并后)`
            );
        }

        entities = deduplicateEntities(entities);

        // What changed vs the previous knowledge base (drives the What's New graph).
        const diff = diffEntities(existingState?.entities ?? { concepts: [], cases: [] }, entities);

        this.state.extractedEntities = entities;

        if (stopAfter === "entity-extract") {
            this.state.currentStep = "complete";
            new Notice("Entity extraction complete! (实体提取完成)");
            return;
        }

        // Step 3: Relationship mapping (over the full merged set)
        this.state.currentStep = "relationship-map";
        const matrix = await runStep3(this.app, this.settings, entities, documents, usage);
        if (!matrix || this.aborted) return;
        this.state.relationshipMatrix = matrix;

        // Step 4: Generate output
        this.state.currentStep = "generate-output";
        const files = await runStep4(
            this.app,
            this.settings,
            entities,
            matrix,
            effectiveOutputFolder,
            courseSelection.courseName || undefined,
            diff,
            usage
        );
        this.state.generatedFiles = files;

        // Save state (incl. updated source signatures) for future incremental updates
        const mergedSignatures = mergeSignatures(
            existingState?.sources ?? [],
            this.signaturesFor(documents)
        );
        await savePipelineState(
            this.app.vault,
            effectiveOutputFolder,
            entities,
            matrix,
            entities.metadata.sourceDocuments,
            mergedSignatures
        );

        // Cross-course linking: add "See also" links for shared concepts/cases
        let crossLinked = 0;
        if (courseSelection.courseName) {
            crossLinked = await addCrossCourseLinks(
                this.app.vault,
                this.settings.outputFolder,
                courseSelection.courseName
            );
        }

        this.state.currentStep = "complete";

        // Cost meter: record this run against the lifetime total and report it.
        this.settings.lifetimeTokensUsed = (this.settings.lifetimeTokensUsed ?? 0) + usage.tokens;
        await this.persistSettings?.();

        const courseLabel = courseSelection.courseName ? ` [${courseSelection.courseName}]` : "";
        const crossMsg =
            crossLinked > 0 ? ` ${crossLinked} cross-course links added. (${crossLinked} 个跨课程链接)` : "";
        new Notice(
            `Pipeline complete!${courseLabel} Generated ${files.length} files.${crossMsg} ` +
                `This run: ${usageSummary(this.settings, usage.tokens)}. (本次用量) ` +
                `(流程完成！已生成 ${files.length} 个文件)`
        );
    }

    private effectiveOutputFolder(courseName: string): string {
        return courseName ? `${this.settings.outputFolder}/${courseName}` : this.settings.outputFolder;
    }

    /** Signatures (path + mtime) for documents that still resolve to a vault file. */
    private signaturesFor(documents: SourceDocument[]): SourceSignature[] {
        const out: SourceSignature[] = [];
        for (const doc of documents) {
            const file = this.app.vault.getAbstractFileByPath(doc.path);
            if (file instanceof TFile) out.push({ path: doc.path, mtime: file.stat.mtime });
        }
        return out;
    }

    /** Current signatures of all .md/.docx source notes within the watched folders. */
    private scanSignatures(folders: string[]): SourceSignature[] {
        const outputRoot = this.settings.outputFolder;
        const out: SourceSignature[] = [];
        for (const file of this.app.vault.getFiles()) {
            if (file.extension !== "md" && file.extension !== "docx") continue;
            if (file.path === outputRoot || file.path.startsWith(`${outputRoot}/`)) continue; // skip generated
            const inWatched = folders.some((folder) =>
                folder === "" ? !file.path.includes("/") : file.path.startsWith(`${folder}/`)
            );
            if (inWatched) out.push({ path: file.path, mtime: file.stat.mtime });
        }
        return out;
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
