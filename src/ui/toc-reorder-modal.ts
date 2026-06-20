import { App, Modal, setIcon } from "obsidian";
import { moveSection, moveSubsection, type Toc, type TocSection } from "../ai/outline";

/** Drag-and-drop editor for the proposed (hierarchical) table of contents. */
export class TocReorderModal extends Modal {
    private sections: TocSection[];
    private done = false;
    private dragFrom = -1;
    private listEl!: HTMLElement;
    private onSubmit: (toc: Toc | null) => void;

    constructor(app: App, toc: Toc, onSubmit: (toc: Toc | null) => void) {
        super(app);
        this.sections = toc.sections.map((s) => ({
            title: s.title,
            items: [...s.items],
            subsections: (s.subsections ?? []).map((sub) => ({
                title: sub.title,
                items: [...sub.items],
            })),
        }));
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("lnr-toc");

        contentEl.createEl("h2", { text: "Arrange outline (拖拽调整目录)" });
        contentEl.createEl("p", {
            cls: "setting-item-description",
            text: "Drag sections (⠿) to reorder. Edit titles, add/remove sections and sub-sections, then generate.",
        });

        this.listEl = contentEl.createDiv({ cls: "lnr-toc-list" });
        this.render();

        const row = contentEl.createDiv({ cls: "law-restructurer-buttons" });
        row.createEl("button", { text: "+ Add section" }).addEventListener("click", () => {
            this.sections.push({ title: "New section", items: [], subsections: [] });
            this.render();
        });
        row.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.finish(null));
        row.createEl("button", { text: "Generate outline (生成大纲)", cls: "mod-cta" }).addEventListener(
            "click",
            () => this.finish({ sections: this.cleaned() })
        );
    }

    /** Drop empty section/subsection titles before generating. */
    private cleaned(): TocSection[] {
        return this.sections
            .filter((s) => s.title.trim().length > 0)
            .map((s) => ({
                title: s.title,
                items: s.items,
                subsections: s.subsections.filter((sub) => sub.title.trim().length > 0),
            }));
    }

    private render(): void {
        this.listEl.empty();
        this.sections.forEach((sec, i) => this.renderSection(sec, i));
    }

    private renderSection(sec: TocSection, i: number): void {
        const rowEl = this.listEl.createDiv({ cls: "lnr-toc-row" });
        rowEl.draggable = true;
        rowEl.addEventListener("dragstart", () => {
            this.dragFrom = i;
            rowEl.addClass("is-dragging");
        });
        rowEl.addEventListener("dragend", () => rowEl.removeClass("is-dragging"));
        rowEl.addEventListener("dragover", (e) => e.preventDefault());
        rowEl.addEventListener("drop", (e) => {
            e.preventDefault();
            this.sections = moveSection(this.sections, this.dragFrom, i);
            this.render();
        });

        const handle = rowEl.createDiv({ cls: "lnr-toc-handle" });
        setIcon(handle, "grip-vertical");

        const main = rowEl.createDiv({ cls: "lnr-toc-main" });
        const input = main.createEl("input", {
            cls: "lnr-toc-title",
            attr: { type: "text", value: sec.title },
        });
        input.addEventListener("input", () => (sec.title = input.value));
        if (sec.items.length) {
            main.createEl("div", { cls: "lnr-toc-items", text: sec.items.join(" · ") });
        }

        this.addMoveButton(rowEl, "chevron-up", "Move up", () => {
            this.sections = moveSection(this.sections, i, i - 1);
            this.render();
        });
        this.addMoveButton(rowEl, "chevron-down", "Move down", () => {
            this.sections = moveSection(this.sections, i, i + 1);
            this.render();
        });
        this.addMoveButton(rowEl, "trash-2", "Delete section", () => {
            this.sections.splice(i, 1);
            this.render();
        });

        // Nested sub-sections.
        const subList = this.listEl.createDiv({ cls: "lnr-toc-sublist" });
        sec.subsections.forEach((sub, j) => this.renderSubsection(subList, i, j));
        const addSub = subList.createEl("button", {
            cls: "lnr-toc-add-sub",
            text: "+ Add sub-section",
        });
        addSub.addEventListener("click", () => {
            sec.subsections.push({ title: "New sub-section", items: [] });
            this.render();
        });
    }

    private renderSubsection(parent: HTMLElement, sectionIndex: number, j: number): void {
        const sec = this.sections[sectionIndex];
        const sub = sec.subsections[j];
        const rowEl = parent.createDiv({ cls: "lnr-toc-row lnr-toc-subrow" });

        const main = rowEl.createDiv({ cls: "lnr-toc-main" });
        const input = main.createEl("input", {
            cls: "lnr-toc-title",
            attr: { type: "text", value: sub.title },
        });
        input.addEventListener("input", () => (sub.title = input.value));
        if (sub.items.length) {
            main.createEl("div", { cls: "lnr-toc-items", text: sub.items.join(" · ") });
        }

        this.addMoveButton(rowEl, "chevron-up", "Move up", () => {
            this.sections = moveSubsection(this.sections, sectionIndex, j, j - 1);
            this.render();
        });
        this.addMoveButton(rowEl, "chevron-down", "Move down", () => {
            this.sections = moveSubsection(this.sections, sectionIndex, j, j + 1);
            this.render();
        });
        this.addMoveButton(rowEl, "trash-2", "Delete sub-section", () => {
            sec.subsections.splice(j, 1);
            this.render();
        });
    }

    private addMoveButton(
        parent: HTMLElement,
        icon: string,
        label: string,
        onClick: () => void
    ): void {
        const btn = parent.createEl("button", {
            cls: "clickable-icon",
            attr: { "aria-label": label },
        });
        setIcon(btn, icon);
        btn.addEventListener("click", onClick);
    }

    private finish(toc: Toc | null): void {
        if (this.done) return;
        this.done = true;
        this.close();
        this.onSubmit(toc);
    }

    onClose(): void {
        this.contentEl.empty();
        this.finish(null);
    }
}
