import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type LawNoteRestructurerPlugin from "./main";
import { createEmbedder } from "./ai/embedder";
import { estimateCostUSD, formatTokens, formatUSD, isLocalGeneration } from "./ai/cost";

export class LawNoteSettingTab extends PluginSettingTab {
    plugin: LawNoteRestructurerPlugin;

    constructor(app: App, plugin: LawNoteRestructurerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // --- AI Configuration ---
        new Setting(containerEl).setName("AI configuration").setHeading();

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
            .setName("Generation provider")
            .setDesc(
                "Where note generation runs. Ollama is local: offline, free, no quota, " +
                "no API key — notes never leave your machine (quality depends on the local model)."
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("gemini", "Gemini (cloud)")
                    .addOption("ollama", "Ollama (local)")
                    .setValue(this.plugin.settings.generationProvider)
                    .onChange(async (value) => {
                        this.plugin.settings.generationProvider = value as "gemini" | "ollama";
                        await this.plugin.saveSettings();
                        this.display(); // refresh to show the relevant model field
                    })
            );

        if (this.plugin.settings.generationProvider === "gemini") {
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
        } else {
            new Setting(containerEl)
                .setName("Ollama generation model")
                .setDesc(
                    "Pull it first, e.g. `ollama pull llama3.1`. Larger models (e.g. " +
                    "qwen2.5:14b) give better notes."
                )
                .addText((text) =>
                    text
                        .setPlaceholder("llama3.1")
                        .setValue(this.plugin.settings.ollamaModel)
                        .onChange(async (value) => {
                            this.plugin.settings.ollamaModel = value.trim();
                            await this.plugin.saveSettings();
                        })
                );

            // The Ollama URL is shared with embeddings; show it here only when the
            // embedding section (below) won't already render it.
            if (this.plugin.settings.embeddingProvider !== "ollama") {
                new Setting(containerEl)
                    .setName("Ollama URL")
                    .setDesc("Address of your local Ollama server.")
                    .addText((text) =>
                        text
                            .setPlaceholder("http://localhost:11434")
                            .setValue(this.plugin.settings.ollamaUrl)
                            .onChange(async (value) => {
                                this.plugin.settings.ollamaUrl = value.trim();
                                await this.plugin.saveSettings();
                            })
                    );
            }
        }

        new Setting(containerEl)
            .setName("Embedding provider")
            .setDesc(
                "Where embeddings run (semantic dedup, related links, Ask My Notes). " +
                "Ollama is local: offline, free, no quota — notes never leave your machine."
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("gemini", "Gemini (cloud)")
                    .addOption("ollama", "Ollama (local)")
                    .setValue(this.plugin.settings.embeddingProvider)
                    .onChange(async (value) => {
                        this.plugin.settings.embeddingProvider = value as "gemini" | "ollama";
                        await this.plugin.saveSettings();
                        this.display(); // refresh to show the relevant fields
                    })
            );

        if (this.plugin.settings.embeddingProvider === "gemini") {
            new Setting(containerEl)
                .setName("Gemini embedding model")
                .setDesc("Use 'gemini-embedding-001' (current). Change only if Google retires it.")
                .addText((text) =>
                    text
                        .setPlaceholder("gemini-embedding-001")
                        .setValue(this.plugin.settings.embeddingModel)
                        .onChange(async (value) => {
                            this.plugin.settings.embeddingModel = value.trim();
                            await this.plugin.saveSettings();
                        })
                );
        } else {
            new Setting(containerEl)
                .setName("Ollama URL")
                .setDesc("Address of your local Ollama server.")
                .addText((text) =>
                    text
                        .setPlaceholder("http://localhost:11434")
                        .setValue(this.plugin.settings.ollamaUrl)
                        .onChange(async (value) => {
                            this.plugin.settings.ollamaUrl = value.trim();
                            await this.plugin.saveSettings();
                        })
                );

            new Setting(containerEl)
                .setName("Ollama embedding model")
                .setDesc("Pull it first, e.g. `ollama pull nomic-embed-text`.")
                .addText((text) =>
                    text
                        .setPlaceholder("nomic-embed-text")
                        .setValue(this.plugin.settings.ollamaEmbeddingModel)
                        .onChange(async (value) => {
                            this.plugin.settings.ollamaEmbeddingModel = value.trim();
                            await this.plugin.saveSettings();
                        })
                );

            new Setting(containerEl)
                .setName("Test Ollama connection")
                .setDesc("Embed a short string to confirm Ollama is reachable and the model works.")
                .addButton((btn) =>
                    btn.setButtonText("Test connection").onClick(async () => {
                        btn.setDisabled(true).setButtonText("Testing…");
                        try {
                            const [vec] = await createEmbedder(this.plugin.settings).embedTexts(["test"]);
                            new Notice(
                                vec && vec.length
                                    ? `✓ Ollama OK — ${vec.length}-dimensional embeddings.`
                                    : "✗ Ollama returned an empty embedding."
                            );
                        } catch (error) {
                            new Notice(error instanceof Error ? error.message : String(error));
                        } finally {
                            btn.setDisabled(false).setButtonText("Test connection");
                        }
                    })
                );
        }

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
            .setName("Thinking Budget")
            .setDesc(
                "Gemini 2.5 reasoning effort. 'Model default' is recommended. " +
                "'Disabled' is cheapest/fastest (Flash only). Higher budgets improve " +
                "hard extraction at higher cost. (思考预算：默认即可，越高越准但越贵)"
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("-1", "Model default")
                    .addOption("0", "Disabled (cheapest, Flash only)")
                    .addOption("4096", "Low (4K)")
                    .addOption("8192", "Standard (8K)")
                    .addOption("16384", "Deep (16K)")
                    .setValue(String(this.plugin.settings.thinkingBudget))
                    .onChange(async (value) => {
                        this.plugin.settings.thinkingBudget = Number(value);
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

        new Setting(containerEl)
            .setName("Concurrency")
            .setDesc(
                "Parallel AI requests in Step 4. Lower for free tier (2-3), higher for paid (5-10). (并行请求数)"
            )
            .addSlider((slider) =>
                slider
                    .setLimits(1, 10, 1)
                    .setValue(this.plugin.settings.concurrency)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.concurrency = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Auto-accept review")
            .setDesc(
                "Skip the entity & relationship review modals and generate immediately. " +
                "Faster and fully unattended — turn off if you like to edit before generating. (自动确认，跳过审阅)"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.autoAcceptReview)
                    .onChange(async (value) => {
                        this.plugin.settings.autoAcceptReview = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Cost meter: cumulative tokens billed across every run.
        const lifetime = this.plugin.settings.lifetimeTokensUsed ?? 0;
        const costDesc = isLocalGeneration(this.plugin.settings)
            ? `${formatTokens(lifetime)} tokens so far (current provider is local — free).`
            : `${formatTokens(lifetime)} tokens so far · ~${formatUSD(
                  estimateCostUSD(this.plugin.settings.modelName, lifetime)
              )} (rough estimate).`;
        new Setting(containerEl)
            .setName("Usage so far (cost meter)")
            .setDesc(costDesc)
            .addButton((btn) =>
                btn.setButtonText("Reset").onClick(async () => {
                    this.plugin.settings.lifetimeTokensUsed = 0;
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        new Setting(containerEl)
            .setName("Semantic Deduplication")
            .setDesc(
                "Use embeddings to merge concepts that mean the same thing but are " +
                "named differently (e.g. 'Aggregate Principle' vs 'Aggregate Theory of " +
                "Partnership Taxation'). Adds a small embedding API cost. (语义去重)"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enableSemanticDedup)
                    .onChange(async (value) => {
                        this.plugin.settings.enableSemanticDedup = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Semantic Similarity Threshold")
            .setDesc(
                "How similar two concepts must be to auto-merge (higher = stricter). " +
                "0.90 recommended. Only used when Semantic Deduplication is on."
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0.8, 0.98, 0.01)
                    .setValue(this.plugin.settings.semanticDedupThreshold)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.semanticDedupThreshold = value;
                        await this.plugin.saveSettings();
                    })
            );

        // --- Output Configuration ---
        new Setting(containerEl).setName("Output configuration").setHeading();

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

        new Setting(containerEl)
            .setName("Semantic Related Links")
            .setDesc(
                "Append a 'Related Concepts' section to each concept page using embeddings, " +
                "surfacing connections beyond explicit wikilinks. Adds embedding API cost. (语义相关链接)"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enableSemanticLinks)
                    .onChange(async (value) => {
                        this.plugin.settings.enableSemanticLinks = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Generate Flashcards")
            .setDesc(
                "Create Flashcards.md (Spaced Repetition plugin) and an Anki .txt export " +
                "from rules, holdings, and definitions. (生成闪卡与 Anki 导出)"
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enableFlashcards)
                    .onChange(async (value) => {
                        this.plugin.settings.enableFlashcards = value;
                        await this.plugin.saveSettings();
                    })
            );

        // --- Link Resolver Configuration ---
        new Setting(containerEl).setName("Link resolver (链接解析)").setHeading();

        containerEl.createEl("p", {
            text: "Settings for the 'Resolve Unresolved Links' command. Fetches legal data from free online databases.",
            cls: "setting-item-description",
        });

        new Setting(containerEl)
            .setName("CourtListener API Token")
            .setDesc(
                "Free token from courtlistener.com — enables US case law search. Leave empty to use Justia as fallback."
            )
            .addText((text) => {
                text.setPlaceholder("Enter CourtListener token")
                    .setValue(this.plugin.settings.courtListenerApiToken)
                    .onChange(async (value) => {
                        this.plugin.settings.courtListenerApiToken = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.type = "password";
            });

        new Setting(containerEl)
            .setName("Resolved Links Folder")
            .setDesc(
                "Folder for pages created by the resolver. Leave empty to use '{output folder}/References'."
            )
            .addText((text) =>
                text
                    .setPlaceholder("LawNotes/Generated/References")
                    .setValue(this.plugin.settings.resolvedLinksFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.resolvedLinksFolder = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Scan Scope")
            .setDesc(
                "Where to look for unresolved links: only in the output folder, or the entire vault"
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("output-folder", "Output Folder Only")
                    .addOption("vault", "Entire Vault")
                    .setValue(this.plugin.settings.resolverScanScope)
                    .onChange(async (value) => {
                        this.plugin.settings.resolverScanScope = value as
                            | "vault"
                            | "output-folder";
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Request Delay (ms)")
            .setDesc(
                "Delay between API requests to respect rate limits. Minimum 1000ms recommended."
            )
            .addSlider((slider) =>
                slider
                    .setLimits(500, 15000, 500)
                    .setValue(this.plugin.settings.resolverRequestDelayMs)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.resolverRequestDelayMs = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}
