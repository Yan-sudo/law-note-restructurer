import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type LawNoteSettings } from "./types";
import { LawNoteSettingTab } from "./settings";
import { PipelineOrchestrator } from "./pipeline/pipeline-orchestrator";

export default class LawNoteRestructurerPlugin extends Plugin {
    settings: LawNoteSettings = DEFAULT_SETTINGS;
    private pipeline: PipelineOrchestrator | null = null;

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
