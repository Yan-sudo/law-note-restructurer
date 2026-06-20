import { ItemView, TFolder, WorkspaceLeaf } from "obsidian";
import type LawNoteRestructurerPlugin from "../main";

export const ASK_VIEW_TYPE = "law-note-ask-view";

/**
 * Persistent right-sidebar chat panel for "Ask My Notes":
 * - a folder scope selector (only embed/query the chosen folder),
 * - a running conversation history (multi-turn, like a chatbot),
 * - answers grounded only in your notes with clickable source links.
 * All retrieval/generation is delegated to the plugin.
 */
export class AskView extends ItemView {
    private plugin: LawNoteRestructurerPlugin;
    private historyEl!: HTMLElement;

    constructor(leaf: WorkspaceLeaf, plugin: LawNoteRestructurerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return ASK_VIEW_TYPE;
    }
    getDisplayText(): string {
        return "Ask My Notes";
    }
    getIcon(): string {
        return "search";
    }

    private scopeOptions(): { value: string; label: string }[] {
        const opts = [{ value: "", label: "All notes (whole output folder)" }];
        const root = this.app.vault.getAbstractFileByPath(this.plugin.settings.outputFolder);
        if (root instanceof TFolder) {
            for (const child of root.children) {
                if (child instanceof TFolder) opts.push({ value: child.path, label: child.name });
            }
        }
        return opts;
    }

    private renderHistory(): void {
        this.historyEl.empty();
        for (const turn of this.plugin.chatHistory) {
            const q = this.historyEl.createEl("div", { cls: "law-restructurer-chat-q" });
            q.createEl("strong", { text: "🙋 " });
            q.createSpan({ text: turn.question });

            const a = this.historyEl.createEl("div", { cls: "law-restructurer-chat-a" });
            a.style.whiteSpace = "pre-wrap";
            a.style.margin = "0.25em 0 0.75em 0";
            a.createEl("strong", { text: "🤖 " });
            a.createSpan({ text: turn.answer });

            if (turn.sources && turn.sources.length > 0) {
                const s = this.historyEl.createEl("div", { cls: "law-restructurer-ask-sources" });
                s.createSpan({ text: "Sources: " });
                for (const title of turn.sources) {
                    const link = s.createEl("a", { text: `[[${title}]] `, cls: "law-restructurer-ask-source" });
                    link.addEventListener("click", () => this.plugin.openNoteByTitle(title));
                }
            }
        }
        this.historyEl.scrollTop = this.historyEl.scrollHeight;
    }

    async onOpen(): Promise<void> {
        const c = this.contentEl;
        c.empty();
        c.addClass("law-restructurer-ask");

        c.createEl("h3", { text: "Ask My Notes (问我的笔记)" });

        // Folder scope selector
        const scopeRow = c.createEl("div", { cls: "law-restructurer-ask-scope" });
        scopeRow.createEl("label", { text: "Folder: " });
        const select = scopeRow.createEl("select");
        for (const o of this.scopeOptions()) {
            const opt = select.createEl("option", { text: o.label });
            opt.value = o.value;
        }
        select.value = this.plugin.settings.ragScopeFolder;
        select.addEventListener("change", async () => {
            this.plugin.settings.ragScopeFolder = select.value;
            await this.plugin.saveSettings();
            this.plugin.resetIndexCache(); // next question reindexes the chosen folder
        });

        // Conversation history
        this.historyEl = c.createEl("div", { cls: "law-restructurer-chat-history" });
        this.historyEl.style.maxHeight = "45vh";
        this.historyEl.style.overflowY = "auto";
        this.renderHistory();

        // Input + buttons
        const input = c.createEl("textarea", { cls: "law-restructurer-ask-input" });
        input.placeholder = "e.g. What are the elements of promissory estoppel?";
        input.rows = 3;
        input.style.width = "100%";

        const btnRow = c.createEl("div");
        btnRow.style.marginTop = "0.5em";
        const askBtn = btnRow.createEl("button", { text: "Ask (提问)", cls: "mod-cta" });
        const clearBtn = btnRow.createEl("button", { text: "Clear (清空)" });
        clearBtn.style.marginLeft = "0.5em";

        const statusEl = c.createEl("div", { cls: "law-restructurer-ask-status" });

        const run = async (): Promise<void> => {
            const question = input.value.trim();
            if (!question) return;

            askBtn.disabled = true;
            input.value = "";
            statusEl.setText("Updating index & answering… (更新索引并回答中)");
            try {
                await this.plugin.askQuestion(question);
                statusEl.setText("");
                this.renderHistory();
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                statusEl.setText(`Error: ${msg}`);
            } finally {
                askBtn.disabled = false;
            }
        };

        askBtn.addEventListener("click", run);
        clearBtn.addEventListener("click", () => {
            this.plugin.clearChat();
            this.renderHistory();
        });
        input.addEventListener("keydown", (evt: KeyboardEvent) => {
            if ((evt.ctrlKey || evt.metaKey) && evt.key === "Enter") {
                evt.preventDefault();
                void run();
            }
        });
    }

    async onClose(): Promise<void> {
        this.contentEl.empty();
    }
}
