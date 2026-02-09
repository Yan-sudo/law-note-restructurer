# Law Note Restructurer

An Obsidian plugin that uses Google Gemini AI to restructure legal study notes into interconnected concept pages, case briefs, relationship matrices, dashboards, and outlines.

一个 Obsidian 插件，使用 Google Gemini AI 将法学笔记重构为互相链接的概念页、案例摘要、关系矩阵、仪表盘和大纲。

---

## Features / 功能

### AI-Powered Note Restructuring / AI 笔记重构

Feed in your raw legal notes (Markdown or DOCX) and the plugin will:

导入原始法学笔记（Markdown 或 DOCX），插件将自动：

1. **Extract Legal Entities / 提取法律实体** — concepts, cases, principles, and rules identified by Gemini AI / 由 Gemini AI 识别概念、案例、原则和规则
2. **Map Relationships / 映射关系** — how cases relate to concepts (establishes, applies, modifies, distinguishes, overrules, illustrates) / 案例与概念的关联（确立、适用、修改、区分、推翻、阐释）
3. **Generate Structured Pages / 生成结构化页面** — individual pages for each concept and case, plus: / 为每个概念和案例创建独立页面，附加：
   - Relationship Matrix / 关系矩阵（案例-概念网格）
   - Study Outline / 学习大纲
   - Per-concept Dashboards / 各概念仪表盘

All generated pages are interlinked with `[[wikilinks]]` for seamless navigation.

所有页面通过 `[[wikilinks]]` 互相链接，方便导航。

### Multi-course Organization / 多课程组织

Each course gets its own folder with independent outlines, dashboards, and concept pages. If no course name is provided, files go directly into the output folder (backward compatible).

每门课程拥有独立的文件夹，包含各自的大纲、仪表盘和概念页面。不输入课程名则直接输出到默认文件夹（向后兼容）。

### Incremental Updates / 增量更新

Process chapters 1–4 first, then later add chapter 5 without re-processing everything. The plugin saves pipeline state (`_state.json`) after each run and merges new entities with existing ones on subsequent runs.

先处理第 1–4 章，之后再添加第 5 章，无需重新处理。插件在每次运行后保存状态（`_state.json`），后续运行时自动合并新旧实体。

### Concept Deduplication / 概念去重

Near-duplicate entities (e.g. "Aggregate Principle" vs "Aggregate Theory of Partnership Taxation") are detected automatically. The entity review modal highlights duplicates and provides a merge button.

自动检测近似重复实体（如 "Aggregate Principle" 与 "Aggregate Theory of Partnership Taxation"）。审查窗口高亮显示重复项并提供合并按钮。

### Resolve Unresolved Links / 解析未解析链接

Generated pages often reference legal authorities that don't have their own pages yet. The **Resolve Unresolved Links** command scans your vault for broken wikilinks and creates pages by fetching from free legal databases.

生成的页面常引用尚无独立页面的法律文献。**解析未解析链接** 命令扫描仓库中的未解析 wikilinks，从免费法律数据库获取内容并创建页面。

