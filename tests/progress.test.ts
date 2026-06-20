import { describe, it, expect, vi } from "vitest";
import { ProgressController, formatElapsed } from "../src/ui/progress";

describe("ProgressController", () => {
    it("notifies subscribers on start and clamps percent", () => {
        const c = new ProgressController();
        const seen: number[] = [];
        c.subscribe((s) => {
            if (s.active && s.percent !== null) seen.push(s.percent);
        });
        c.start("Build");
        expect(c.isActive()).toBe(true);
        c.setPercent(150);
        c.setPercent(-5);
        expect(seen).toEqual([100, 0]);
    });

    it("ignores updates once finished", () => {
        const c = new ProgressController();
        c.start("X");
        c.finish();
        expect(c.isActive()).toBe(false);
        c.setPercent(50);
        expect(c.get().percent).toBeNull();
    });

    it("keeps a stopped task visible until dismissed", () => {
        const c = new ProgressController();
        c.start("X");
        c.addError("boom");
        c.fail("Failed");
        const s = c.get();
        expect(s.stopped).toBe(true);
        expect(s.errors).toEqual(["boom"]);
        expect(s.title).toBe("Failed");
    });

    it("routes cancel to the registered callback", () => {
        const c = new ProgressController();
        const cancel = vi.fn();
        c.start("X", cancel);
        c.requestCancel();
        expect(cancel).toHaveBeenCalledOnce();
    });

    it("emits the current state immediately on subscribe", () => {
        const c = new ProgressController();
        c.start("Indexing");
        let title = "";
        c.subscribe((s) => (title = s.title));
        expect(title).toBe("Indexing");
    });
});

describe("formatElapsed", () => {
    it("formats m:ss", () => {
        expect(formatElapsed(0)).toBe("0:00");
        expect(formatElapsed(42_000)).toBe("0:42");
        expect(formatElapsed(185_000)).toBe("3:05");
    });
});
