import { ItemView, MarkdownRenderer, TFolder, WorkspaceLeaf, setIcon } from "obsidian";
import type LawNoteRestructurerPlugin from "../main";
import type { AskMode, ChatTurn } from "./rag-core";

const MODES: { value: AskMode; label: string; placeholder: string }[] = [
    { value: "qa", label: "Q&A", placeholder: "Ask about your notes…  (⌘/Ctrl+Enter)" },
    { value: "irac", label: "IRAC analysis", placeholder: "Paste a fact pattern to analyze in IRAC…" },
    { value: "practice", label: "Practice", placeholder: "Topic to be quizzed on (hypothetical + model answer)…" },
    { value: "socratic", label: "Socratic", placeholder: "Topic — the professor will cold-call you…" },
    { value: "compare", label: "US ↔ China", placeholder: "Concept to compare across US & Chinese law…" },
];

export const ASK_VIEW_TYPE = "law-note-ask-view";

/**
 * Persistent right-sidebar chat panel for "Ask My Notes". Themed with Obsidian
 * CSS variables (see styles.css), markdown-rendered answers with clickable
 * source chips, a folder-scope selector, and multi-turn history.
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
        const opts = [{ value: "", label: "All notes" }];
        const root = this.app.vault.getAbstractFileByPath(this.plugin.settings.outputFolder);
        if (root instanceof TFolder) {
            for (const child of root.children) {
                if (child instanceof TFolder) opts.push({ value: child.path, label: child.name });
            }
        }
        return opts;
    }

    private addUserBubble(text: string): void {
        const turn = this.historyEl.createDiv({ cls: "lnr-chat-turn lnr-chat-user" });
        turn.createDiv({ cls: "lnr-chat-bubble", text });
    }

    private async addAssistantBubble(turn: ChatTurn): Promise<void> {
        const wrap = this.historyEl.createDiv({ cls: "lnr-chat-turn lnr-chat-assistant" });
        const bubble = wrap.createDiv({ cls: "lnr-chat-bubble" });
        await this.fillAssistant(wrap, bubble, turn);
    }

    /** Final render of an answer into an (existing) bubble: markdown + source chips. */
    private async fillAssistant(wrap: HTMLElement, bubble: HTMLElement, turn: ChatTurn): Promise<void> {
        bubble.empty();
        bubble.removeClass("lnr-streaming");
        // Render markdown so formatting + [[wikilinks]] are native and clickable.
        await MarkdownRenderer.render(this.app, turn.answer, bubble, "", this);

        if (turn.sources && turn.sources.length > 0) {
            const src = wrap.createDiv({ cls: "lnr-chat-sources" });
            for (const title of turn.sources) {
                const chip = src.createEl("a", { cls: "lnr-chip", text: title });
                chip.addEventListener("click", () => this.plugin.openNoteByTitle(title));
            }
        }
    }

    private scrollToBottom(): void {
        this.historyEl.scrollTop = this.historyEl.scrollHeight;
    }

    private async renderHistory(): Promise<void> {
        this.historyEl.empty();
        if (this.plugin.chatHistory.length === 0) {
            this.historyEl.createDiv({
                cls: "lnr-chat-empty",
                text: "Ask a question grounded in your generated notes.",
            });
            return;
        }
        for (const turn of this.plugin.chatHistory) {
            this.addUserBubble(turn.question);
            await this.addAssistantBubble(turn);
        }
        this.scrollToBottom();
    }

    async onOpen(): Promise<void> {
        const c = this.contentEl;
        c.empty();
        c.addClass("lnr-ask");

        // Header: title + clear
        const header = c.createDiv({ cls: "lnr-ask-header" });
        header.createDiv({ cls: "lnr-ask-title", text: "Ask My Notes" });
        const clearBtn = header.createEl("button", {
            cls: "clickable-icon lnr-icon-btn",
            attr: { "aria-label": "Clear conversation" },
        });
        setIcon(clearBtn, "eraser");
        clearBtn.addEventListener("click", () => {
            this.plugin.clearChat();
            void this.renderHistory();
        });

        // Mode + folder scope
        const controls = c.createDiv({ cls: "lnr-ask-scope" });
        const modeSelect = controls.createEl("select", { cls: "dropdown" });
        for (const m of MODES) {
            const opt = modeSelect.createEl("option", { text: m.label });
            opt.value = m.value;
        }

        // Answer length
        const lengthSelect = controls.createEl("select", { cls: "dropdown" });
        for (const [value, label] of [
            ["brief", "Brief"],
            ["standard", "Standard"],
            ["detailed", "Detailed"],
        ] as const) {
            const opt = lengthSelect.createEl("option", { text: label });
            opt.value = value;
        }
        lengthSelect.value = this.plugin.settings.askLength;
        lengthSelect.addEventListener("change", async () => {
            this.plugin.settings.askLength = lengthSelect.value as "brief" | "standard" | "detailed";
            await this.plugin.saveSettings();
        });

        const select = controls.createEl("select", { cls: "dropdown" });
        for (const o of this.scopeOptions()) {
            const opt = select.createEl("option", { text: o.label });
            opt.value = o.value;
        }
        select.value = this.plugin.settings.ragScopeFolder;
        select.addEventListener("change", async () => {
            this.plugin.settings.ragScopeFolder = select.value;
            await this.plugin.saveSettings();
            this.plugin.resetIndexCache();
        });

        // Conversation
        this.historyEl = c.createDiv({ cls: "lnr-chat-history" });
        await this.renderHistory();

        // Input row
        const inputRow = c.createDiv({ cls: "lnr-ask-input-row" });
        const input = inputRow.createEl("textarea", {
            cls: "lnr-ask-input",
            attr: { rows: "2", placeholder: MODES[0].placeholder },
        });
        modeSelect.addEventListener("change", () => {
            input.placeholder = MODES.find((m) => m.value === modeSelect.value)?.placeholder ?? "";
        });
        const sendBtn = inputRow.createEl("button", {
            cls: "mod-cta lnr-send-btn",
            attr: { "aria-label": "Ask" },
        });
        setIcon(sendBtn, "send");

        const run = async (): Promise<void> => {
            const question = input.value.trim();
            if (!question) return;

            input.value = "";
            sendBtn.disabled = true;
            this.addUserBubble(question);

            // Assistant turn: typing dots until the first token, then stream into it.
            const wrap = this.historyEl.createDiv({ cls: "lnr-chat-turn lnr-chat-assistant" });
            const bubble = wrap.createDiv({ cls: "lnr-chat-bubble" });
            const dots = bubble.createDiv({ cls: "lnr-typing" });
            dots.createSpan();
            dots.createSpan();
            dots.createSpan();
            this.scrollToBottom();

            let streamStarted = false;
            const onChunk = this.plugin.settings.enableStreaming
                ? (_text: string, accumulated: string): void => {
                      if (!streamStarted) {
                          bubble.empty();
                          bubble.addClass("lnr-streaming");
                          streamStarted = true;
                      }
                      // Plain text while streaming (cheap); markdown-rendered once complete.
                      bubble.setText(accumulated);
                      this.scrollToBottom();
                  }
                : undefined;

            try {
                const turn = await this.plugin.askQuestion(
                    question,
                    modeSelect.value as AskMode,
                    onChunk
                );
                await this.fillAssistant(wrap, bubble, turn);
            } catch (error) {
                wrap.remove();
                const errWrap = this.historyEl.createDiv({ cls: "lnr-chat-turn lnr-chat-assistant" });
                errWrap.createDiv({
                    cls: "lnr-chat-bubble lnr-error",
                    text: error instanceof Error ? error.message : String(error),
                });
            } finally {
                sendBtn.disabled = false;
                this.scrollToBottom();
                input.focus();
            }
        };

        sendBtn.addEventListener("click", run);
        input.addEventListener("keydown", (evt: KeyboardEvent) => {
            if ((evt.ctrlKey || evt.metaKey) && evt.key === "Enter") {
                evt.preventDefault();
                void run();
            }
        });
        input.focus();
    }

    async onClose(): Promise<void> {
        this.contentEl.empty();
    }
}
