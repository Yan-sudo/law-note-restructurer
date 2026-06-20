import { App, Modal, Setting } from "obsidian";
import {
    DEFAULT_OUTLINE_OPTIONS,
    type OutlineDetail,
    type OutlineOptions,
    type OutlineStructure,
} from "../ai/outline";

/** Pick outline detail + structure before generating the table of contents. */
export class OutlineOptionsModal extends Modal {
    private opts: OutlineOptions = { ...DEFAULT_OUTLINE_OPTIONS };
    private done = false;
    private onSubmit: (o: OutlineOptions | null) => void;

    constructor(app: App, onSubmit: (o: OutlineOptions | null) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Build outline (大纲设置)" });

        new Setting(contentEl)
            .setName("Detail / 详细程度")
            .addDropdown((d) =>
                d
                    .addOption("concise", "Concise / 精简")
                    .addOption("standard", "Standard / 标准")
                    .addOption("detailed", "Detailed / 详尽")
                    .setValue(this.opts.detail)
                    .onChange((v) => (this.opts.detail = v as OutlineDetail))
            );

        new Setting(contentEl)
            .setName("Heading levels / 标题层级")
            .setDesc(
                "Max heading depth. Markdown has 6 levels (#…######) and outlines start at ##, " +
                "so 5+ caps real headings at ###### and nests deeper with bold + lists. " +
                "“Auto” goes as deep as the material needs."
            )
            .addDropdown((d) => {
                d.addOption("0", "Auto (as deep as needed) / 自动");
                for (let n = 1; n <= 7; n++) {
                    d.addOption(String(n), `${n} level${n === 1 ? "" : "s"}`);
                }
                d.setValue(String(this.opts.levels)).onChange((v) => (this.opts.levels = Number(v)));
            });

        new Setting(contentEl)
            .setName("Sections in TOC / 目录章节数")
            .setDesc("Roughly how many top-level sections to aim for.")
            .addDropdown((d) =>
                d
                    .addOption("auto", "Auto / 自动")
                    .addOption("5", "~5")
                    .addOption("8", "~8")
                    .addOption("10", "~10")
                    .addOption("12", "~12")
                    .addOption("15", "~15")
                    .setValue(this.opts.sectionCount === "auto" ? "auto" : String(this.opts.sectionCount))
                    .onChange((v) => (this.opts.sectionCount = v === "auto" ? "auto" : Number(v)))
            );

        const customWrap = contentEl.createDiv();
        const toggleCustom = () => {
            customWrap.style.display = this.opts.structure === "custom" ? "" : "none";
        };

        new Setting(contentEl)
            .setName("Structure / 结构方式")
            .setDesc("How to organize sections — e.g. follow a case's lifecycle instead of lecture order.")
            .addDropdown((d) =>
                d
                    .addOption("lecture", "As taught / 按授课顺序")
                    .addOption("thematic", "Thematic / 按主题")
                    .addOption("lifecycle", "Lifecycle · chronological / 生命历程")
                    .addOption("custom", "Custom / 自定义…")
                    .setValue(this.opts.structure)
                    .onChange((v) => {
                        this.opts.structure = v as OutlineStructure;
                        toggleCustom();
                    })
            );

        new Setting(customWrap)
            .setName("Custom structure / 自定义结构")
            .setDesc("e.g. follow a case's lifecycle: pleadings → discovery → trial → appeal")
            .addTextArea((t) =>
                t.setValue(this.opts.customInstruction).onChange((v) => (this.opts.customInstruction = v))
            );
        toggleCustom();

        const row = contentEl.createDiv({ cls: "law-restructurer-buttons" });
        row.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.finish(null));
        row.createEl("button", { text: "Generate TOC (生成目录)", cls: "mod-cta" }).addEventListener(
            "click",
            () => this.finish({ ...this.opts })
        );
    }

    private finish(o: OutlineOptions | null): void {
        if (this.done) return;
        this.done = true;
        this.close();
        this.onSubmit(o);
    }

    onClose(): void {
        this.contentEl.empty();
        this.finish(null);
    }
}
