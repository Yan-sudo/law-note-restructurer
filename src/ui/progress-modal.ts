import { Modal, App } from "obsidian";
import { getProgressController } from "./progress";

/**
 * The big, centered progress pop-up. It also mirrors its state into the shared
 * ProgressController, so the user can **Minimize** it — the task keeps running
 * and its progress stays visible in the Law Notes side panel and the status bar.
 */
export class ProgressModal extends Modal {
    private stepLabel: HTMLElement | null = null;
    private progressFill: HTMLElement | null = null;
    private previewArea: HTMLElement | null = null;
    private errorArea: HTMLElement | null = null;
    private cancelBtn: HTMLElement | null = null;
    private cancelCallback: (() => void) | null = null;
    private errorLog: string[] = [];
    private stopped = false;
    private cancelled = false;
    private minimized = false;
    private currentTitle = "Processing...";

    constructor(app: App) {
        super(app);
    }

    private controller() {
        return getProgressController();
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("law-restructurer-progress");

        this.stepLabel = contentEl.createEl("h3", { text: this.currentTitle });

        const barContainer = contentEl.createDiv("law-restructurer-progress-bar");
        this.progressFill = barContainer.createDiv(
            "law-restructurer-progress-bar-fill law-restructurer-progress-bar-indeterminate"
        );

        this.previewArea = contentEl.createDiv("law-restructurer-preview-area");
        this.previewArea.setText("Waiting for AI response...");

        // Error log area (hidden initially)
        this.errorArea = contentEl.createDiv("law-restructurer-error-area");
        this.errorArea.style.display = "none";

        const buttons = contentEl.createDiv("law-restructurer-buttons");

        // Minimize: hide the pop-up but keep the task running (progress moves to
        // the side panel + status bar).
        const minimizeBtn = buttons.createEl("button", { text: "Minimize (最小化)" });
        minimizeBtn.addEventListener("click", () => {
            this.minimized = true;
            this.close();
        });

        this.cancelBtn = buttons.createEl("button", { text: "Cancel (取消)" });
        this.cancelBtn.addEventListener("click", () => {
            if (this.stopped) {
                this.close();
            } else {
                this.cancelled = true;
                this.cancelCallback?.();
                this.close();
            }
        });

        // Start (or re-sync) the shared task state when the pop-up appears.
        this.controller()?.start(this.currentTitle, this.cancelCallback ?? undefined);
    }

    setStep(label: string): void {
        this.currentTitle = label;
        this.stepLabel?.setText(label);
        this.controller()?.setTitle(label);
    }

    setProgress(percent: number): void {
        if (this.progressFill) {
            this.progressFill.removeClass("law-restructurer-progress-bar-indeterminate");
            this.progressFill.style.width = `${Math.min(100, percent)}%`;
        }
        this.controller()?.setPercent(percent);
    }

    setIndeterminate(): void {
        if (this.progressFill) {
            this.progressFill.addClass("law-restructurer-progress-bar-indeterminate");
            this.progressFill.style.width = "";
        }
        this.controller()?.setPercent(null);
    }

    updatePreview(text: string): void {
        if (this.previewArea) {
            this.previewArea.setText(text);
            this.previewArea.scrollTop = this.previewArea.scrollHeight;
        }
        // Keep the mirrored detail short — only the tail matters for a status line.
        this.controller()?.setDetail(text.slice(-280));
    }

    /**
     * Log an error — shown in a distinct error area that's selectable/copyable.
     * Does NOT close the modal.
     */
    addError(message: string): void {
        this.errorLog.push(message);
        this.controller()?.addError(message);
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
        this.currentTitle = title;
        this.controller()?.fail(title);
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

    /** Check if user has clicked cancel */
    isCancelled(): boolean {
        return this.cancelled;
    }

    onCancelClick(callback: () => void): void {
        this.cancelCallback = callback;
        this.controller()?.setCancel(callback);
    }

    onClose(): void {
        this.contentEl.empty();
        // Minimized: keep the shared task alive so the side panel keeps showing it.
        if (this.minimized) {
            this.minimized = false;
            return;
        }
        this.controller()?.finish();
    }
}
