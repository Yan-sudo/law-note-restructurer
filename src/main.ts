import { Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, type LawNoteSettings } from "./types";
import { LawNoteSettingTab } from "./settings";
import { PipelineOrchestrator } from "./pipeline/pipeline-orchestrator";
import { runLinkResolver } from "./link-resolver/resolver-orchestrator";
import { createLLMClient } from "./ai/llm-client-factory";
import { AskView, ASK_VIEW_TYPE } from "./rag/ask-view";
import type { ChatTurn } from "./rag/rag-core";
import {
    answerQuestion,
    buildIndex,
    loadIndex,
    saveIndex,
    type RagIndex,
} from "./rag/rag-index";

export default class LawNoteRestructurerPlugin extends Plugin {
    settings: LawNoteSettings = DEFAULT_SETTINGS;
    private pipeline: PipelineOrchestrator | null = null;
    private ragIndex: RagIndex | null = null;
    /** In-memory Ask My Notes conversation (survives panel close/reopen). */
    chatHistory: ChatTurn[] = [];

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

    /** Folder whose notes get embedded — the chosen scope, or the whole output folder. */
    private get ragScopePrefix(): string {
        return this.settings.ragScopeFolder || this.settings.outputFolder;
    }

    /** Drop the cached index (e.g. after the folder scope changes). */
    resetIndexCache(): void {
        this.ragIndex = null;
    }

    clearChat(): void {
        this.chatHistory = [];
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
     * (unchanged files keep their embeddings), scoped to the chosen folder, and
     * the answer is appended to the conversation history.
     */
    async askQuestion(question: string): Promise<ChatTurn> {
        if (!this.settings.geminiApiKey) {
            throw new Error("Set your Gemini API key in Settings first.");
        }
        const client = createLLMClient(this.settings);

        if (!this.ragIndex) {
            this.ragIndex = await loadIndex(this.app.vault, this.ragIndexPath);
        }
        // Incremental build scoped to the chosen folder: reuses matching files'
        // embeddings, embeds only new/changed ones, drops out-of-scope files.
        this.ragIndex = await buildIndex(
            this.app.vault,
            client,
            this.ragScopePrefix,
            this.ragIndex ?? undefined
        );
        await saveIndex(this.app.vault, this.ragIndexPath, this.ragIndex);

        const { answer, sources } = await answerQuestion(
            client,
            this.ragIndex,
            question,
            this.chatHistory
        );
        const turn: ChatTurn = { question, answer, sources };
        this.chatHistory.push(turn);
        return turn;
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
                this.ragScopePrefix,
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
