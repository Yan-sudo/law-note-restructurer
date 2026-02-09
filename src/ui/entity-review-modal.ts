import { App, Modal, Setting } from "obsidian";
import type {
    ExtractedEntities,
    LegalCase,
    LegalConcept,
    LegalPrinciple,
    LegalRule,
} from "../types";
import {
    findDuplicateConcepts,
    findDuplicatePrinciples,
    findDuplicateRules,
    type DuplicatePair,
} from "../pipeline/entity-merger";

type Tab = "concepts" | "cases" | "principles" | "rules";

export class EntityReviewModal extends Modal {
    private entities: ExtractedEntities;
    private activeTab: Tab = "concepts";
    private onConfirm: (entities: ExtractedEntities) => void;
    private onReextract: () => void;
    private onCancel: () => void;

    constructor(
        app: App,
        entities: ExtractedEntities,
        onConfirm: (entities: ExtractedEntities) => void,
        onReextract: () => void,
        onCancel: () => void
    ) {
        super(app);
        // Deep clone to avoid mutating original
        this.entities = JSON.parse(JSON.stringify(entities));
        this.onConfirm = onConfirm;
        this.onReextract = onReextract;
        this.onCancel = onCancel;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("law-restructurer-entity-review");

        contentEl.createEl("h2", { text: "Review Extracted Entities (审查提取的实体)" });

        // Duplicate warning banner
        const dupCount = this.countDuplicates();
        if (dupCount > 0) {
            const banner = contentEl.createDiv("law-restructurer-dup-banner");
            banner.setText(
                `${dupCount} potential duplicate(s) found. Review and merge below. (发现 ${dupCount} 个可能的重复项)`
            );
        }

        const summary = contentEl.createEl("p", { cls: "setting-item-description" });
        this.updateSummary(summary);

        // Tab bar
        const tabBar = contentEl.createDiv("law-restructurer-tabs");
        const tabs: { key: Tab; label: string }[] = [
            { key: "concepts", label: `Concepts (${this.entities.concepts.length})` },
            { key: "cases", label: `Cases (${this.entities.cases.length})` },
            { key: "principles", label: `Principles (${this.entities.principles.length})` },
            { key: "rules", label: `Rules (${this.entities.rules.length})` },
        ];

        const tabButtons: Record<string, HTMLElement> = {};
        for (const tab of tabs) {
            const btn = tabBar.createEl("button", {
                text: tab.label,
                cls: tab.key === this.activeTab ? "law-restructurer-tab-active" : "",
            });
            tabButtons[tab.key] = btn;
            btn.addEventListener("click", () => {
                this.activeTab = tab.key;
                Object.values(tabButtons).forEach((b) =>
                    b.removeClass("law-restructurer-tab-active")
                );
                btn.addClass("law-restructurer-tab-active");
                this.renderTabContent(tabContent);
            });
        }

        // Tab content area
        const tabContent = contentEl.createDiv("law-restructurer-tab-content");
        this.renderTabContent(tabContent);

        // Action buttons
        const buttonDiv = contentEl.createDiv("law-restructurer-buttons");

        const cancelBtn = buttonDiv.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => {
            this.close();
            this.onCancel();
        });

        const reextractBtn = buttonDiv.createEl("button", {
            text: "Re-extract (重新提取)",
        });
        reextractBtn.addEventListener("click", () => {
            this.close();
            this.onReextract();
        });

