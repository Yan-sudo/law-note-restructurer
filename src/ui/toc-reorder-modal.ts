import { App, Modal, setIcon } from "obsidian";
import { moveSection, type Toc, type TocSection } from "../ai/outline";

/** Drag-and-drop editor for the proposed table of contents before generating. */
export class TocReorderModal extends Modal {
    private sections: TocSection[];
    private done = false;
    private dragFrom = -1;
    private listEl!: HTMLElement;
    private onSubmit: (toc: Toc | null) => void;

    constructor(app: App, toc: Toc, onSubmit: (toc: Toc | null) => void) {
        super(app);
        this.sections = toc.sections.map((s) => ({ title: s.title, items: [...s.items] }));
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("lnr-toc");

        contentEl.createEl("h2", { text: "Arrange outline (拖拽调整目录)" });
        contentEl.createEl("p", {
            cls: "setting-item-description",
            text: "Drag rows (⠿) to reorder, edit titles, add or remove sections. Then generate.",
        });

        this.listEl = contentEl.createDiv({ cls: "lnr-toc-list" });
        this.render();

        const row = contentEl.createDiv({ cls: "law-restructurer-buttons" });
        row.createEl("button", { text: "+ Add section" }).addEventListener("click", () => {
            this.sections.push({ title: "New section", items: [] });
            this.render();
        });
        row.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.finish(null));
        row.createEl("button", { text: "Generate outline (生成大纲)", cls: "mod-cta" }).addEventListener(
            "click",
            () => this.finish({ sections: this.sections.filter((s) => s.title.trim().length > 0) })
        );
    }

    private render(): void {
        this.listEl.empty();
        this.sections.forEach((sec, i) => {
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

            const up = rowEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Move up" } });
            setIcon(up, "chevron-up");
            up.addEventListener("click", () => {
                this.sections = moveSection(this.sections, i, i - 1);
                this.render();
            });

            const down = rowEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Move down" } });
            setIcon(down, "chevron-down");
            down.addEventListener("click", () => {
                this.sections = moveSection(this.sections, i, i + 1);
                this.render();
            });

            const del = rowEl.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Delete" } });
            setIcon(del, "trash-2");
            del.addEventListener("click", () => {
                this.sections.splice(i, 1);
                this.render();
            });
        });
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
