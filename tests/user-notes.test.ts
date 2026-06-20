import { describe, it, expect } from "vitest";
import { withPreservedNotes, extractUserNotes, NOTES_START } from "../src/utils/user-notes";

describe("withPreservedNotes", () => {
    it("carries the user's notes block from old content into regenerated content", () => {
        const old = `# Old AI body\n\n${NOTES_START}\n## 📝 My Notes\n\nMY IMPORTANT EDIT\n%% lnr:notes-end %%\n`;
        const fresh = "# New AI body\n\nregenerated content";

        const out = withPreservedNotes(old, fresh);
        expect(out).toContain("# New AI body");
        expect(out).toContain("MY IMPORTANT EDIT");
        expect(out).not.toContain("# Old AI body");
    });

    it("seeds an empty notes block for a brand-new page", () => {
        const out = withPreservedNotes("", "# AI body");
        expect(out).toContain("# AI body");
        expect(extractUserNotes(out)).not.toBeNull();
        expect(out).toContain("My Notes");
    });

    it("is idempotent — applying twice keeps a single block", () => {
        const once = withPreservedNotes("", "# AI body");
        const twice = withPreservedNotes(once, once);
        const count = (twice.match(/lnr:notes-start/g) || []).length;
        expect(count).toBe(1);
    });
});