        const confirmBtn = buttonDiv.createEl("button", {
            text: "Confirm & Continue (确认)",
            cls: "mod-cta",
        });
        confirmBtn.addEventListener("click", () => {
            this.close();
            this.onConfirm(this.entities);
        });
    }

    private countDuplicates(): number {
        return (
            findDuplicateConcepts(this.entities.concepts).length +
            findDuplicatePrinciples(this.entities.principles).length +
            findDuplicateRules(this.entities.rules).length
        );
    }

    private updateSummary(el: HTMLElement): void {
        el.setText(
            `Found: ${this.entities.concepts.length} concepts, ${this.entities.cases.length} cases, ` +
            `${this.entities.principles.length} principles, ${this.entities.rules.length} rules`
        );
    }

    private renderTabContent(container: HTMLElement): void {
        container.empty();

        switch (this.activeTab) {
            case "concepts":
                this.renderConcepts(container);
                break;
            case "cases":
                this.renderCases(container);
                break;
            case "principles":
                this.renderPrinciples(container);
                break;
            case "rules":
                this.renderRules(container);
                break;
        }
    }

    private renderConcepts(container: HTMLElement): void {
        const duplicates = findDuplicateConcepts(this.entities.concepts);
        const dupIndices = new Set<number>();
        for (const pair of duplicates) {
            dupIndices.add(pair.indexA);
            dupIndices.add(pair.indexB);
        }

        for (let i = 0; i < this.entities.concepts.length; i++) {
            const concept = this.entities.concepts[i];
            const isDup = dupIndices.has(i);
            const detailsEl = container.createEl("details", {
                cls: `law-restructurer-entity-card${isDup ? " law-restructurer-dup-highlight" : ""}`,
            });
            const summaryText = `${concept.name}${concept.nameChinese ? ` (${concept.nameChinese})` : ""} [${concept.category}]${isDup ? " ⚠ duplicate" : ""}`;
            detailsEl.createEl("summary", { text: summaryText });

            const inner = detailsEl.createDiv();
            new Setting(inner)
                .setName("Name")
                .addText((t) =>
                    t.setValue(concept.name).onChange((v) => {
                        concept.name = v;
                    })
                );
            new Setting(inner)
                .setName("Chinese Name")
                .addText((t) =>
                    t.setValue(concept.nameChinese ?? "").onChange((v) => {
                        concept.nameChinese = v || undefined;
                    })
                );
            new Setting(inner)
                .setName("Definition")
                .addTextArea((t) =>
                    t.setValue(concept.definition).onChange((v) => {
                        concept.definition = v;
                    })
                );

            // Merge button for duplicates
            if (isDup) {
                const pair = duplicates.find(
                    (p) => p.indexA === i || p.indexB === i
                );
                if (pair) {
                    const otherIdx = pair.indexA === i ? pair.indexB : pair.indexA;
                    const otherName = this.entities.concepts[otherIdx]?.name;
                    if (otherName) {
                        const mergeBtn = inner.createEl("button", {
                            text: `Merge with "${otherName}" (合并)`,
                            cls: "mod-cta",
                        });
                        mergeBtn.addEventListener("click", () => {
                            this.mergeConcepts(i, otherIdx);
                            this.rerender();
                        });
                    }
                }
            }

            const deleteBtn = inner.createEl("button", {
                text: "Delete (删除)",
                cls: "mod-warning",
            });
            deleteBtn.addEventListener("click", () => {
                this.entities.concepts.splice(i, 1);
                this.rerender();
            });
        }
    }

    private renderCases(container: HTMLElement): void {
        for (let i = 0; i < this.entities.cases.length; i++) {
            const cas = this.entities.cases[i];
            const detailsEl = container.createEl("details", {
                cls: "law-restructurer-entity-card",
            });
            detailsEl.createEl("summary", {
                text: `${cas.name}${cas.citation ? ` - ${cas.citation}` : ""}`,
            });

            const inner = detailsEl.createDiv();
            new Setting(inner)
                .setName("Name")
                .addText((t) => t.setValue(cas.name).onChange((v) => { cas.name = v; }));
            new Setting(inner)
                .setName("Citation")
                .addText((t) => t.setValue(cas.citation ?? "").onChange((v) => { cas.citation = v || undefined; }));
            new Setting(inner)
                .setName("Facts")
                .addTextArea((t) => t.setValue(cas.facts).onChange((v) => { cas.facts = v; }));
            new Setting(inner)
                .setName("Holding")
                .addTextArea((t) => t.setValue(cas.holding).onChange((v) => { cas.holding = v; }));
            new Setting(inner)
                .setName("Significance")
                .addTextArea((t) => t.setValue(cas.significance).onChange((v) => { cas.significance = v; }));

            const deleteBtn = inner.createEl("button", {
                text: "Delete (删除)",
                cls: "mod-warning",
            });
            deleteBtn.addEventListener("click", () => {
                this.entities.cases.splice(i, 1);
                this.rerender();
            });
        }
    }

    private renderPrinciples(container: HTMLElement): void {
        const duplicates = findDuplicatePrinciples(this.entities.principles);
        const dupIndices = new Set<number>();
        for (const pair of duplicates) {
            dupIndices.add(pair.indexA);
            dupIndices.add(pair.indexB);
        }

        for (let i = 0; i < this.entities.principles.length; i++) {
            const principle = this.entities.principles[i];
            const isDup = dupIndices.has(i);
            const detailsEl = container.createEl("details", {
                cls: `law-restructurer-entity-card${isDup ? " law-restructurer-dup-highlight" : ""}`,
            });
            const summaryText = `${principle.name}${principle.nameChinese ? ` (${principle.nameChinese})` : ""}${isDup ? " ⚠ duplicate" : ""}`;
            detailsEl.createEl("summary", { text: summaryText });

            const inner = detailsEl.createDiv();
            new Setting(inner)
                .setName("Name")
                .addText((t) => t.setValue(principle.name).onChange((v) => { principle.name = v; }));
            new Setting(inner)
                .setName("Chinese Name")
                .addText((t) => t.setValue(principle.nameChinese ?? "").onChange((v) => { principle.nameChinese = v || undefined; }));
            new Setting(inner)
                .setName("Description")
                .addTextArea((t) => t.setValue(principle.description).onChange((v) => { principle.description = v; }));

            if (isDup) {
                const pair = duplicates.find(
                    (p) => p.indexA === i || p.indexB === i
                );
                if (pair) {
                    const otherIdx = pair.indexA === i ? pair.indexB : pair.indexA;
                    const otherName = this.entities.principles[otherIdx]?.name;
                    if (otherName) {
                        const mergeBtn = inner.createEl("button", {
                            text: `Merge with "${otherName}" (合并)`,
                            cls: "mod-cta",
                        });
                        mergeBtn.addEventListener("click", () => {
                            this.mergePrinciples(i, otherIdx);
                            this.rerender();
                        });
                    }
                }
            }

            const deleteBtn = inner.createEl("button", {
                text: "Delete (删除)",
                cls: "mod-warning",
            });
            deleteBtn.addEventListener("click", () => {
                this.entities.principles.splice(i, 1);
                this.rerender();
            });
        }
    }

    private renderRules(container: HTMLElement): void {
        const duplicates = findDuplicateRules(this.entities.rules);
        const dupIndices = new Set<number>();
        for (const pair of duplicates) {
            dupIndices.add(pair.indexA);
            dupIndices.add(pair.indexB);
        }

        for (let i = 0; i < this.entities.rules.length; i++) {
            const rule = this.entities.rules[i];
            const isDup = dupIndices.has(i);
            const detailsEl = container.createEl("details", {
                cls: `law-restructurer-entity-card${isDup ? " law-restructurer-dup-highlight" : ""}`,
            });
            const summaryText = `${rule.name}${rule.nameChinese ? ` (${rule.nameChinese})` : ""}${isDup ? " ⚠ duplicate" : ""}`;
            detailsEl.createEl("summary", { text: summaryText });

            const inner = detailsEl.createDiv();
            new Setting(inner)
                .setName("Name")
                .addText((t) => t.setValue(rule.name).onChange((v) => { rule.name = v; }));
            new Setting(inner)
                .setName("Statement")
                .addTextArea((t) => t.setValue(rule.statement).onChange((v) => { rule.statement = v; }));
            new Setting(inner)
                .setName("Elements (one per line)")
                .addTextArea((t) =>
                    t.setValue(rule.elements.join("\n")).onChange((v) => {
                        rule.elements = v.split("\n").filter((s) => s.trim());
                    })
                );
            new Setting(inner)
                .setName("Exceptions (one per line)")
                .addTextArea((t) =>
                    t.setValue(rule.exceptions.join("\n")).onChange((v) => {
                        rule.exceptions = v.split("\n").filter((s) => s.trim());
                    })
                );

            if (isDup) {
                const pair = duplicates.find(
                    (p) => p.indexA === i || p.indexB === i
                );
                if (pair) {
                    const otherIdx = pair.indexA === i ? pair.indexB : pair.indexA;
                    const otherName = this.entities.rules[otherIdx]?.name;
                    if (otherName) {
                        const mergeBtn = inner.createEl("button", {
                            text: `Merge with "${otherName}" (合并)`,
                            cls: "mod-cta",
                        });
                        mergeBtn.addEventListener("click", () => {
                            this.mergeRules(i, otherIdx);
                            this.rerender();
                        });
                    }
                }
            }

            const deleteBtn = inner.createEl("button", {
                text: "Delete (删除)",
                cls: "mod-warning",
            });
            deleteBtn.addEventListener("click", () => {
                this.entities.rules.splice(i, 1);
                this.rerender();
            });
        }
    }

    // ============================================================
    // Merge helpers
    // ============================================================

    private mergeConcepts(indexA: number, indexB: number): void {
        const a = this.entities.concepts[indexA];
        const b = this.entities.concepts[indexB];
        // Keep shorter name, longer definition
        const keep = a.name.length <= b.name.length ? a : b;
        const other = keep === a ? b : a;
        keep.definition = keep.definition.length >= other.definition.length
            ? keep.definition : other.definition;
        keep.nameChinese = keep.nameChinese || other.nameChinese;
        keep.sourceReferences = [...new Set([...keep.sourceReferences, ...other.sourceReferences])];
        // Remove the other
        const removeIdx = keep === a ? indexB : indexA;
        this.entities.concepts.splice(removeIdx, 1);
    }

    private mergePrinciples(indexA: number, indexB: number): void {
        const a = this.entities.principles[indexA];
        const b = this.entities.principles[indexB];
        const keep = a.name.length <= b.name.length ? a : b;
        const other = keep === a ? b : a;
        keep.description = keep.description.length >= other.description.length
            ? keep.description : other.description;
        keep.nameChinese = keep.nameChinese || other.nameChinese;
        keep.relatedConcepts = [...new Set([...keep.relatedConcepts, ...other.relatedConcepts])];
        keep.supportingCases = [...new Set([...keep.supportingCases, ...other.supportingCases])];
        keep.sourceReferences = [...new Set([...keep.sourceReferences, ...other.sourceReferences])];
        const removeIdx = keep === a ? indexB : indexA;
        this.entities.principles.splice(removeIdx, 1);
    }

    private mergeRules(indexA: number, indexB: number): void {
        const a = this.entities.rules[indexA];
        const b = this.entities.rules[indexB];
        const keep = a.name.length <= b.name.length ? a : b;
        const other = keep === a ? b : a;
        keep.statement = keep.statement.length >= other.statement.length
            ? keep.statement : other.statement;
        keep.nameChinese = keep.nameChinese || other.nameChinese;
        keep.elements = [...new Set([...keep.elements, ...other.elements])];
        keep.exceptions = [...new Set([...keep.exceptions, ...other.exceptions])];
        keep.applicationSteps = [...new Set([...keep.applicationSteps, ...other.applicationSteps])];
        keep.relatedConcepts = [...new Set([...keep.relatedConcepts, ...other.relatedConcepts])];
        keep.supportingCases = [...new Set([...keep.supportingCases, ...other.supportingCases])];
        keep.sourceReferences = [...new Set([...keep.sourceReferences, ...other.sourceReferences])];
        const removeIdx = keep === a ? indexB : indexA;
        this.entities.rules.splice(removeIdx, 1);
    }

    private rerender(): void {
        const tabContent = this.contentEl.querySelector(
            ".law-restructurer-tab-content"
        );
        if (tabContent) {
            this.renderTabContent(tabContent as HTMLElement);
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
