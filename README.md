# Law Note Restructurer

> **An Obsidian plugin that turns messy legal notes into a structured, interlinked knowledge base — powered by Google Gemini AI.**
>
> **一个 Obsidian 插件，利用 Google Gemini AI 将凌乱的法学笔记转化为结构化、互相链接的知识库。**

---

## What It Does / 这个插件做什么

Drop in your raw legal notes (Markdown or Word docs), and the plugin automatically:

把你的原始法学笔记（Markdown 或 Word 文档）丢进来，插件会自动：

| | English | 中文 |
|---|---|---|
| 1 | **Extracts** concepts, cases, principles, and rules using AI | 用 AI **提取**概念、案例、原则和规则 |
| 2 | **Maps relationships** between cases and concepts | **映射**案例与概念之间的关系 |
| 3 | **Generates** interlinked pages, dashboards, outlines, and a relationship matrix | **生成**互相链接的页面、仪表盘、大纲和关系矩阵 |
| 4 | **Resolves** broken wikilinks by fetching from legal databases | 从法律数据库获取内容，**解析**未解析的链接 |

All pages are connected with `[[wikilinks]]` for seamless Obsidian navigation.

所有页面通过 `[[wikilinks]]` 互联，在 Obsidian 中无缝导航。

---

## Key Features / 核心功能

### Multi-course Support / 多课程支持

Organize notes by course — each gets its own folder with separate outlines, dashboards, and concept pages.

按课程组织笔记——每门课有独立的文件夹，包含各自的大纲、仪表盘和概念页。

### Incremental Updates / 增量更新

Process chapters 1–4 today, add chapter 5 later — no need to redo everything. The plugin saves state after each run and merges new content automatically.

今天处理第 1–4 章，以后再加第 5 章——无需全部重来。插件在每次运行后保存状态，自动合并新内容。

### Smart Deduplication / 智能去重

Automatically detects near-duplicate entities (e.g. "Aggregate Principle" vs "Aggregate Theory of Partnership Taxation") and lets you merge them with one click.

自动检测近似重复实体（如"Aggregate Principle"与"Aggregate Theory of Partnership Taxation"），一键合并。

### Cross-course Links / 跨课程链接

When the same concept (e.g. "Adjusted Basis") appears in multiple courses (PIT and Partnership Tax), the plugin automatically adds "See also" callouts linking to the other course's version. Both pages are updated — no manual linking needed.

当同一概念（如"Adjusted Basis"）出现在多个课程（PIT 和 Partnership Tax）时，插件会自动在页面底部添加"另见"提示框，链接到其他课程的对应页面。双向更新，无需手动操作。

### Link Resolver / 链接解析

Scans your vault for broken wikilinks, classifies them by type, and creates pages by fetching from free legal databases:

扫描仓库中的未解析链接，自动分类，并从免费法律数据库获取内容创建页面：

| Type / 类型 | Source / 数据源 |
|---|---|
| US Cases / 美国判例 | CourtListener API → Justia → stub page with search links |
| US Statutes / 美国法律 | Cornell LII |
| Chinese Laws / 中国法律 | 国家法律法规数据库 (flk.npc.gov.cn) |
| Chinese Cases / 中国案例 | Stub page with search links / 带搜索链接的兜底页 |

Links are auto-classified by pattern matching (e.g. `Marbury v. Madison` → US case, `IRC § 741` → US statute, `民法典` → Chinese law). You can review before fetching.

链接通过模式匹配自动分类（如 `Marbury v. Madison` → 美国案例，`IRC § 741` → 美国法律，`民法典` → 中国法律），获取前可人工审查。

---

## Getting Started / 快速开始

### Prerequisites / 前提条件

