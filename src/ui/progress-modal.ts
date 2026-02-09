import { Modal, App } from "obsidian";

export class ProgressModal extends Modal {
    private stepLabel: HTMLElement | null = null;
    private progressFill: HTMLElement | null = null;
    private previewArea: HTMLElement | null = null;
    private errorArea: HTMLElement | null = null;
    private cancelBtn: HTMLElement | null = null;
    private cancelCallback: (() => void) | null = null;
    private errorLog: string[] = [];
    private stopped = false;

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

        // Error log area (hidden initially)
        this.errorArea = contentEl.createDiv("law-restructurer-error-area");
        this.errorArea.style.display = "none";

        this.cancelBtn = contentEl.createEl("button", {
            text: "Cancel (取消)",
        });
        this.cancelBtn.addEventListener("click", () => {
            if (this.stopped) {
                this.close();
            } else {
                this.cancelCallback?.();
                this.close();
            }
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
            this.previewArea.setText(text);
            this.previewArea.scrollTop = this.previewArea.scrollHeight;
        }
    }

    /**
     * Log an error — shown in a distinct error area that's selectable/copyable.
     * Does NOT close the modal.
     */
    addError(message: string): void {
        this.errorLog.push(message);
        if (this.errorArea) {
            this.errorArea.style.display = "block";
            const line = this.errorArea.createDiv("law-restructurer-error-line");
            line.setText(message);
            this.errorArea.scrollTop = this.errorArea.scrollHeight;
        }
    }

    /**
     * Switch to "stopped" state — shows all errors, changes button to Close.
     * Modal stays open until user explicitly closes it.
     */
    showStopped(title: string): void {
        this.stopped = true;
        if (this.stepLabel) {
            this.stepLabel.setText(title);
            this.stepLabel.addClass("law-restructurer-error-title");
        }
        if (this.progressFill) {
            this.progressFill.removeClass("law-restructurer-progress-bar-indeterminate");
            this.progressFill.addClass("law-restructurer-progress-bar-error");
        }
        if (this.cancelBtn) {
            this.cancelBtn.setText("Close (关闭)");
        }
        // Add copy button if there are errors
        if (this.errorLog.length > 0 && this.errorArea) {
            const copyBtn = this.errorArea.createEl("button", {
                text: "Copy Errors (复制错误日志)",
                cls: "law-restructurer-copy-btn",
            });
            copyBtn.addEventListener("click", () => {
                navigator.clipboard.writeText(this.errorLog.join("\n"));
                copyBtn.setText("Copied!");
                setTimeout(() => copyBtn.setText("Copy Errors (复制错误日志)"), 2000);
            });
        }
    }

    /** Check if any errors have been logged */
    hasErrors(): boolean {
        return this.errorLog.length > 0;
    }

    onCancelClick(callback: () => void): void {
        this.cancelCallback = callback;
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
