import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type LawNoteRestructurerPlugin from "../main";

export const HOME_VIEW_TYPE = "law-note-home-view";

interface HomeAction {
    icon: string;
    label: string;
    desc: string;
    run: () => void;
}

/**
 * "Law Notes" control panel: a graphical launcher in the sidebar so every
 * feature is one click away — no need to remember command-palette names.
 */
export class HomeView extends ItemView {
    private plugin: LawNoteRestructurerPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: LawNoteRestructurerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return HOME_VIEW_TYPE;
    }
    getDisplayText(): string {
        return "Law Notes";
    }
    getIcon(): string {
        return "scale";
    }

    async onOpen(): Promise<void> {
        const c = this.contentEl;
        c.empty();
        c.addClass("lnr-home");

        c.createEl("div", { cls: "lnr-home-title", text: "Law Notes" });
        c.createEl("div", {
            cls: "lnr-home-subtitle",
            text: "Turn class notes into a living, interlinked knowledge base.",
        });

        this.section(c, "Build & update / 构建与更新");
        this.action(c, {
            icon: "sparkles",
            label: "Restructure notes",
            desc: "Full run: raw notes → structured KB",
            run: () => this.plugin.runFullPipeline(),
        });
        this.action(c, {
            icon: "refresh-cw",
            label: "Update knowledge base",
            desc: "Incremental — only new/changed notes",
            run: () => this.plugin.updateKnowledgeBase(),
        });
        this.action(c, {
            icon: "list-tree",
            label: "Build outline",
            desc: "Pick detail + structure, drag-arrange the TOC, then generate",
            run: () => void this.plugin.buildOutline(),
        });
        this.action(c, {
            icon: "link",
            label: "Resolve links",
            desc: "Fetch case/statute text for broken wikilinks",
            run: () => this.plugin.resolveLinks(),
        });

        this.section(c, "Study / 学习");
        this.action(c, {
            icon: "messages-square",
            label: "Ask my notes",
            desc: "Chat · IRAC · practice · Socratic · US↔China",
            run: () => this.plugin.openAskPanel(),
        });
        this.action(c, {
            icon: "database",
            label: "Rebuild index",
            desc: "Re-embed notes for Ask (rarely needed)",
            run: () => this.plugin.rebuildIndex(),
        });
    }

    async onClose(): Promise<void> {
        this.contentEl.empty();
    }

    private section(parent: HTMLElement, text: string): void {
        parent.createEl("div", { cls: "lnr-home-section", text });
    }

    private action(parent: HTMLElement, a: HomeAction): void {
        const card = parent.createDiv({ cls: "lnr-home-action" });
        card.setAttribute("role", "button");
        card.tabIndex = 0;

        const icon = card.createDiv({ cls: "lnr-home-action-icon" });
        setIcon(icon, a.icon);

        const body = card.createDiv({ cls: "lnr-home-action-body" });
        body.createDiv({ cls: "lnr-home-action-label", text: a.label });
        body.createEl("div", { cls: "lnr-home-action-desc", text: a.desc });

        card.addEventListener("click", a.run);
        card.addEventListener("keydown", (evt: KeyboardEvent) => {
            if (evt.key === "Enter" || evt.key === " ") {
                evt.preventDefault();
                a.run();
            }
        });
    }
}
