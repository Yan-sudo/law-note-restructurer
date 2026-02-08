import { App, PluginSettingTab, Setting } from "obsidian";
import type LawNoteRestructurerPlugin from "./main";

export class LawNoteSettingTab extends PluginSettingTab {
    plugin: LawNoteRestructurerPlugin;

    constructor(app: App, plugin: LawNoteRestructurerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Law Note Restructurer" });
        containerEl.createEl("p", {
            text: "AI-powered restructuring of legal notes into structured knowledge.",
            cls: "setting-item-description",
        });

        // --- AI Configuration ---
        containerEl.createEl("h3", { text: "AI Configuration" });

        new Setting(containerEl)
            .setName("Gemini API Key")
            .setDesc("Your Google Gemini API key from aistudio.google.com")
            .addText((text) => {
                text.setPlaceholder("Enter your API key")
                    .setValue(this.plugin.settings.geminiApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.geminiApiKey = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.type = "password";
            });

        new Setting(containerEl)
            .setName("Model")
            .setDesc("Gemini model to use. 2.5 Pro recommended for large documents.")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("gemini-2.5-pro", "Gemini 2.5 Pro (best quality)")
                    .addOption("gemini-2.5-flash", "Gemini 2.5 Flash (fast, recommended)")
                    .addOption("gemini-2.5-flash-lite", "Gemini 2.5 Flash Lite (cheapest)")
                    .setValue(this.plugin.settings.modelName)
                    .onChange(async (value) => {
                        this.plugin.settings.modelName = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Temperature")
            .setDesc("Lower = more deterministic. 0.2-0.4 recommended.")
            .addSlider((slider) =>
                slider
                    .setLimits(0, 1, 0.1)
                    .setValue(this.plugin.settings.temperature)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.temperature = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Streaming")
            .setDesc("Stream AI responses for real-time progress display")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enableStreaming)
                    .onChange(async (value) => {
                        this.plugin.settings.enableStreaming = value;
                        await this.plugin.saveSettings();
                    })
            );

        // --- Output Configuration ---
        containerEl.createEl("h3", { text: "Output Configuration" });

        new Setting(containerEl)
            .setName("Output Folder")
            .setDesc("Vault folder for generated files")
            .addText((text) =>
                text
                    .setPlaceholder("LawNotes/Generated")
                    .setValue(this.plugin.settings.outputFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.outputFolder = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Language")
            .setDesc("Primary language for generated content")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("zh", "中文")
                    .addOption("en", "English")
                    .addOption("mixed", "混合 (Chinese + English terms)")
                    .setValue(this.plugin.settings.language)
                    .onChange(async (value) => {
                        this.plugin.settings.language = value as "zh" | "en" | "mixed";
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Source Footnotes")
            .setDesc(
                "Add footnotes after each section indicating which source file it came from (在每段引用后注明来源文件)"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enableSourceFootnotes)
                    .onChange(async (value) => {
                        this.plugin.settings.enableSourceFootnotes = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Append to Existing Pages")
            .setDesc(
                "When a concept already exists, append new content below instead of overwriting. Fuzzy-matches names like 'the aggregate principle' to 'Aggregate Principle'. (追加模式：已有页面只追加不覆盖)"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.appendToExisting)
                    .onChange(async (value) => {
                        this.plugin.settings.appendToExisting = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}
