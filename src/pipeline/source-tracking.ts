/**
 * Source-file change tracking for one-command incremental updates.
 * The persisted state records a signature (path + mtime) for every source note
 * that has been processed; on "Update Knowledge Base" we rescan the folders
 * those notes live in and process only what's new or modified.
 */

export interface SourceSignature {
    path: string;
    mtime: number;
}

/** Paths in `current` that are new or whose mtime differs from `recorded`. */
export function detectChangedSources(
    current: SourceSignature[],
    recorded: SourceSignature[]
): string[] {
    const prev = new Map(recorded.map((s) => [s.path, s.mtime]));
    return current
        .filter((c) => !prev.has(c.path) || prev.get(c.path) !== c.mtime)
        .map((c) => c.path);
}

/** Union of recorded + current signatures (the latest mtime wins). */
export function mergeSignatures(
    recorded: SourceSignature[],
    current: SourceSignature[]
): SourceSignature[] {
    const map = new Map(recorded.map((s) => [s.path, s.mtime]));
    for (const c of current) map.set(c.path, c.mtime);
    return [...map.entries()].map(([path, mtime]) => ({ path, mtime }));
}

/** Distinct parent folders of the recorded sources — the folders to rescan. */
export function watchedFolders(recorded: SourceSignature[]): string[] {
    const dirs = new Set<string>();
    for (const s of recorded) {
        const i = s.path.lastIndexOf("/");
        dirs.add(i >= 0 ? s.path.slice(0, i) : "");
    }
    return [...dirs];
}