| Link Type / 链接类型 | Source / 数据源 | Auth / 认证 |
|---|---|---|
| US Cases / 美国判例 | [CourtListener](https://www.courtlistener.com/) API → [Justia](https://www.justia.com/) → stub page / 兜底页 | Optional free token / 可选免费令牌 |
| US Statutes / 美国法律 | [Cornell LII](https://www.law.cornell.edu/) | None / 无 |
| Chinese Laws / 中国法律 | [国家法律法规数据库](https://flk.npc.gov.cn/) | None / 无 |
| Chinese Cases / 中国案例 | Stub page with search links / 带搜索链接的兜底页 | N/A |

The plugin auto-classifies links by pattern matching (e.g. `Marbury v. Madison` → US case, `IRC § 741` → US statute, `民法典` → Chinese law) and lets you review before fetching. When auto-fetch fails for US cases, a stub page with search links (Google Scholar, CourtListener, Justia, Casetext) is created instead.

插件通过模式匹配自动分类链接（如 `Marbury v. Madison` → 美国案例，`IRC § 741` → 美国法律，`民法典` → 中国法律），获取前可审查。美国案例自动获取失败时会创建带搜索链接（Google Scholar、CourtListener、Justia、Casetext）的兜底页。

---

## Commands / 命令

| Command / 命令 | Description / 说明 |
|---|---|
| **Restructure Legal Notes** | Full pipeline: select files → choose course → extract → review & dedup → map relationships → generate / 完整管道：选择文件 → 选课程 → 提取 → 审查去重 → 映射关系 → 生成 |
| **Extract Legal Entities Only** | Entity extraction only (steps 1–2) / 仅提取实体（步骤 1–2） |
| **Resolve Unresolved Links** | Scan broken wikilinks, create pages from legal databases / 扫描未解析链接，从法律数据库创建页面 |

---

## Setup / 安装配置

### Requirements / 前提条件

- Obsidian Desktop (not mobile) / Obsidian 桌面版（不支持移动端）
- Google Gemini API key from [aistudio.google.com](https://aistudio.google.com/) / 从 [aistudio.google.com](https://aistudio.google.com/) 获取 Gemini API 密钥

### Installation / 安装

1. Clone or copy this repo into `.obsidian/plugins/law-note-restructurer/` / 将仓库克隆到 `.obsidian/plugins/law-note-restructurer/`
2. `npm install && npm run build`
3. Enable in Obsidian Settings → Community Plugins / 在设置 → 社区插件中启用

### Configuration / 配置

In Settings → Law Note Restructurer: / 在设置 → Law Note Restructurer 中：

**AI Configuration / AI 配置**
- **Gemini API Key** — your API key / API 密钥
- **Model / 模型** — Gemini 2.5 Pro (best / 最佳), Flash (recommended / 推荐), Flash Lite (cheapest / 最便宜)
- **Temperature / 温度** — 0.2–0.4 recommended / 建议 0.2–0.4
- **Streaming / 流式输出** — real-time progress / 实时显示进度

**Output Configuration / 输出配置**
- **Output Folder / 输出文件夹** — default: `LawNotes/Generated` / 默认：`LawNotes/Generated`
- **Language / 语言** — 中文, English, or Mixed / 中文、英文或混合
- **Source Footnotes / 来源脚注** — annotate sections with source file / 标注来源文件
- **Append to Existing / 追加模式** — fuzzy-match and append instead of overwrite / 模糊匹配并追加而非覆盖

**Link Resolver / 链接解析器**
- **CourtListener API Token** — optional, for US cases ([free signup](https://www.courtlistener.com/)) / 可选，用于美国判例（[免费注册](https://www.courtlistener.com/)）
- **Resolved Links Folder / 解析链接文件夹** — default: `{output folder}/References` / 默认：`{输出文件夹}/References`
- **Scan Scope / 扫描范围** — output folder only or entire vault / 仅输出文件夹或整个仓库
- **Request Delay / 请求延迟** — rate limiting (default: 1500ms) / 请求间隔（默认：1500ms）

---

## Pipeline Flow / 管道流程

```
1. Select Files        选择文件      Pick .md / .docx files to process
2. Select Course       选择课程      Choose or create a course folder
   └─ Load State       加载状态      If incremental, load _state.json
3. Extract Entities    提取实体      Gemini AI identifies concepts, cases, etc.
   └─ Merge & Dedup    合并去重      Merge with existing + auto-deduplicate
4. Review Entities     审查实体      Review, edit, merge duplicates manually
5. Map Relationships   映射关系      Gemini AI builds case-concept matrix
6. Generate Output     生成输出      Create pages, outline, dashboards
   └─ Save State       保存状态      Persist _state.json for next run
```

---

## Generated File Structure / 生成文件结构

```
LawNotes/Generated/
├── Tax Law/                          ← course folder / 课程文件夹
│   ├── Concepts/                     ← concept pages / 概念页
│   │   ├── Consideration.md
│   │   └── ...
│   ├── Cases/                        ← case briefs / 案例摘要
│   │   ├── Hadley v. Baxendale.md
│   │   └── ...
│   ├── Dashboards/                   ← per-concept dashboards / 仪表盘
│   │   └── ...
│   ├── Regulations/                  ← regulation pages / 法规页
│   │   └── ...
│   ├── Relationship Matrix.md        ← case-concept grid / 关系矩阵
│   ├── Outline.md                    ← study outline / 学习大纲
│   └── _state.json                   ← pipeline state / 管道状态
├── References/                       ← resolved link pages / 解析的链接页
│   ├── Marbury v. Madison.md
│   ├── IRC § 741.md
│   ├── 民法典.md
│   └── ...
└── ...
```

---

## Development / 开发

```bash
npm install        # Install dependencies / 安装依赖
npm run dev        # Watch mode / 监听模式
npm run build      # Production build / 生产构建
```

### Tech Stack / 技术栈

- TypeScript + esbuild
- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [@google/genai](https://www.npmjs.com/package/@google/genai) — Gemini AI client / Gemini AI 客户端
- [zod](https://zod.dev/) — structured output validation / 结构化输出校验
- [mammoth](https://www.npmjs.com/package/mammoth) — DOCX parsing / DOCX 解析

---

## License / 许可证

MIT
