import { App, Modal, TFile } from "obsidian";

interface FolderNode {
    name: string;
    path: string;
    children: FolderNode[];
    files: TFile[];
}

export class FilePickerModal extends Modal {
    private files: TFile[];
    private selected: Set<string> = new Set();
    private onConfirm: (files: TFile[]) => void;
    private onCancel: () => void;
    private collapsedFolders: Set<string> = new Set();
    private treeContainer!: HTMLElement;
    private summaryText!: HTMLElement;
    private filterValue = "";

    constructor(
        app: App,
        onConfirm: (files: TFile[]) => void,
        onCancel: () => void
    ) {
        super(app);
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;

        this.files = app.vault
            .getFiles()
            .filter((f) => f.extension === "md" || f.extension === "docx")
            .sort((a, b) => a.path.localeCompare(b.path));
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("law-restructurer-file-picker");

        contentEl.createEl("h2", { text: "Select Source Files" });
        contentEl.createEl("p", {
            text: "Choose .md and .docx files to analyze. (选择要分析的文件)",
            cls: "setting-item-description",
        });

        // Filter
        const filterDiv = contentEl.createDiv("law-restructurer-filter");
        const filterInput = filterDiv.createEl("input", {
            type: "text",
            placeholder: "Filter files...",
        });
        filterInput.addClass("law-restructurer-filter-input");

        // Bulk actions
        const bulkDiv = contentEl.createDiv("law-restructurer-bulk-actions");

        const selectAllBtn = bulkDiv.createEl("button", { text: "Select All" });
        selectAllBtn.addEventListener("click", () => {
            this.files.forEach((f) => this.selected.add(f.path));
            this.renderTree();
        });

        const selectNoneBtn = bulkDiv.createEl("button", { text: "Select None" });
        selectNoneBtn.addEventListener("click", () => {
            this.selected.clear();
            this.renderTree();
        });

        const expandAllBtn = bulkDiv.createEl("button", { text: "Expand All" });
        expandAllBtn.addEventListener("click", () => {
            this.collapsedFolders.clear();
            this.renderTree();
        });

        const collapseAllBtn = bulkDiv.createEl("button", { text: "Collapse All" });
        collapseAllBtn.addEventListener("click", () => {
            const tree = this.buildTree();
            this.collapseAllFolders(tree);
            this.renderTree();
        });

        // Tree container
        this.treeContainer = contentEl.createDiv("law-restructurer-file-list");

        filterInput.addEventListener("input", () => {
            this.filterValue = filterInput.value;
            this.renderTree();
        });

        // Summary
        const summaryDiv = contentEl.createDiv("law-restructurer-summary");
        this.summaryText = summaryDiv.createEl("p", { text: "" });

        // Buttons
        const buttonDiv = contentEl.createDiv("law-restructurer-buttons");

        const cancelBtn = buttonDiv.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => {
            this.close();
            this.onCancel();
        });

        const confirmBtn = buttonDiv.createEl("button", {
            text: "Confirm & Continue",
            cls: "mod-cta",
        });
        confirmBtn.addEventListener("click", () => {
            const selectedFiles = this.files.filter((f) =>
                this.selected.has(f.path)
            );
            if (selectedFiles.length === 0) return;
            this.close();
            this.onConfirm(selectedFiles);
        });

