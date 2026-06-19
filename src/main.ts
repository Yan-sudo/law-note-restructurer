import { Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, type LawNoteSettings } from "./types";
import { LawNoteSettingTab } from "./settings";
import { PipelineOrchestrator } from "./pipeline/pipeline-orchestrator";
import { runLinkResolver } from "./link-resolver/resolver-orchestrator";
import { createLLMClient } from "./ai/llm-client-factory";
import { AskModal } from "./rag/ask-modal";
import { answerQuestion, buildIndex, loadIndex, saveIndex, type RagIndex } from "./rag/rag-index";

export default class LawNoteRestructurerPlugin extends Plugin {
    settings: LawNoteSettings = DEFAULT_SETTINGS;
    private pipeline: PipelineOrchestrator | null = null;
    private ragIndex: RagIndex | null = null;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.addSettingTab(new LawNoteSettingTab(this.app, this));

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
            callback: () => this.askMyNotes(),
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

    private askMyNotes(): void {
        if (!this.settings.geminiApiKey) {
            new Notice("Please set your Gemini API key in Settings first.");
            return;
        }
        const client = createLLMClient(this.settings);

        new AskModal(
            this.app,
            async (question) => {
                if (!this.ragIndex) {
                    this.ragIndex = await loadIndex(this.app.vault, this.ragIndexPath);
                }
                if (!this.ragIndex) {
                    new Notice("Building notes index for the first time… (首次构建索引)");
                    this.ragIndex = await buildIndex(
                        this.app.vault,
                        client,
                        this.settings.outputFolder
                    );
                    await saveIndex(this.app.vault, this.ragIndexPath, this.ragIndex);
                }
                return answerQuestion(client, this.ragIndex, question);
            },
            (title) => this.openNoteByTitle(title)
        ).open();
    }

    private async rebuildNotesIndex(): Promise<void> {
        if (!this.settings.geminiApiKey) {
            new Notice("Please set your Gemini API key in Settings first.");
            return;
        }
        const client = createLLMClient(this.settings);
        new Notice("Rebuilding notes index… (重建索引中)");
        try {
            this.ragIndex = await buildIndex(
                this.app.vault,
                client,
                this.settings.outputFolder,
                (done, total) => {
                    if (done === total) new Notice(`Indexed ${total} chunk(s).`);
                }
            );
            await saveIndex(this.app.vault, this.ragIndexPath, this.ragIndex);
            new Notice(`Notes index ready: ${this.ragIndex.chunks.length} chunks.`);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            new Notice(`Index build failed: ${msg}`);
        }
    }

    private openNoteByTitle(title: string): void {
        const file = this.app.vault
            .getMarkdownFiles()
            .find((f) => f.basename === title);
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
