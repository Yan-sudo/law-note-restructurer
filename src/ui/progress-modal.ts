import { Modal, App } from "obsidian";

export class ProgressModal extends Modal {
    private stepLabel: HTMLElement | null = null;
    private progressFill: HTMLElement | null = null;
    private previewArea: HTMLElement | null = null;
    private cancelCallback: (() => void) | null = null;

    constructor(app: App) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("law-restructurer-progress");

        this.stepLabel = contentEl.createEl("h3", {
            text: "Processing...",
        });

        const barContainer = contentEl.createDiv("law-restructurer-progress-bar");
        this.progressFill = barContainer.createDiv(
            "law-restructurer-progress-bar-fill law-restructurer-progress-bar-indeterminate"
        );

        this.previewArea = contentEl.createDiv("law-restructurer-preview-area");
        this.previewArea.setText("Waiting for AI response...");

        const cancelBtn = contentEl.createEl("button", {
            text: "Cancel (取消)",
        });
        cancelBtn.addEventListener("click", () => {
            this.cancelCallback?.();
            this.close();
        });
    }

    setStep(label: string): void {
        if (this.stepLabel) {
            this.stepLabel.setText(label);
        }
    }

    setProgress(percent: number): void {
        if (this.progressFill) {
            this.progressFill.removeClass(
                "law-restructurer-progress-bar-indeterminate"
            );
            this.progressFill.style.width = `${Math.min(100, percent)}%`;
        }
    }

    setIndeterminate(): void {
        if (this.progressFill) {
            this.progressFill.addClass(
                "law-restructurer-progress-bar-indeterminate"
            );
            this.progressFill.style.width = "";
        }
    }

    updatePreview(text: string): void {
        if (this.previewArea) {
            // Show last 500 chars
            const display =
                text.length > 500 ? "..." + text.slice(-500) : text;
            this.previewArea.setText(display);
            this.previewArea.scrollTop = this.previewArea.scrollHeight;
        }
    }

    onCancelClick(callback: () => void): void {
        this.cancelCallback = callback;
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