        this.renderTree();
    }

    private buildTree(): FolderNode[] {
        const lowerFilter = this.filterValue.toLowerCase();

        // Filter files first
        const filteredFiles = lowerFilter
            ? this.files.filter((f) =>
                  f.path.toLowerCase().includes(lowerFilter)
              )
            : this.files;

        // Group by folder path
        const folderMap = new Map<string, TFile[]>();
        for (const file of filteredFiles) {
            const folder = file.parent?.path ?? "/";
            if (!folderMap.has(folder)) {
                folderMap.set(folder, []);
            }
            folderMap.get(folder)!.push(file);
        }

        // Build nested tree
        const rootNodes: FolderNode[] = [];
        const nodeMap = new Map<string, FolderNode>();

        // Sort folder paths so parents come before children
        const sortedFolders = Array.from(folderMap.keys()).sort();

        for (const folderPath of sortedFolders) {
            const files = folderMap.get(folderPath)!;
            const node = this.getOrCreateNode(folderPath, nodeMap, rootNodes);
            node.files = files;
        }

        return rootNodes;
    }

    private getOrCreateNode(
        path: string,
        nodeMap: Map<string, FolderNode>,
        rootNodes: FolderNode[]
    ): FolderNode {
        if (nodeMap.has(path)) return nodeMap.get(path)!;

        const parts = path.split("/");
        const name = parts[parts.length - 1] || "/";

        const node: FolderNode = {
            name,
            path,
            children: [],
            files: [],
        };
        nodeMap.set(path, node);

        if (parts.length <= 1 || path === "/") {
            // Root-level folder
            rootNodes.push(node);
        } else {
            // Find or create parent
            const parentPath = parts.slice(0, -1).join("/");
            const parent = this.getOrCreateNode(parentPath, nodeMap, rootNodes);
            parent.children.push(node);
        }

        return node;
    }

    private collapseAllFolders(nodes: FolderNode[]): void {
        for (const node of nodes) {
            if (node.children.length > 0 || node.files.length > 0) {
                this.collapsedFolders.add(node.path);
            }
            this.collapseAllFolders(node.children);
        }
    }

    private getAllFilesUnder(node: FolderNode): TFile[] {
        const result: TFile[] = [...node.files];
        for (const child of node.children) {
            result.push(...this.getAllFilesUnder(child));
        }
        return result;
    }

    private getFolderCheckState(
        node: FolderNode
    ): "none" | "some" | "all" {
        const allFiles = this.getAllFilesUnder(node);
        if (allFiles.length === 0) return "none";

        const selectedCount = allFiles.filter((f) =>
            this.selected.has(f.path)
        ).length;

        if (selectedCount === 0) return "none";
        if (selectedCount === allFiles.length) return "all";
        return "some";
    }

    private renderTree(): void {
        this.treeContainer.empty();
        const tree = this.buildTree();

        if (tree.length === 0) {
            this.treeContainer.createEl("p", {
                text: "No files match filter.",
                cls: "law-restructurer-tree-empty",
            });
        } else {
            for (const node of tree) {
                this.renderNode(this.treeContainer, node, 0);
            }
        }

        this.updateSummary();
    }

    private renderNode(
        container: HTMLElement,
        node: FolderNode,
        depth: number
    ): void {
        const hasContent = node.files.length > 0 || node.children.length > 0;
        if (!hasContent) return;

        const isCollapsed = this.collapsedFolders.has(node.path);

        // Folder row
        const folderRow = container.createDiv("law-restructurer-tree-folder");
        folderRow.style.paddingLeft = `${depth * 20}px`;

        // Expand/collapse toggle
        const toggle = folderRow.createEl("span", {
            cls: `law-restructurer-tree-toggle ${isCollapsed ? "is-collapsed" : ""}`,
        });
        toggle.setText(isCollapsed ? "\u25B6" : "\u25BC");
        toggle.addEventListener("click", (e) => {
            e.stopPropagation();
            if (isCollapsed) {
                this.collapsedFolders.delete(node.path);
            } else {
                this.collapsedFolders.add(node.path);
            }
            this.renderTree();
        });

        // Folder checkbox
        const checkbox = folderRow.createEl("input", { type: "checkbox" });
        checkbox.addClass("law-restructurer-tree-checkbox");
        const checkState = this.getFolderCheckState(node);
        checkbox.checked = checkState === "all";
        checkbox.indeterminate = checkState === "some";
        checkbox.addEventListener("change", () => {
            const allFiles = this.getAllFilesUnder(node);
            if (checkbox.checked) {
                allFiles.forEach((f) => this.selected.add(f.path));
            } else {
                allFiles.forEach((f) => this.selected.delete(f.path));
            }
            this.renderTree();
        });

        // Folder icon + name
        folderRow.createEl("span", {
            text: "\uD83D\uDCC1",
            cls: "law-restructurer-tree-icon",
        });
        const nameEl = folderRow.createEl("span", {
            text: node.name,
            cls: "law-restructurer-tree-folder-name",
        });

        // File count badge
        const totalFiles = this.getAllFilesUnder(node).length;
        const selectedFiles = this.getAllFilesUnder(node).filter((f) =>
            this.selected.has(f.path)
        ).length;
        folderRow.createEl("span", {
            text: selectedFiles > 0
                ? `${selectedFiles}/${totalFiles}`
                : `${totalFiles}`,
            cls: "law-restructurer-tree-count",
        });

        // Click folder row to toggle
        nameEl.addEventListener("click", () => {
            if (isCollapsed) {
                this.collapsedFolders.delete(node.path);
            } else {
                this.collapsedFolders.add(node.path);
            }
            this.renderTree();
        });

        // Children (if expanded)
        if (!isCollapsed) {
            // Sub-folders first
            for (const child of node.children) {
                this.renderNode(container, child, depth + 1);
            }

            // Then files
            for (const file of node.files) {
                this.renderFileRow(container, file, depth + 1);
            }
        }
    }

    private renderFileRow(
        container: HTMLElement,
        file: TFile,
        depth: number
    ): void {
        const row = container.createDiv("law-restructurer-tree-file");
        row.style.paddingLeft = `${depth * 20 + 18}px`;

        const checkbox = row.createEl("input", { type: "checkbox" });
        checkbox.checked = this.selected.has(file.path);
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                this.selected.add(file.path);
            } else {
                this.selected.delete(file.path);
            }
            this.renderTree();
        });

        row.createEl("span", {
            text: file.name,
            cls: "law-restructurer-file-label",
        });

        row.createEl("span", {
            text: file.extension.toUpperCase(),
            cls: `law-restructurer-badge law-restructurer-badge-${file.extension}`,
        });
    }

    private updateSummary(): void {
        const count = this.selected.size;
        this.summaryText.setText(
            `${count} file(s) selected (已选 ${count} 个文件)`
        );
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
