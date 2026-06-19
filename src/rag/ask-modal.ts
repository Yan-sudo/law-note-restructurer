import { App, Modal } from "obsidian";
import type { RagAnswer } from "./rag-index";

/**
 * "Ask My Notes" dialog: a question box, an answer area, and clickable source
 * links. All heavy lifting (indexing, retrieval, generation) is delegated to
 * the callbacks supplied by the command.
 */
export class AskModal extends Modal {
    private onAsk: (question: string) => Promise<RagAnswer>;
    private onOpenSource: (title: string) => void;

    constructor(
        app: App,
        onAsk: (question: string) => Promise<RagAnswer>,
        onOpenSource: (title: string) => void
    ) {
        super(app);
        this.onAsk = onAsk;
        this.onOpenSource = onOpenSource;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("law-restructurer-ask");

        contentEl.createEl("h2", { text: "Ask My Notes (问我的笔记)" });
        contentEl.createEl("p", {
            text: "Answers are grounded only in your generated notes, with source links.",
            cls: "setting-item-description",
        });

        const input = contentEl.createEl("textarea", {
            cls: "law-restructurer-ask-input",
        });
        input.placeholder = "e.g. What are the elements of promissory estoppel?";
        input.rows = 3;
        input.style.width = "100%";

        const askBtn = contentEl.createEl("button", {
            text: "Ask (提问)",
            cls: "mod-cta",
        });
        askBtn.style.marginTop = "0.5em";

        const statusEl = contentEl.createEl("div", {
            cls: "law-restructurer-ask-status",
        });
        const answerEl = contentEl.createEl("div", {
            cls: "law-restructurer-ask-answer",
        });
        answerEl.style.whiteSpace = "pre-wrap";
        const sourcesEl = contentEl.createEl("div", {
            cls: "law-restructurer-ask-sources",
        });

        const run = async (): Promise<void> => {
            const question = input.value.trim();
            if (!question) return;

            askBtn.disabled = true;
            answerEl.empty();
            sourcesEl.empty();
            statusEl.setText("Thinking… (检索并生成中)");

            try {
                const { answer, sources } = await this.onAsk(question);
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
                        link.addEventListener("click", () => this.onOpenSource(title));
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

        input.focus();
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
