import { ItemView, WorkspaceLeaf } from "obsidian";
import type LawNoteRestructurerPlugin from "../main";

export const ASK_VIEW_TYPE = "law-note-ask-view";

/**
 * Persistent right-sidebar panel for "Ask My Notes". Stays docked so you can
 * ask repeatedly without re-opening a dialog. All work is delegated to the
 * plugin (index update + retrieval + generation).
 */
export class AskView extends ItemView {
    private plugin: LawNoteRestructurerPlugin;

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

    async onOpen(): Promise<void> {
        const c = this.contentEl;
        c.empty();
        c.addClass("law-restructurer-ask");

        c.createEl("h3", { text: "Ask My Notes (问我的笔记)" });
        c.createEl("p", {
            text: "Answers are grounded only in your generated notes, with source links.",
            cls: "setting-item-description",
        });

        const input = c.createEl("textarea", { cls: "law-restructurer-ask-input" });
        input.placeholder = "e.g. What are the elements of promissory estoppel?";
        input.rows = 3;
        input.style.width = "100%";

        const askBtn = c.createEl("button", { text: "Ask (提问)", cls: "mod-cta" });
        askBtn.style.marginTop = "0.5em";

        const statusEl = c.createEl("div", { cls: "law-restructurer-ask-status" });
        const answerEl = c.createEl("div", { cls: "law-restructurer-ask-answer" });
        answerEl.style.whiteSpace = "pre-wrap";
        const sourcesEl = c.createEl("div", { cls: "law-restructurer-ask-sources" });

        const run = async (): Promise<void> => {
            const question = input.value.trim();
            if (!question) return;

            askBtn.disabled = true;
            answerEl.empty();
            sourcesEl.empty();
            statusEl.setText("Updating index & answering… (更新索引并回答中)");

            try {
                const { answer, sources } = await this.plugin.askQuestion(question);
                statusEl.setText("");
                answerEl.setText(answer);

                if (sources.length > 0) {
                    sourcesEl.createEl("div", {
                        text: "Sources (来源):",
                        cls: "law-restructurer-ask-sources-label",
                    });
                    for (const title of sources) {
                        const link = sourcesEl.createEl("a", {
                            text: `[[${title}]]`,
                            cls: "law-restructurer-ask-source",
                        });
                        link.addEventListener("click", () => this.plugin.openNoteByTitle(title));
                    }
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                statusEl.setText(`Error: ${msg}`);
            } finally {
                askBtn.disabled = false;
            }
        };

        askBtn.addEventListener("click", run);
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
