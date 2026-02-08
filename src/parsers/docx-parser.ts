import { App, TFile } from "obsidian";
import mammoth from "mammoth";
import { estimateTokens, type SourceDocument } from "../types";

export async function parseDocxFile(
    app: App,
    file: TFile
): Promise<SourceDocument> {
    const arrayBuffer = await app.vault.readBinary(file);
    const result = await mammoth.extractRawText({ arrayBuffer });

    if (result.value.trim().length === 0) {
        throw new Error(
            `"${file.name}" appears to be empty or contains only images/non-text content.`
        );
    }

    for (const msg of result.messages) {
        console.warn(`[mammoth] ${file.name}: ${msg.type}: ${msg.message}`);
    }

    const rawText = result.value;
    return {
        path: file.path,
        filename: file.name,
        type: "docx",
        rawText,
        charCount: rawText.length,
        tokenEstimate: estimateTokens(rawText),
    };
}

export async function parseDocxFiles(
    app: App,
    files: TFile[]
): Promise<SourceDocument[]> {
    return Promise.all(files.map((f) => parseDocxFile(app, f)));
}
