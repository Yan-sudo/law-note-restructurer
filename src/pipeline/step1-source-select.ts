import { App, Notice, TFile } from "obsidian";
import { parseMarkdownFile } from "../parsers/markdown-parser";
import { parseDocxFile } from "../parsers/docx-parser";
import type { SourceDocument } from "../types";
import { FilePickerModal } from "../ui/file-picker-modal";

export async function runStep1(app: App): Promise<SourceDocument[] | null> {
    return new Promise((resolve) => {
        const modal = new FilePickerModal(
            app,
            async (files: TFile[]) => {
                try {
                    new Notice(`Parsing ${files.length} files...`);
                    const docs: SourceDocument[] = [];

                    for (const file of files) {
                        if (file.extension === "md") {
                            docs.push(await parseMarkdownFile(app, file));
                        } else if (file.extension === "docx") {
                            docs.push(await parseDocxFile(app, file));
                        }
                    }

                    const totalTokens = docs.reduce(
                        (sum, d) => sum + d.tokenEstimate,
                        0
                    );
                    new Notice(
                        `Parsed ${docs.length} files (~${totalTokens.toLocaleString()} tokens)`
                    );
                    resolve(docs);
                } catch (error) {
                    new Notice(`Error parsing files: ${error}`);
                    resolve(null);
                }
            },
            () => resolve(null)
        );
        modal.open();
    });
}
