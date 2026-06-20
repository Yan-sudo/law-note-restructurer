/**
 * User-notes zone: a clearly-marked block on each generated page that the
 * plugin **never overwrites**. Whatever the user writes between the markers is
 * carried across every regeneration, so a page is `AI content (refreshed)` +
 * `your notes (preserved)`.
 */

export const NOTES_START = "%% lnr:notes-start %%";
export const NOTES_END = "%% lnr:notes-end %%";

const NOTES_RE = /%% lnr:notes-start %%[\s\S]*?%% lnr:notes-end %%/;
const NOTES_RE_G = /%% lnr:notes-start %%[\s\S]*?%% lnr:notes-end %%/g;

export const EMPTY_USER_NOTES =
    `${NOTES_START}\n## 📝 My Notes\n\n*Write anything here — it is preserved across updates.*\n${NOTES_END}`;

/** The user-notes block in `content`, or null if absent. */
export function extractUserNotes(content: string): string | null {
    const m = content.match(NOTES_RE);
    return m ? m[0] : null;
}

/**
 * Return `newContent` with the user-notes block carried over from `oldContent`
 * (or seeded empty if neither has one). Idempotent: re-applying keeps a single
 * block at the end.
 */
export function withPreservedNotes(oldContent: string, newContent: string): string {
    const notes = extractUserNotes(oldContent) ?? extractUserNotes(newContent) ?? EMPTY_USER_NOTES;
    const stripped = newContent.replace(NOTES_RE_G, "").trimEnd();
    return `${stripped}\n\n${notes}\n`;
}
