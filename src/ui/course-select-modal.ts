import { App, Modal, Setting, TFolder } from "obsidian";
import { stateExists, loadPipelineState } from "../pipeline/state-persistence";

export interface CourseSelection {
    courseName: string;
    incremental: boolean;
}

export class CourseSelectModal extends Modal {
    private outputFolder: string;
    private onConfirm: (selection: CourseSelection) => void;
    private onCancel: () => void;
    private courseName = "";
    private incremental = false;

    constructor(
        app: App,
        outputFolder: string,
        onConfirm: (selection: CourseSelection) => void,
        onCancel: () => void
    ) {
        super(app);
        this.outputFolder = outputFolder;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("law-restructurer-course-select");

        contentEl.createEl("h2", {
            text: "Select Course (选择课程)",
        });
        contentEl.createEl("p", {
            text: "Choose a course to organize your notes. Leave empty to use the default output folder. (选择课程名称来组织笔记。留空则使用默认输出文件夹。)",
            cls: "setting-item-description",
        });

        // Existing courses
        const existingCourses = this.getExistingCourses();

        const courseNameSetting = new Setting(contentEl)
            .setName("Course Name (课程名称)")
            .setDesc("e.g., Tax Law, Contract Law, 刑法");

        if (existingCourses.length > 0) {
            courseNameSetting.addDropdown((dropdown) => {
                dropdown.addOption("", "— New course / None —");
                for (const name of existingCourses) {
                    dropdown.addOption(name, name);
                }
                dropdown.onChange((value) => {
                    this.courseName = value;
                    textInput.setValue(value);
                    this.updateIncrementalToggle(incrementalSetting, stateInfoEl);
                });
            });
        }

        let textInput: { setValue: (v: string) => void };
        courseNameSetting.addText((text) => {
            textInput = text;
            text.setPlaceholder("Enter course name...")
                .setValue(this.courseName)
                .onChange((value) => {
                    this.courseName = value.trim();
                    this.updateIncrementalToggle(incrementalSetting, stateInfoEl);
                });
        });

        // Incremental toggle
        const incrementalSetting = new Setting(contentEl)
            .setName("Add to existing data (增量更新)")
            .setDesc(
                "Merge new entities with previously extracted data instead of starting fresh."
            )
            .addToggle((toggle) =>
                toggle.setValue(this.incremental).onChange((value) => {
                    this.incremental = value;
                })
            );

        const stateInfoEl = contentEl.createEl("p", {
            cls: "setting-item-description",
            text: "",
        });

        this.updateIncrementalToggle(incrementalSetting, stateInfoEl);

        // Buttons
        const buttonDiv = contentEl.createDiv("law-restructurer-buttons");

        const cancelBtn = buttonDiv.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => {
            this.close();
            this.onCancel();
        });

        const confirmBtn = buttonDiv.createEl("button", {
            text: "Continue (继续)",
            cls: "mod-cta",
        });
        confirmBtn.addEventListener("click", () => {
            this.close();
            this.onConfirm({
                courseName: this.courseName,
                incremental: this.incremental,
            });
        });
    }

    private getExistingCourses(): string[] {
        const folder = this.app.vault.getAbstractFileByPath(this.outputFolder);
        if (!(folder instanceof TFolder)) return [];

        return folder.children
            .filter((child): child is TFolder => child instanceof TFolder)
            .map((f) => f.name)
            .sort();
    }

    private updateIncrementalToggle(
        setting: Setting,
        infoEl: HTMLElement
    ): void {
        const courseFolder = this.courseName
            ? `${this.outputFolder}/${this.courseName}`
            : this.outputFolder;

        const hasState = stateExists(this.app.vault, courseFolder);

        if (hasState) {
            infoEl.setText(
                "Previous data found for this course. Toggle on to merge with new extractions. (已找到此课程的历史数据。)"
            );
            this.incremental = true;
            // Update toggle visually
            const toggle = setting.controlEl.querySelector(
                ".checkbox-container"
            ) as HTMLElement | null;
            if (toggle) {
                toggle.classList.add("is-enabled");
                const input = toggle.querySelector("input");
                if (input) (input as HTMLInputElement).checked = true;
            }
        } else {
            infoEl.setText(
                "No previous data found. First run will create new state. (未找到历史数据。)"
            );
            this.incremental = false;
            const toggle = setting.controlEl.querySelector(
                ".checkbox-container"
            ) as HTMLElement | null;
            if (toggle) {
                toggle.classList.remove("is-enabled");
                const input = toggle.querySelector("input");
                if (input) (input as HTMLInputElement).checked = false;
            }
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
