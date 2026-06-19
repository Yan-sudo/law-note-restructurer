import { Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, type LawNoteSettings } from "./types";
import { LawNoteSettingTab } from "./settings";
import { PipelineOrchestrator } from "./pipeline/pipeline-orchestrator";
import { runLinkResolver } from "./link-resolver/resolver-orchestrator";
import { createLLMClient } from "./ai/llm-client-factory";
import { AskView, ASK_VIEW_TYPE } from "./rag/ask-view";
import {
    answerQuestion,
    buildIndex,
    loadIndex,
    saveIndex,
    type RagAnswer,
    type RagIndex,
} from "./rag/rag-index";

export default class LawNoteRestructurerPlugin extends Plugin {
    settings: LawNoteSettings = DEFAULT_SETTINGS;
    private pipeline: PipelineOrchestrator | null = null;
    private ragIndex: RagIndex | null = null;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.addSettingTab(new LawNoteSettingTab(this.app, this));

        this.registerView(ASK_VIEW_TYPE, (leaf) => new AskView(leaf, this));
        this.addRibbonIcon("search", "Ask My Notes (问我的笔记)", () => {
            void this.activateAskView();
        });

        this.addCommand({
            id: "start-restructure-pipeline",
            name: "Restructure Legal Notes (重构法学笔记)",
            callback: () => this.startPipeline(),
        });

        this.addCommand({
            id: "extract-entities-only",
            name: "Extract Legal Entities Only (仅提取实体)",
            callback: () => this.startPipeline("entity-extract"),
        });

        this.addCommand({
            id: "resolve-unresolved-links",
            name: "Resolve Unresolved Links (解析未解析链接)",
            callback: () => runLinkResolver(this.app, this.settings),
        });

        this.addCommand({
            id: "ask-my-notes",
            name: "Ask My Notes (问我的笔记)",
            callback: () => this.activateAskView(),
        });

        this.addCommand({
            id: "rebuild-notes-index",
            name: "Rebuild Notes Index (重建笔记索引)",
            callback: () => this.rebuildNotesIndex(),
        });
    }

    private get ragIndexPath(): string {
        return `${this.settings.outputFolder}/.rag-index.json`;
    }

    /** Open (or reveal) the Ask My Notes panel in the right sidebar. */
    private async activateAskView(): Promise<void> {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(ASK_VIEW_TYPE)[0];
        if (!leaf) {
            const right = workspace.getRightLeaf(false);
            if (!right) return;
            leaf = right;
            await leaf.setViewState({ type: ASK_VIEW_TYPE, active: true });
        }
        await workspace.revealLeaf(leaf);
    }

    /**
     * Answer a question against the notes. The index is refreshed incrementally
     * first (unchanged files keep their embeddings), then queried.
     */
    async askQuestion(question: string): Promise<RagAnswer> {
        if (!this.settings.geminiApiKey) {
            throw new Error("Set your Gemini API key in Settings first.");
        }
        const client = createLLMClient(this.settings);
        if (!this.ragIndex) {
            this.ragIndex = await loadIndex(this.app.vault, this.ragIndexPath);
        }
        this.ragIndex = await buildIndex(
            this.app.vault,
            client,
            this.settings.outputFolder,
            this.ragIndex ?? undefined
        );
        await saveIndex(this.app.vault, this.ragIndexPath, this.ragIndex);
        return answerQuestion(client, this.ragIndex, question);
    }

    private async rebuildNotesIndex(): Promise<void> {
        if (!this.settings.geminiApiKey) {
            new Notice("Please set your Gemini API key in Settings first.");
            return;
        }
        const client = createLLMClient(this.settings);
        new Notice("Rebuilding notes index… (重建索引中)");
        try {
            // Pass null to force a full rebuild rather than an incremental update.
            this.ragIndex = await buildIndex(
                this.app.vault,
                client,
                this.settings.outputFolder,
                null
            );
            await saveIndex(this.app.vault, this.ragIndexPath, this.ragIndex);
            new Notice("Notes index rebuilt. (索引已重建)");
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            new Notice(`Index build failed: ${msg}`);
        }
    }

    openNoteByTitle(title: string): void {
        const file = this.app.vault.getMarkdownFiles().find((f) => f.basename === title);
        if (file instanceof TFile) {
            void this.app.workspace.getLeaf().openFile(file);
        } else {
            new Notice(`Note not found: ${title}`);
        }
    }

    private startPipeline(stopAfter?: string): void {
        if (!this.settings.geminiApiKey) {
            new Notice("Please set your Gemini API key in Settings first.");
            return;
        }
        this.pipeline = new PipelineOrchestrator(this.app, this.settings);
        this.pipeline.start(stopAfter);
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    onunload(): void {
        this.pipeline?.abort();
    }
}
