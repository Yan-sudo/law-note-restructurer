import { Vault } from "obsidian";

export async function ensureFolderExists(
    vault: Vault,
    folderPath: string
): Promise<void> {
    const parts = folderPath.split("/");
    let currentPath = "";
    for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const existing = vault.getAbstractFileByPath(currentPath);
        if (!existing) {
            try {
                await vault.createFolder(currentPath);
            } catch {
                // Folder may already exist
            }
        }
    }
}

export function sanitizeFilename(name: string): string {
    return name
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
}
