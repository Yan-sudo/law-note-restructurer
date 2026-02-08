import { App, TFile } from "obsidian";
import { estimateTokens, type SourceDocument } from "../types";

export async function parseMarkdownFile(
    app: App,
    file: TFile
): Promise<SourceDocument> {
    const rawText = await app.vault.read(file);
    return {
        path: file.path,
        filename: file.name,
        type: "md",
        rawText,
        charCount: rawText.length,
        tokenEstimate: estimateTokens(rawText),
    };
}

export async function parseMarkdownFiles(
    app: App,
    files: TFile[]
): Promise<SourceDocument[]> {
    return Promise.all(files.map((f) => parseMarkdownFile(app, f)));
}
