import { App, Modal, Setting, TFile } from "obsidian";
import { estimateTokens } from "../types";

export class FilePickerModal extends Modal {
    private files: TFile[];
    private selected: Set<string> = new Set();
    private onConfirm: (files: TFile[]) => void;
    private onCancel: () => void;

    constructor(
        app: App,
        onConfirm: (files: TFile[]) => void,
        onCancel: () => void
    ) {
        super(app);
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;

        // Get all .md and .docx files
        this.files = app.vault
            .getFiles()
            .filter((f) => f.extension === "md" || f.extension === "docx")
            .sort((a, b) => a.path.localeCompare(b.path));
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("law-restructurer-file-picker");

        contentEl.createEl("h2", { text: "Select Source Files" });
        contentEl.createEl("p", {
            text: "Choose .md and .docx files to analyze. (选择要分析的文件)",
            cls: "setting-item-description",
        });

        // Filter controls
        const filterDiv = contentEl.createDiv("law-restructurer-filter");
        const filterInput = filterDiv.createEl("input", {
            type: "text",
            placeholder: "Filter files...",
        });
        filterInput.addClass("law-restructurer-filter-input");

        // Select all / none
        const bulkDiv = contentEl.createDiv("law-restructurer-bulk-actions");

        const selectAllBtn = bulkDiv.createEl("button", { text: "Select All" });
        selectAllBtn.addEventListener("click", () => {
            this.files.forEach((f) => this.selected.add(f.path));
            this.renderFileList(fileListDiv, "");
        });

        const selectNoneBtn = bulkDiv.createEl("button", { text: "Select None" });
        selectNoneBtn.addEventListener("click", () => {
            this.selected.clear();
            this.renderFileList(fileListDiv, "");
        });

        // File list
        const fileListDiv = contentEl.createDiv("law-restructurer-file-list");
        this.renderFileList(fileListDiv, "");

        filterInput.addEventListener("input", () => {
            this.renderFileList(fileListDiv, filterInput.value);
        });

        // Summary + buttons
        const summaryDiv = contentEl.createDiv("law-restructurer-summary");
        const summaryText = summaryDiv.createEl("p", { text: "" });

        const updateSummary = () => {
            const count = this.selected.size;
            summaryText.setText(
                `${count} file(s) selected (已选 ${count} 个文件)`
            );
        };
        updateSummary();

        // Observe changes to update summary
        const observer = new MutationObserver(updateSummary);
        observer.observe(fileListDiv, { childList: true, subtree: true });

        const buttonDiv = contentEl.createDiv("law-restructurer-buttons");

        const cancelBtn = buttonDiv.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => {
            this.close();
            this.onCancel();
        });

        const confirmBtn = buttonDiv.createEl("button", {
            text: "Confirm & Continue",
            cls: "mod-cta",
        });
        confirmBtn.addEventListener("click", () => {
            const selectedFiles = this.files.filter((f) =>
                this.selected.has(f.path)
            );
            if (selectedFiles.length === 0) {
                return;
            }
            this.close();
            this.onConfirm(selectedFiles);
        });
    }

    private renderFileList(container: HTMLElement, filter: string): void {
        container.empty();
        const lowerFilter = filter.toLowerCase();

        for (const file of this.files) {
            if (lowerFilter && !file.path.toLowerCase().includes(lowerFilter)) {
                continue;
            }

            const itemDiv = container.createDiv("law-restructurer-file-item");
            const checkbox = itemDiv.createEl("input", { type: "checkbox" });
            checkbox.checked = this.selected.has(file.path);
            checkbox.addEventListener("change", () => {
                if (checkbox.checked) {
                    this.selected.add(file.path);
                } else {
                    this.selected.delete(file.path);
                }
            });

            const label = itemDiv.createEl("span", { text: file.path });
            label.addClass("law-restructurer-file-label");

            const badge = itemDiv.createEl("span", {
                text: file.extension.toUpperCase(),
                cls: `law-restructurer-badge law-restructurer-badge-${file.extension}`,
            });
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
