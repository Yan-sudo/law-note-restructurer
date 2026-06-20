import { TFile, TFolder, Vault } from "obsidian";
import type { ExtractedEntities, RelationshipMatrix } from "../types";
import type { SourceSignature } from "./source-tracking";

export interface PersistedState {
    entities: ExtractedEntities;
    matrix: RelationshipMatrix;
    savedAt: string;
    sourceFiles: string[];
    /** Path + mtime of every processed source note (enables incremental update). */
    sources?: SourceSignature[];
}

const STATE_FILENAME = "_state.json";

export async function savePipelineState(
    vault: Vault,
    courseFolder: string,
    entities: ExtractedEntities,
    matrix: RelationshipMatrix,
    sourceFiles: string[],
    sources?: SourceSignature[]
): Promise<void> {
    const state: PersistedState = {
        entities,
        matrix,
        savedAt: new Date().toISOString(),
        sourceFiles,
        sources,
    };

    const path = `${courseFolder}/${STATE_FILENAME}`;
    const json = JSON.stringify(state, null, 2);

    const existing = vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
        await vault.modify(existing, json);
    } else {
        await vault.create(path, json);
    }
}

export async function loadPipelineState(
    vault: Vault,
    courseFolder: string
): Promise<PersistedState | null> {
    const path = `${courseFolder}/${STATE_FILENAME}`;
    const file = vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return null;

    try {
        const content = await vault.read(file);
        return JSON.parse(content) as PersistedState;
    } catch {
        return null;
    }
}

export function stateExists(vault: Vault, courseFolder: string): boolean {
    const path = `${courseFolder}/${STATE_FILENAME}`;
    return vault.getAbstractFileByPath(path) instanceof TFile;
}

/**
 * Course names under `outputFolder` that already have a saved database
 * (a `_state.json`). An empty-string entry means the output folder itself holds
 * a root-level database (no course sub-folder).
 */
export function listCoursesWithState(vault: Vault, outputFolder: string): string[] {
    const names: string[] = [];
    if (stateExists(vault, outputFolder)) names.push("");
    const root = vault.getAbstractFileByPath(outputFolder);
    if (root instanceof TFolder) {
        for (const child of root.children) {
            if (child instanceof TFolder && stateExists(vault, child.path)) {
                names.push(child.name);
            }
        }
    }
    return names;
}
