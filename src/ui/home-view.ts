import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type LawNoteRestructurerPlugin from "../main";
import { listCoursesWithState } from "../pipeline/state-persistence";
import { formatElapsed, type ProgressState } from "./progress";

export const HOME_VIEW_TYPE = "law-note-home-view";

interface HomeAction {
    icon: string;
    label: string;
    desc: string;
    run: () => void;
    /** Needs a built database to be useful — disabled (with a hint) until one exists. */
    requiresDb?: boolean;
}

/**
 * "Law Notes" control panel: a graphical, workflow-ordered launcher. It guides
 * the user database-first (build → keep updated → study), gates actions that
 * need a database, and shows a live, minimizable progress card for running tasks.
 */
export class HomeView extends ItemView {
    private plugin: LawNoteRestructurerPlugin;
    private progressEl!: HTMLElement;
    private bodyEl!: HTMLElement;
    private unsubscribe: (() => void) | null = null;
    private wasActive = false;

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

        this.progressEl = c.createDiv({ cls: "lnr-progress-wrap" });
        this.bodyEl = c.createDiv();
        this.renderBody();

        // Live progress: update the card on every state change, and refresh the
        // body when a task finishes (a build may have just created the database).
        this.unsubscribe = this.plugin.progress.subscribe((s) => {
            this.renderProgress(s);
            if (this.wasActive && !s.active) this.renderBody();
            this.wasActive = s.active;
        });
        // Tick so elapsed time advances even without new state events.
        this.registerInterval(
            window.setInterval(() => {
                const s = this.plugin.progress.get();
                if (s.active) this.renderProgress(s);
            }, 1000)
        );
    }

    async onClose(): Promise<void> {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.contentEl.empty();
    }

    // ── Progress card ──

    private renderProgress(s: ProgressState): void {
        const el = this.progressEl;
        el.empty();
        if (!s.active && !s.stopped) return;

        const card = el.createDiv({ cls: `lnr-progress-card${s.stopped ? " is-error" : ""}` });
        const head = card.createDiv({ cls: "lnr-progress-head" });
        head.createSpan({ cls: "lnr-progress-title", text: s.title || "Working…" });
        const pct = s.percent === null ? "" : `${Math.round(s.percent)}%`;
        const elapsed = s.startedAt ? formatElapsed(Date.now() - s.startedAt) : "";
        head.createSpan({ cls: "lnr-progress-meta", text: [pct, elapsed].filter(Boolean).join(" · ") });

        const bar = card.createDiv({ cls: "lnr-progress-bar" });
        const fill = bar.createDiv({
            cls: `lnr-progress-fill${s.percent === null && !s.stopped ? " is-indeterminate" : ""}`,
        });
        if (s.percent !== null) fill.style.width = `${s.percent}%`;

        if (s.detail) card.createDiv({ cls: "lnr-progress-detail", text: s.detail });

        const actions = card.createDiv({ cls: "lnr-progress-actions" });
        if (s.stopped) {
            actions
                .createEl("button", { text: "Dismiss" })
                .addEventListener("click", () => this.plugin.progress.finish());
        } else if (s.canCancel) {
            actions
                .createEl("button", { text: "Cancel" })
                .addEventListener("click", () => this.plugin.progress.requestCancel());
        }
    }

    // ── Body (workflow stages) ──

    private renderBody(): void {
        const c = this.bodyEl;
        c.empty();

        const courses = listCoursesWithState(this.app.vault, this.plugin.settings.outputFolder);
        const hasDb = courses.length > 0;

        // ① Database
        this.section(c, "① Database / 数据库");
        if (hasDb) {
            const names = courses.map((n) => n || "(default)").join(", ");
            c.createDiv({ cls: "lnr-home-note lnr-home-ok", text: `✓ ${courses.length} course(s): ${names}` });
        } else {
            c.createDiv({
                cls: "lnr-home-note lnr-home-warn",
                text: "No database yet — start here to build one from your notes.",
            });
        }
        this.action(c, {
            icon: "sparkles",
            label: hasDb ? "Build / rebuild database" : "Build database (start here)",
            desc: "Full run: raw notes → structured knowledge base",
            run: () => this.plugin.runFullPipeline(),
        });

        // ② Keep updated
        this.section(c, "② Keep updated / 保持更新");
        const auto = this.plugin.settings.autoUpdateInterval;
        if (auto !== "off") {
            const course = this.plugin.settings.autoUpdateCourse || "(default)";
            c.createDiv({
                cls: "lnr-home-note",
                text: `Auto-update: every ${auto} · course: ${course} (change in Settings)`,
            });
        }
        this.action(c, {
            icon: "refresh-cw",
            label: "Update now",
            desc: "Incremental — only new/changed notes",
            run: () => this.plugin.updateKnowledgeBase(),
            requiresDb: true,
        });

        // ③ Study & tools
        this.section(c, "③ Study & tools / 学习与工具");
        this.action(c, {
            icon: "messages-square",
            label: "Ask my notes",
            desc: "Chat · IRAC · practice · Socratic · US↔China",
            run: () => this.plugin.openAskPanel(),
            requiresDb: true,
        });
        this.action(c, {
            icon: "list-tree",
            label: "Build outline",
            desc: "Pick detail, levels & TOC size, drag-arrange, then generate",
            run: () => void this.plugin.buildOutline(),
            requiresDb: true,
        });
        this.action(c, {
            icon: "link",
            label: "Resolve links",
            desc: "Fetch case/statute text for broken wikilinks",
            run: () => this.plugin.resolveLinks(),
            requiresDb: true,
        });
        this.action(c, {
            icon: "database",
            label: "Rebuild index",
            desc: "Re-embed notes for Ask (rarely needed)",
            run: () => this.plugin.rebuildIndex(),
            requiresDb: true,
        });

        if (!hasDb) {
            c.createDiv({
                cls: "lnr-home-note",
                text: "Update & study actions unlock once you've built a database.",
            });
        }
    }

    private section(parent: HTMLElement, text: string): void {
        parent.createEl("div", { cls: "lnr-home-section", text });
    }

    private action(parent: HTMLElement, a: HomeAction): void {
        const courses = listCoursesWithState(this.app.vault, this.plugin.settings.outputFolder);
        const disabled = !!a.requiresDb && courses.length === 0;

        const card = parent.createDiv({ cls: `lnr-home-action${disabled ? " is-disabled" : ""}` });
        card.setAttribute("role", "button");
        card.tabIndex = disabled ? -1 : 0;

        const icon = card.createDiv({ cls: "lnr-home-action-icon" });
        setIcon(icon, a.icon);

        const body = card.createDiv({ cls: "lnr-home-action-body" });
        body.createDiv({ cls: "lnr-home-action-label", text: a.label });
        body.createEl("div", { cls: "lnr-home-action-desc", text: a.desc });

        if (disabled) return;
        card.addEventListener("click", a.run);
        card.addEventListener("keydown", (evt: KeyboardEvent) => {
            if (evt.key === "Enter" || evt.key === " ") {
                evt.preventDefault();
                a.run();
            }
        });
    }
}
