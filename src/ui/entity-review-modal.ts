import { App, Modal, Setting } from "obsidian";
import type {
    ExtractedEntities,
    LegalCase,
    LegalConcept,
    LegalPrinciple,
    LegalRule,
} from "../types";

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
        for (let i = 0; i < this.entities.concepts.length; i++) {
            const concept = this.entities.concepts[i];
            const detailsEl = container.createEl("details", {
                cls: "law-restructurer-entity-card",
            });
            detailsEl.createEl("summary", {
                text: `${concept.name}${concept.nameChinese ? ` (${concept.nameChinese})` : ""} [${concept.category}]`,
            });

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

            const deleteBtn = inner.createEl("button", {
                text: "Delete (删除)",
                cls: "mod-warning",
            });
            deleteBtn.addEventListener("click", () => {
                this.entities.concepts.splice(i, 1);
                this.renderTabContent(container.parentElement!.querySelector(".law-restructurer-tab-content")!);
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
                this.renderTabContent(container.parentElement!.querySelector(".law-restructurer-tab-content")!);
            });
        }
    }

    private renderPrinciples(container: HTMLElement): void {
        for (let i = 0; i < this.entities.principles.length; i++) {
            const principle = this.entities.principles[i];
            const detailsEl = container.createEl("details", {
                cls: "law-restructurer-entity-card",
            });
            detailsEl.createEl("summary", {
                text: `${principle.name}${principle.nameChinese ? ` (${principle.nameChinese})` : ""}`,
            });

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

            const deleteBtn = inner.createEl("button", {
                text: "Delete (删除)",
                cls: "mod-warning",
            });
            deleteBtn.addEventListener("click", () => {
                this.entities.principles.splice(i, 1);
                this.renderTabContent(container.parentElement!.querySelector(".law-restructurer-tab-content")!);
            });
        }
    }

    private renderRules(container: HTMLElement): void {
        for (let i = 0; i < this.entities.rules.length; i++) {
            const rule = this.entities.rules[i];
            const detailsEl = container.createEl("details", {
                cls: "law-restructurer-entity-card",
            });
            detailsEl.createEl("summary", {
                text: `${rule.name}${rule.nameChinese ? ` (${rule.nameChinese})` : ""}`,
            });

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

            const deleteBtn = inner.createEl("button", {
                text: "Delete (删除)",
                cls: "mod-warning",
            });
            deleteBtn.addEventListener("click", () => {
                this.entities.rules.splice(i, 1);
                this.renderTabContent(container.parentElement!.querySelector(".law-restructurer-tab-content")!);
            });
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
