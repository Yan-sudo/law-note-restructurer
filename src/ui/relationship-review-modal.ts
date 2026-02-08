import { App, Modal, Setting } from "obsidian";
import type {
    ExtractedEntities,
    RelationshipEntry,
    RelationshipMatrix,
    RelationshipType,
} from "../types";

export class RelationshipReviewModal extends Modal {
    private matrix: RelationshipMatrix;
    private entities: ExtractedEntities;
    private onConfirm: (matrix: RelationshipMatrix) => void;
    private onCancel: () => void;

    constructor(
        app: App,
        matrix: RelationshipMatrix,
        entities: ExtractedEntities,
        onConfirm: (matrix: RelationshipMatrix) => void,
        onCancel: () => void
    ) {
        super(app);
        this.matrix = JSON.parse(JSON.stringify(matrix));
        this.entities = entities;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("law-restructurer-relationship-review");

        contentEl.createEl("h2", {
            text: "Review Relationships (审查关系矩阵)",
        });
        contentEl.createEl("p", {
            text: `${this.matrix.entries.length} relationships found between ${this.matrix.casesInOrder.length} cases and ${this.matrix.conceptsInOrder.length} concepts.`,
            cls: "setting-item-description",
        });

        // Render matrix table
        const tableContainer = contentEl.createDiv(
            "law-restructurer-matrix-container"
        );
        this.renderMatrix(tableContainer);

        // Entry list for editing
        contentEl.createEl("h3", { text: "Edit Relationships" });
        const entryList = contentEl.createDiv("law-restructurer-entry-list");
        this.renderEntries(entryList);

        // Buttons
        const buttonDiv = contentEl.createDiv("law-restructurer-buttons");

        const cancelBtn = buttonDiv.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => {
            this.close();
            this.onCancel();
        });

        const confirmBtn = buttonDiv.createEl("button", {
            text: "Confirm & Generate (确认并生成)",
            cls: "mod-cta",
        });
        confirmBtn.addEventListener("click", () => {
            this.close();
            this.onConfirm(this.matrix);
        });
    }

    private renderMatrix(container: HTMLElement): void {
        const table = container.createEl("table", {
            cls: "law-restructurer-matrix-table",
        });

        // Header row
        const thead = table.createEl("thead");
        const headerRow = thead.createEl("tr");
        headerRow.createEl("th", { text: "Case \\ Concept" });
        for (const conceptId of this.matrix.conceptsInOrder) {
            const concept = this.entities.concepts.find(
                (c) => c.id === conceptId
            );
            headerRow.createEl("th", {
                text: concept?.name ?? conceptId,
            });
        }

        // Data rows
        const tbody = table.createEl("tbody");
        for (const caseId of this.matrix.casesInOrder) {
            const cas = this.entities.cases.find((c) => c.id === caseId);
            const row = tbody.createEl("tr");
            row.createEl("td", { text: cas?.name ?? caseId });

            for (const conceptId of this.matrix.conceptsInOrder) {
                const entry = this.matrix.entries.find(
                    (e) => e.caseId === caseId && e.conceptId === conceptId
                );
                const cell = row.createEl("td");
                if (entry) {
                    cell.setText(entry.relationshipType);
                    cell.addClass(
                        `law-restructurer-rel-${entry.relationshipType}`
                    );
                    cell.title = entry.description;
                } else {
                    cell.setText("-");
                    cell.addClass("law-restructurer-rel-none");
                }
            }
        }
    }

    private renderEntries(container: HTMLElement): void {
        const relationshipTypes: RelationshipType[] = [
            "establishes",
            "applies",
            "modifies",
            "distinguishes",
            "overrules",
            "illustrates",
        ];

        for (let i = 0; i < this.matrix.entries.length; i++) {
            const entry = this.matrix.entries[i];
            const cas = this.entities.cases.find(
                (c) => c.id === entry.caseId
            );
            const concept = this.entities.concepts.find(
                (c) => c.id === entry.conceptId
            );

            const detailsEl = container.createEl("details", {
                cls: "law-restructurer-entity-card",
            });
            detailsEl.createEl("summary", {
                text: `${cas?.name ?? entry.caseId} → ${concept?.name ?? entry.conceptId} [${entry.relationshipType}]`,
            });

            const inner = detailsEl.createDiv();

            new Setting(inner).setName("Type").addDropdown((d) => {
                for (const rt of relationshipTypes) {
                    d.addOption(rt, rt);
                }
                d.setValue(entry.relationshipType).onChange((v) => {
                    entry.relationshipType = v as RelationshipType;
                });
            });

            new Setting(inner)
                .setName("Description")
                .addTextArea((t) =>
                    t.setValue(entry.description).onChange((v) => {
                        entry.description = v;
                    })
                );

            new Setting(inner).setName("Strength").addDropdown((d) => {
                d.addOption("primary", "Primary");
                d.addOption("secondary", "Secondary");
                d.addOption("tangential", "Tangential");
                d.setValue(entry.strength).onChange((v) => {
                    entry.strength = v as "primary" | "secondary" | "tangential";
                });
            });

            const deleteBtn = inner.createEl("button", {
                text: "Delete (删除)",
                cls: "mod-warning",
            });
            deleteBtn.addEventListener("click", () => {
                this.matrix.entries.splice(i, 1);
                this.renderEntries(container);
            });
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
