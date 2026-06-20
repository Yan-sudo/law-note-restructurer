/**
 * Shared, non-blocking progress state for long-running tasks (build, update,
 * outline, index). The controller is the single source of truth; the progress
 * modal, the Home side-panel card, and the status-bar item are all observers,
 * so a task can run while its pop-up is minimized and the user keeps working.
 */

export interface ProgressState {
    active: boolean;
    title: string;
    /** Streaming preview / sub-status line. */
    detail: string;
    /** 0–100, or null for an indeterminate bar. */
    percent: number | null;
    /** Task ended with errors and is waiting to be dismissed. */
    stopped: boolean;
    errors: string[];
    canCancel: boolean;
    startedAt: number;
}

type Listener = (s: ProgressState) => void;

function blank(): ProgressState {
    return {
        active: false,
        title: "",
        detail: "",
        percent: null,
        stopped: false,
        errors: [],
        canCancel: false,
        startedAt: 0,
    };
}

export class ProgressController {
    private state: ProgressState = blank();
    private listeners = new Set<Listener>();
    private cancelCb: (() => void) | null = null;

    subscribe(fn: Listener): () => void {
        this.listeners.add(fn);
        fn(this.state);
        return () => {
            this.listeners.delete(fn);
        };
    }

    private emit(): void {
        for (const fn of this.listeners) fn(this.state);
    }

    get(): ProgressState {
        return this.state;
    }

    isActive(): boolean {
        return this.state.active;
    }

    start(title: string, cancel?: () => void): void {
        this.cancelCb = cancel ?? null;
        this.state = {
            ...blank(),
            active: true,
            title,
            canCancel: !!cancel,
            startedAt: Date.now(),
        };
        this.emit();
    }

    setCancel(cancel: (() => void) | null): void {
        this.cancelCb = cancel;
        if (this.state.active && this.state.canCancel !== !!cancel) {
            this.state = { ...this.state, canCancel: !!cancel };
            this.emit();
        }
    }

    setTitle(title: string): void {
        if (this.state.active && this.state.title !== title) {
            this.state = { ...this.state, title };
            this.emit();
        }
    }

    setDetail(detail: string): void {
        if (this.state.active) {
            this.state = { ...this.state, detail };
            this.emit();
        }
    }

    setPercent(percent: number | null): void {
        if (!this.state.active) return;
        const clamped = percent === null ? null : Math.max(0, Math.min(100, percent));
        this.state = { ...this.state, percent: clamped };
        this.emit();
    }

    addError(message: string): void {
        this.state = { ...this.state, errors: [...this.state.errors, message] };
        this.emit();
    }

    /** Mark the task as failed/stopped; stays visible until dismissed. */
    fail(title: string): void {
        this.state = { ...this.state, title, stopped: true };
        this.emit();
    }

    /** Clear everything (task finished or was dismissed). */
    finish(): void {
        this.cancelCb = null;
        this.state = blank();
        this.emit();
    }

    requestCancel(): void {
        this.cancelCb?.();
    }
}

// Module-level singleton so UI (modal, card, status bar) and the pipeline all
// share one controller without threading it through every function signature.
let current: ProgressController | null = null;

export function setProgressController(controller: ProgressController | null): void {
    current = controller;
}

export function getProgressController(): ProgressController | null {
    return current;
}

/** Human-readable elapsed time, e.g. "0:42" or "3:05". */
export function formatElapsed(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}
