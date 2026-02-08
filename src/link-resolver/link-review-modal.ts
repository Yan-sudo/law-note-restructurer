import { App, Modal, Setting } from "obsidian";
import type { LinkCategory, UnresolvedLink } from "./types";

type Tab = LinkCategory | "all";

const CATEGORY_LABELS: Record<LinkCategory, string> = {
    "us-case": "US Cases",
    "us-statute": "US Statutes",
    "cn-law": "中国法律",
    "cn-case": "中国案例",
    unknown: "Unknown",
};

export class LinkReviewModal extends Modal {
    private links: UnresolvedLink[];
    private selected: Set<string>;
    private activeTab: Tab = "all";
    private filterText = "";
    private onConfirm: (selectedLinks: UnresolvedLink[]) => void;
    private onCancel: () => void;

    constructor(
        app: App,
        links: UnresolvedLink[],
        onConfirm: (selectedLinks: UnresolvedLink[]) => void,
        onCancel: () => void
    ) {
        super(app);
        this.links = links;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;

        // Pre-select all classifiable links
        this.selected = new Set(
            links
                .filter((l) => l.category !== "unknown")
                .map((l) => l.linkText)
        );
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("law-restructurer-link-review");

        contentEl.createEl("h2", {
            text: "Review Unresolved Links (审查未解析链接)",
        });

        // Summary
        const summary = contentEl.createEl("p", {
            cls: "setting-item-description",
        });
        this.updateSummary(summary);

        // Filter
        const filterDiv = contentEl.createDiv("law-restructurer-filter");
        const filterInput = filterDiv.createEl("input", {
            type: "text",
            placeholder: "Filter links...",
            cls: "law-restructurer-filter-input",
        });
        filterInput.addEventListener("input", () => {
            this.filterText = filterInput.value.toLowerCase();
            this.renderList(listContainer);
        });

        // Bulk actions
        const bulkDiv = contentEl.createDiv("law-restructurer-bulk-actions");

        const selectAllBtn = bulkDiv.createEl("button", {
            text: "Select All Classifiable",
        });
        selectAllBtn.addEventListener("click", () => {
            for (const link of this.links) {
                if (link.category !== "unknown") {
                    this.selected.add(link.linkText);
                }
            }
            this.renderList(listContainer);
            this.updateSummary(summary);
        });

        const selectNoneBtn = bulkDiv.createEl("button", {
            text: "Select None",
        });
        selectNoneBtn.addEventListener("click", () => {
            this.selected.clear();
            this.renderList(listContainer);
            this.updateSummary(summary);
        });

        // Tab bar
        const tabBar = contentEl.createDiv("law-restructurer-tabs");
        const counts = this.getCategoryCounts();

        const tabDefs: { key: Tab; label: string }[] = [
            { key: "all", label: `All (${this.links.length})` },
        ];
        for (const cat of [
            "us-case",
            "us-statute",
            "cn-law",
            "cn-case",
            "unknown",
        ] as LinkCategory[]) {
            if (counts[cat] > 0) {
                tabDefs.push({
                    key: cat,
                    label: `${CATEGORY_LABELS[cat]} (${counts[cat]})`,
                });
            }
        }

        const tabButtons: Record<string, HTMLElement> = {};
        for (const tab of tabDefs) {
            const btn = tabBar.createEl("button", {
                text: tab.label,
                cls:
                    tab.key === this.activeTab
                        ? "law-restructurer-tab-active"
                        : "",
            });
            tabButtons[tab.key] = btn;
            btn.addEventListener("click", () => {
                this.activeTab = tab.key;
                Object.values(tabButtons).forEach((b) =>
                    b.removeClass("law-restructurer-tab-active")
                );
                btn.addClass("law-restructurer-tab-active");
                this.renderList(listContainer);
            });
        }

        // List
        const listContainer = contentEl.createDiv(
            "law-restructurer-link-list"
        );
        this.renderList(listContainer);

        // Action buttons
        const buttonDiv = contentEl.createDiv("law-restructurer-buttons");

        const cancelBtn = buttonDiv.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => {
            this.close();
            this.onCancel();
        });

