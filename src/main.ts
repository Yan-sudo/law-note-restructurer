import { Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, type LawNoteSettings } from "./types";
import { LawNoteSettingTab } from "./settings";
import { PipelineOrchestrator } from "./pipeline/pipeline-orchestrator";
import { runLinkResolver } from "./link-resolver/resolver-orchestrator";
import { createLLMClient } from "./ai/llm-client-factory";
import { createEmbedder, embedderSignature } from "./ai/embedder";
import { AskView, ASK_VIEW_TYPE } from "./rag/ask-view";
import { HomeView, HOME_VIEW_TYPE } from "./ui/home-view";
import { CourseSelectModal, type CourseSelection } from "./ui/course-select-modal";
import { OutlineOptionsModal } from "./ui/outline-options-modal";
import { TocReorderModal } from "./ui/toc-reorder-modal";
import { loadPipelineState } from "./pipeline/state-persistence";
import { generateToc, generateOutlineFromToc } from "./generators/outline-builder";
import type { OutlineOptions, Toc } from "./ai/outline";
import { withPreservedNotes } from "./utils/user-notes";
import type { AskMode, ChatTurn } from "./rag/rag-core";
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
        this.registerView(HOME_VIEW_TYPE, (leaf) => new HomeView(leaf, this));

        // Graphical entry points: a control-panel ribbon + a quick chat ribbon.
        this.addRibbonIcon("scale", "Law Notes panel (控制台)", () => {
            void this.openHomePanel();
        });
        this.addRibbonIcon("search", "Ask My Notes (问我的笔记)", () => {
            this.openAskPanel();
        });

        this.addCommand({
            id: "open-law-notes-panel",
            name: "Open Law Notes panel (打开控制台)",
            callback: () => this.openHomePanel(),
        });

        this.addCommand({
            id: "start-restructure-pipeline",
            name: "Restructure Legal Notes (重构法学笔记)",
            callback: () => this.runFullPipeline(),
        });

        this.addCommand({
            id: "extract-entities-only",
            name: "Extract Legal Entities Only (仅提取实体)",
            callback: () => this.runFullPipeline("entity-extract"),
        });

        this.addCommand({
            id: "update-knowledge-base",
            name: "Update Knowledge Base (增量更新)",
            callback: () => this.updateKnowledgeBase(),
        });

        this.addCommand({
            id: "build-outline",
            name: "Build Outline (构建大纲：调详细度/结构 + 拖拽目录)",
            callback: () => void this.buildOutline(),
        });

        this.addCommand({
            id: "resolve-unresolved-links",
            name: "Resolve Unresolved Links (解析未解析链接)",
            callback: () => this.resolveLinks(),
        });

        this.addCommand({
            id: "ask-my-notes",
            name: "Ask My Notes (问我的笔记)",
            callback: () => this.openAskPanel(),
        });

        this.addCommand({
            id: "rebuild-notes-index",
            name: "Rebuild Notes Index (重建笔记索引)",
            callback: () => this.rebuildIndex(),
        });
    }

    // ── Public actions (shared by commands, the ribbon, and the Home panel) ──

    runFullPipeline(stopAfter?: string): void {
        this.startPipeline(stopAfter);
    }
    updateKnowledgeBase(): void {
        this.startIncrementalUpdate();
    }
    resolveLinks(): void {
        runLinkResolver(this.app, this.settings);
    }
    openAskPanel(): void {
        void this.activateAskView();
    }
    rebuildIndex(): void {
        void this.rebuildNotesIndex();
    }

    /**
     * Interactive outline builder: pick detail + structure → AI proposes a table
     * of contents → user drags/edits it → AI writes the full outline in that order.
     */
    async buildOutline(): Promise<void> {
        if (this.missingGeminiKey()) {
            new Notice("Please set your Gemini API key in Settings first.");
            return;
        }
        const course = await this.promptCourse();
        if (!course) return;
        const folder = course.courseName
            ? `${this.settings.outputFolder}/${course.courseName}`
            : this.settings.outputFolder;

        const state = await loadPipelineState(this.app.vault, folder);
        if (!state) {
            new Notice("No knowledge base for this course yet. Run 'Restructure Legal Notes' first.");
            return;
        }

        const options = await this.promptOutlineOptions();
        if (!options) return;

        const client = createLLMClient(this.settings);

        new Notice("Proposing a table of contents… (生成目录中)");
        let toc: Toc;
        try {
            toc = await generateToc(client, state.entities, options, this.settings.language);
        } catch (error) {
            new Notice(`TOC failed: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }

        const finalToc = await this.promptTocReorder(toc);
        if (!finalToc) return;

        new Notice("Generating outline… (生成大纲中)");
        let markdown: string;
        try {
            markdown = await generateOutlineFromToc(
                client,
                state.entities,
                finalToc,
                options,
                this.settings.language
            );
        } catch (error) {
            new Notice(`Outline failed: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }

        const path = `${folder}/Outline.md`;
        const existing = this.app.vault.getAbstractFileByPath(path);
        let file: TFile;
        if (existing instanceof TFile) {
            const old = await this.app.vault.read(existing);
            await this.app.vault.modify(existing, withPreservedNotes(old, markdown));
            file = existing;
        } else {
            file = await this.app.vault.create(path, withPreservedNotes("", markdown));
        }
        await this.app.workspace.getLeaf().openFile(file);
        new Notice("Outline ready. (大纲已生成)");
    }

    private promptCourse(): Promise<CourseSelection | null> {
        return new Promise((resolve) => {
            new CourseSelectModal(
                this.app,
                this.settings.outputFolder,
                (selection) => resolve(selection),
                () => resolve(null)
            ).open();
        });
    }
    private promptOutlineOptions(): Promise<OutlineOptions | null> {
        return new Promise((resolve) => new OutlineOptionsModal(this.app, resolve).open());
    }
    private promptTocReorder(toc: Toc): Promise<Toc | null> {
        return new Promise((resolve) => new TocReorderModal(this.app, toc, resolve).open());
    }

    private async openHomePanel(): Promise<void> {
        await this.revealView(HOME_VIEW_TYPE);
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
    private activateAskView(): Promise<void> {
        return this.revealView(ASK_VIEW_TYPE);
    }

    /** Open (or focus) a sidebar view of the given type. */
    private async revealView(type: string): Promise<void> {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(type)[0];
        if (!leaf) {
            const right = workspace.getRightLeaf(false);
            if (!right) return;
            leaf = right;
            await leaf.setViewState({ type, active: true });
        }
        await workspace.revealLeaf(leaf);
    }

    /**
     * Answer a question against the notes. The index is refreshed incrementally
     * (unchanged files keep their embeddings), scoped to the chosen folder, and
     * the answer is appended to the conversation history.
     */
    async askQuestion(
        question: string,
        mode: AskMode = "qa",
        onChunk?: (text: string, accumulated: string) => void
    ): Promise<ChatTurn> {
        if (this.missingGeminiKey()) {
            throw new Error("Set your Gemini API key in Settings first.");
        }
        const client = createLLMClient(this.settings);
        const embedder = createEmbedder(this.settings);
        const signature = embedderSignature(this.settings);

        if (!this.ragIndex) {
            this.ragIndex = await loadIndex(this.app.vault, this.ragIndexPath);
        }
        // Incremental build scoped to the chosen folder: reuses matching files'
        // embeddings, embeds only new/changed ones, drops out-of-scope files.
        this.ragIndex = await buildIndex(
            this.app.vault,
            embedder,
            this.ragScopePrefix,
            signature,
            this.ragIndex ?? undefined
        );
        await saveIndex(this.app.vault, this.ragIndexPath, this.ragIndex);

        const { answer, sources } = await answerQuestion(
            client,
            embedder,
            this.ragIndex,
            question,
            this.chatHistory,
            mode,
            6,
            onChunk
        );
        const turn: ChatTurn = { question, answer, sources };
        this.chatHistory.push(turn);
        return turn;
    }

    private async rebuildNotesIndex(): Promise<void> {
        // Rebuild only embeds, so the Gemini key is required only for that provider.
        if (this.settings.embeddingProvider === "gemini" && !this.settings.geminiApiKey) {
            new Notice("Please set your Gemini API key in Settings first.");
            return;
        }
        const embedder = createEmbedder(this.settings);
        new Notice("Rebuilding notes index… (重建索引中)");
        try {
            // Pass null to force a full rebuild rather than an incremental update.
            this.ragIndex = await buildIndex(
                this.app.vault,
                embedder,
                this.ragScopePrefix,
                embedderSignature(this.settings),
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

    /**
     * True when a Gemini key is required but missing. The key is only needed for
     * providers that actually call Gemini — a fully-local setup (Ollama for both
     * generation and embeddings) needs no key at all.
     */
    private missingGeminiKey(): boolean {
        const usesGemini =
            this.settings.generationProvider === "gemini" ||
            this.settings.embeddingProvider === "gemini";
        return usesGemini && !this.settings.geminiApiKey;
    }

    private startPipeline(stopAfter?: string): void {
        if (this.missingGeminiKey()) {
            new Notice("Please set your Gemini API key in Settings first.");
            return;
        }
        this.pipeline = new PipelineOrchestrator(this.app, this.settings);
        this.pipeline.start(stopAfter);
    }

    private startIncrementalUpdate(): void {
        if (this.missingGeminiKey()) {
            new Notice("Please set your Gemini API key in Settings first.");
            return;
        }
        this.pipeline = new PipelineOrchestrator(this.app, this.settings);
        this.pipeline.startIncremental();
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
