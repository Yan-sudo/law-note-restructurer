import { TFile, Vault } from "obsidian";
import type { ExtractedEntities, RelationshipMatrix } from "../types";

export interface PersistedState {
    entities: ExtractedEntities;
    matrix: RelationshipMatrix;
    savedAt: string;
    sourceFiles: string[];
}

const STATE_FILENAME = "_state.json";

export async function savePipelineState(
    vault: Vault,
    courseFolder: string,
    entities: ExtractedEntities,
    matrix: RelationshipMatrix,
    sourceFiles: string[]
): Promise<void> {
    const state: PersistedState = {
        entities,
        matrix,
        savedAt: new Date().toISOString(),
        sourceFiles,
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