- Obsidian Desktop / Obsidian 桌面版
- A free [Google Gemini API key](https://aistudio.google.com/) / 免费的 [Gemini API 密钥](https://aistudio.google.com/)

### Install / 安装

```bash
# Clone into your vault's plugin folder
# 克隆到你的仓库插件目录
git clone <repo-url> /path/to/vault/.obsidian/plugins/law-note-restructurer

cd /path/to/vault/.obsidian/plugins/law-note-restructurer
npm install && npm run build
```

Then enable **Law Note Restructurer** in Obsidian → Settings → Community Plugins.

然后在 Obsidian → 设置 → 第三方插件 中启用 **Law Note Restructurer**。

### Configure / 配置

Open Settings → Law Note Restructurer:

打开 设置 → Law Note Restructurer：

| Setting / 设置项 | Description / 说明 | Default / 默认值 |
|---|---|---|
| Gemini API Key / API 密钥 | Your Google Gemini key / 你的 Gemini 密钥 | — |
| Model / 模型 | `gemini-2.5-pro` (best), `flash` (recommended), `flash-lite` (cheapest) | `gemini-2.5-flash` |
| Temperature / 温度 | Lower = more focused. 0.2–0.4 recommended / 越低越精确，建议 0.2–0.4 | 0.3 |
| Streaming / 流式输出 | Show real-time AI progress / 实时显示 AI 进度 | On |
| Output Folder / 输出文件夹 | Where to save generated files / 生成文件的保存位置 | `LawNotes/Generated` |
| Language / 语言 | Chinese, English, or Mixed / 中文、英文或混合 | Mixed |
| Concurrency / 并发数 | Parallel API calls (1–10) / 并行 API 请求数（1–10） | 5 |
| CourtListener Token | Optional, for US case lookups / 可选，用于美国判例查询 | — |

---

## Commands / 命令

Open the command palette (`Ctrl/Cmd + P`) and search:

打开命令面板（`Ctrl/Cmd + P`）搜索：

| Command / 命令 | What it does / 作用 |
|---|---|
| **Restructure Legal Notes** | Full pipeline: select files → pick course → extract entities → review & dedup → map relationships → generate output / 完整流程：选文件 → 选课程 → 提取实体 → 审查去重 → 映射关系 → 生成输出 |
| **Extract Legal Entities Only** | Only extract entities without generating pages / 仅提取实体，不生成页面 |
| **Resolve Unresolved Links** | Find broken wikilinks and create pages from legal databases / 查找未解析链接，从法律数据库创建页面 |

---

## How It Works / 工作流程

```
┌─────────────────────────────────────────────────────────┐
│  1. Pick Files           选择 .md / .docx 文件          │
│  2. Choose Course        选择或创建课程                  │
│     └─ Load State        若增量更新，加载已有状态         │
│  3. Extract Entities     AI 提取概念、案例、原则、规则    │
│     └─ Merge & Dedup     与已有数据合并 + 自动去重       │
│  4. Review               人工审查、编辑、合并重复项       │
│  5. Map Relationships    AI 构建案例-概念关系矩阵        │
│  6. Generate Output      生成所有页面和文件              │
│     └─ Save State        保存状态供下次使用              │
└─────────────────────────────────────────────────────────┘
```

---

## Output Structure / 输出结构

```
LawNotes/Generated/
├── Tax Law/                      ← course folder / 课程文件夹
│   ├── Concepts/                 ← concept pages / 概念页
│   ├── Cases/                    ← case briefs / 案例摘要
│   ├── Dashboards/               ← per-concept dashboards / 仪表盘
│   ├── Regulations/              ← regulation pages / 法规页
│   ├── Relationship Matrix.md    ← case × concept grid / 关系矩阵
│   ├── Outline.md                ← study outline / 学习大纲
│   └── _state.json               ← saved state for incremental updates
├── References/                   ← resolved link pages / 解析的链接页
│   ├── Marbury v. Madison.md
│   ├── IRC § 741.md
│   └── 民法典.md
└── ...
```

---

## Development / 开发

```bash
npm install        # install dependencies / 安装依赖
npm run dev        # watch mode (auto-rebuild) / 监听模式
npm run build      # production build / 生产构建
```

**Tech stack / 技术栈:** TypeScript, esbuild, [Obsidian Plugin API](https://docs.obsidian.md/), [@google/genai](https://www.npmjs.com/package/@google/genai), [zod](https://zod.dev/), [mammoth](https://www.npmjs.com/package/mammoth)

---

## License / 许可证

MIT