        const confirmBtn = buttonDiv.createEl("button", {
            text: `Resolve Selected (确认解析)`,
            cls: "mod-cta",
        });
        confirmBtn.addEventListener("click", () => {
            const selectedLinks = this.links.filter((l) =>
                this.selected.has(l.linkText)
            );
            this.close();
            this.onConfirm(selectedLinks);
        });
    }

    private getCategoryCounts(): Record<LinkCategory, number> {
        const counts: Record<LinkCategory, number> = {
            "us-case": 0,
            "us-statute": 0,
            "cn-law": 0,
            "cn-case": 0,
            unknown: 0,
        };
        for (const link of this.links) {
            counts[link.category]++;
        }
        return counts;
    }

    private updateSummary(el: HTMLElement): void {
        const total = this.links.length;
        const selected = this.selected.size;
        const fileCount = new Set(
            this.links.flatMap((l) => l.referencedIn)
        ).size;
        el.setText(
            `Found ${total} unresolved links across ${fileCount} files. ${selected} selected for resolution.`
        );
    }

    private getVisibleLinks(): UnresolvedLink[] {
        return this.links.filter((link) => {
            if (
                this.activeTab !== "all" &&
                link.category !== this.activeTab
            ) {
                return false;
            }
            if (
                this.filterText &&
                !link.linkText.toLowerCase().includes(this.filterText)
            ) {
                return false;
            }
            return true;
        });
    }

    private renderList(container: HTMLElement): void {
        container.empty();
        const visible = this.getVisibleLinks();

        if (visible.length === 0) {
            container.createEl("p", {
                text: "No links matching current filter.",
                cls: "setting-item-description",
            });
            return;
        }

        for (const link of visible) {
            this.renderLinkItem(container, link);
        }
    }

    private renderLinkItem(
        container: HTMLElement,
        link: UnresolvedLink
    ): void {
        const itemDiv = container.createDiv("law-restructurer-link-item");

        // Checkbox
        const checkbox = itemDiv.createEl("input", { type: "checkbox" });
        checkbox.checked = this.selected.has(link.linkText);
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                this.selected.add(link.linkText);
            } else {
                this.selected.delete(link.linkText);
            }
            // Update summary
            const summary = this.contentEl.querySelector(
                ".setting-item-description"
            );
            if (summary) this.updateSummary(summary as HTMLElement);
        });

        // Text area
        const textDiv = itemDiv.createDiv("law-restructurer-link-info");

        textDiv.createEl("span", {
            text: link.linkText,
            cls: "law-restructurer-link-text",
        });

        const metaDiv = textDiv.createDiv("law-restructurer-link-meta");

        // Category badge
        metaDiv.createEl("span", {
            text: CATEGORY_LABELS[link.category],
            cls: `law-restructurer-badge law-restructurer-badge-${link.category}`,
        });

        // Reference count
        metaDiv.createEl("span", {
            text: `${link.referenceCount} refs`,
            cls: "law-restructurer-link-refs",
        });

        // Confidence
        if (link.confidence > 0) {
            metaDiv.createEl("span", {
                text: `${Math.round(link.confidence * 100)}%`,
                cls: "law-restructurer-link-confidence",
            });
        }

        // Category override (collapsible)
        const detailsEl = itemDiv.createEl("details");
        detailsEl.createEl("summary", { text: "▼" });
        const inner = detailsEl.createDiv();
        new Setting(inner).setName("Category").addDropdown((d) => {
            d.addOption("us-case", "US Case");
            d.addOption("us-statute", "US Statute");
            d.addOption("cn-law", "Chinese Law (中国法律)");
            d.addOption("cn-case", "Chinese Case (中国案例)");
            d.addOption("unknown", "Unknown / Skip");
            d.setValue(link.category);
            d.onChange((v) => {
                link.category = v as LinkCategory;
                // Update badge text
                const badge = itemDiv.querySelector(
                    ".law-restructurer-badge"
                );
                if (badge) {
                    badge.textContent =
                        CATEGORY_LABELS[v as LinkCategory];
                    badge.className = `law-restructurer-badge law-restructurer-badge-${v}`;
                }
            });
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
