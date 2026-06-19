# Law Note Restructurer

> **An Obsidian plugin that turns messy legal notes into a structured, interlinked knowledge base — powered by Google Gemini AI.**
>
> **一个 Obsidian 插件，利用 Google Gemini AI 将凌乱的法学笔记转化为结构化、互相链接的知识库。**

---

## What It Is / 这是什么

This is a **knowledge-base _generator_ for law students**, not a do-everything AI suite. It reads your raw notes and produces a clean, wikilinked vault of concepts, case briefs, rules, outlines, and study aids. For browsing, reviewing, and querying that vault, it is designed to **plug into the best existing Obsidian plugins** rather than reinvent them — see [Works Best With](#works-best-with--推荐搭配).

这是一个**面向法学学生的知识库_生成器_**，而不是大而全的 AI 套件。它读取你的原始笔记，生成一个整洁、互链的概念页 / 案例摘要 / 规则 / 大纲 / 学习辅助的笔记库。至于浏览、复习和查询，它特意设计为**对接 Obsidian 现有的成熟插件**，而非重复造轮子——见[推荐搭配](#works-best-with--推荐搭配)。

What it does on raw Markdown / Word notes / 它对原始 Markdown / Word 笔记做的事：

| | English | 中文 |
|---|---|---|
| 1 | **Extracts** concepts, cases, principles, and rules using AI | 用 AI **提取**概念、案例、原则和规则 |
| 2 | **Maps relationships** between cases and concepts | **映射**案例与概念之间的关系 |
| 3 | **Generates** interlinked pages, dashboards, outlines, a relationship matrix, evolution chains, synthesis tables, and flashcards | **生成**互链页面、仪表盘、大纲、关系矩阵、学说演进、案例综合表和闪卡 |
| 4 | **Resolves** broken wikilinks by fetching from legal databases | 从法律数据库获取内容，**解析**未解析的链接 |

---

## Why It's Law-Specific / 为什么是"法学专用"

General note/AI plugins don't understand legal material. This plugin's value is the law-aware layer no generic tool provides:

通用笔记/AI 插件不理解法律材料。本插件的价值在于通用工具不具备的"法律感知"能力：

- **Legal entity extraction** — concepts, cases (facts/holding/significance), rules (elements/exceptions/application steps), and principles, in an IRAC-friendly shape. / **法律实体提取**——概念、案例（事实/裁判/意义）、规则（要素/例外/适用步骤）、原则，符合 IRAC 结构。
- **Doctrinal evolution** — chronological "established → modified → distinguished → overruled" chains per doctrine, with a Mermaid diagram. / **学说演进**——每个学说按时间排序的"确立→修正→区分→推翻"链，附 Mermaid 图。
- **Case synthesis** — side-by-side facts/holding comparison tables for multi-case doctrines. / **案例综合**——多案例学说的事实/裁判对比表。
- **Citation normalization & link resolving** — canonicalizes `IRC § 741` / `Treas. Reg.` / `26 CFR` / `民法典 第三条`, then fetches text from CourtListener, Justia, Cornell LII, and flk.npc.gov.cn. / **引用归一化与链接解析**——统一 `IRC § 741`、`Treas. Reg.`、`26 CFR`、`民法典 第三条` 等格式，再从 CourtListener、Justia、Cornell LII、国家法律法规数据库抓取原文。
- **Bilingual & multi-jurisdiction** — US + China, Chinese/English/mixed output. / **双语 + 多法域**——美国 + 中国，中/英/混合输出。

---

## Works Best With / 推荐搭配

This plugin **generates** the vault; pair it with these mature, general-purpose plugins for everything downstream. (Don't expect — and don't wait for — this plugin to duplicate them.)

本插件负责**生成**笔记库；下游能力请搭配下列成熟通用插件，无需也不必让本插件重复实现。

| Need / 需求 | Recommended plugin / 推荐插件 | How this plugin feeds it / 如何对接 |
|---|---|---|
| Semantic search & AI chat over the whole vault / 全库语义搜索与 AI 对话 | [**Smart Connections**](https://github.com/brianpetro/obsidian-smart-connections) (local, no API key) or Copilot | Our wikilinked, tagged pages are ideal embedding targets. Our built-in **Ask My Notes** is a zero-config, citation-grounded alternative — if you already run Smart Connections, just use that. / 我们生成的互链页是理想的嵌入对象；内置的 **Ask My Notes** 是零配置、带引用的替代方案，已用 Smart Connections 可直接用它。 |
| Spaced-repetition review / 间隔重复复习 | [**Spaced Repetition**](https://github.com/st3v3nmw/obsidian-spaced-repetition) | We emit `Flashcards.md` in its inline `Q::A` format, tagged `#flashcard`. / 我们输出符合其行内 `Q::A` 格式、标记 `#flashcard` 的 `Flashcards.md`。 |
| Export cards to Anki / 导出到 Anki | [**Obsidian_to_Anki**](https://github.com/Pseudonium/Obsidian_to_Anki) — or our `Flashcards (Anki).txt` | Tab-separated front/back, ready to import. / Tab 分隔的正/背面，可直接导入。 |
| Dynamic tables & queries / 动态表格与查询 | [**Dataview**](https://github.com/blacksmithgu/obsidian-dataview) | Pages carry `tags:`/`date:` frontmatter (`law/concept`, `law/case`, …) so you can build your own live views. / 页面带 `tags:`/`date:` 元数据，可自建实时视图。 |
| Citation library & PDFs / 文献库与 PDF | [**Zotero**](https://www.zotero.org/) + the Citations plugin | Complements our Link Resolver, which fetches primary-source text. / 与我们抓取原文的链接解析互补。 |
| Relationship graph / 关系图谱 | Obsidian's native Graph, or Juggl / Excalibrain | Everything is `[[wikilinked]]`, so the graph works out of the box. / 全部 `[[wikilink]]` 互链，开箱即用。 |
| Install & auto-update this plugin / 安装与自动更新 | [**BRAT**](https://github.com/TfTHacker/obsidian42-brat) | See [Install](#install--安装). / 见安装。 |

---

## Status / 当前状态

Not yet in the Obsidian community store. Install via **BRAT** (recommended) or a manual build — see below. Desktop only (`isDesktopOnly: true`), because it makes network calls and reads local files.

尚未上架 Obsidian 社区插件商店。请用 **BRAT**（推荐）或手动构建安装（见下）。仅支持桌面端，因为需要联网请求和读取本地文件。

---

## Getting Started / 快速开始

### Prerequisites / 前提条件

- Obsidian Desktop / Obsidian 桌面版
- A free [Google Gemini API key](https://aistudio.google.com/) / 免费的 [Gemini API 密钥](https://aistudio.google.com/)

### Install / 安装

**Option A — BRAT (recommended, auto-updates) / 方式 A：BRAT（推荐，可自动更新）**

1. Install the **BRAT** community plugin and enable it. / 安装并启用 **BRAT** 插件。
2. Command palette → *BRAT: Add a beta plugin for testing* → enter `https://github.com/Yan-sudo/law-note-restructurer`. / 命令面板 → *BRAT: Add a beta plugin* → 输入仓库地址。
3. Enable **Law Note Restructurer** in Settings → Community Plugins. / 在 设置 → 第三方插件 启用本插件。

> BRAT needs a GitHub Release with `main.js`, `manifest.json`, `styles.css`. This repo ships a release workflow: push a tag matching `manifest.json` (`git tag 0.1.0 && git push --tags`) to publish one.
>
> BRAT 需要带 `main.js`、`manifest.json`、`styles.css` 的 GitHub Release。本仓库已内置发布工作流：推送与 `manifest.json` 版本一致的 tag 即可自动发布。

**Option B — Manual build / 方式 B：手动构建**

```bash
# Clone INTO your vault's plugins folder (note the two arguments)
# 克隆到你的仓库插件目录（注意是两个参数）
git clone https://github.com/Yan-sudo/law-note-restructurer.git \
  /path/to/vault/.obsidian/plugins/law-note-restructurer

cd /path/to/vault/.obsidian/plugins/law-note-restructurer
npm install && npm run build
```

Then enable **Law Note Restructurer** in Obsidian → Settings → Community Plugins (reload plugins if needed).

然后在 Obsidian → 设置 → 第三方插件 中启用 **Law Note Restructurer**（必要时刷新插件列表）。

### Configure / 配置

Open Settings → Law Note Restructurer:

打开 设置 → Law Note Restructurer：

| Setting / 设置项 | Description / 说明 | Default / 默认值 |
|---|---|---|
| Gemini API Key / API 密钥 | Your Google Gemini key / 你的 Gemini 密钥 | — |
| Model / 模型 | `gemini-2.5-pro` (best), `flash` (recommended), `flash-lite` (cheapest) | `gemini-2.5-flash` |
| Temperature / 温度 | Lower = more focused. 0.2–0.4 recommended / 越低越精确，建议 0.2–0.4 | 0.3 |
| Thinking Budget / 思考预算 | Gemini 2.5 reasoning effort. Model default recommended; Disabled is cheapest (Flash only) / 推理力度，默认即可，关闭最省（仅 Flash） | Model default |
| Streaming / 流式输出 | Show real-time AI progress / 实时显示 AI 进度 | On |
| Output Folder / 输出文件夹 | Where to save generated files / 生成文件的保存位置 | `LawNotes/Generated` |
| Language / 语言 | Chinese, English, or Mixed / 中文、英文或混合 | Mixed |
| Concurrency / 并发数 | Parallel API calls (1–10) / 并行 API 请求数（1–10） | 5 |
| Semantic Dedup / 语义去重 | Merge same-meaning concepts via embeddings (extra cost) / 用 embedding 合并同义概念（额外开销） | Off |
| Semantic Related Links / 语义相关链接 | Append "Related Concepts" to concept pages via embeddings / 给概念页加"语义相关"链接 | Off |
| Generate Flashcards / 生成闪卡 | Spaced Repetition + Anki export from rules/holdings / 从规则与判决生成闪卡与 Anki 导出 | On |
| CourtListener Token | Optional, for US case lookups / 可选，用于美国判例查询 | — |

---

## Commands / 命令

Open the command palette (`Ctrl/Cmd + P`) and search:

打开命令面板（`Ctrl/Cmd + P`）搜索：

| Command / 命令 | What it does / 作用 |
|---|---|
| **Restructure Legal Notes** | Full pipeline: select files → pick course → extract entities → review & dedup → map relationships → generate output / 完整流程 |
| **Extract Legal Entities Only** | Only extract entities without generating pages / 仅提取实体 |
| **Resolve Unresolved Links** | Find broken wikilinks and create pages from legal databases / 解析未解析链接 |
| **Ask My Notes** | Ask a question; get an answer grounded only in your notes, with `[[source]]` links / 基于笔记的问答，附来源链接 |
| **Rebuild Notes Index** | Re-embed all notes for "Ask My Notes" (run after big changes) / 重建问答索引 |

> *Ask My Notes* and *Semantic Related Links* are lightweight, zero-config built-ins. If you want a more powerful, fully local semantic experience, use [Smart Connections](https://github.com/brianpetro/obsidian-smart-connections) on the generated vault instead.
>
> *Ask My Notes* 与 *语义相关链接* 是轻量、零配置的内置功能。若想要更强大且完全本地的语义体验，可在生成的笔记库上改用 [Smart Connections](https://github.com/brianpetro/obsidian-smart-connections)。

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
│   ├── Doctrinal Evolution.md    ← how doctrines evolved (chrono + Mermaid) / 学说演进
│   ├── Case Synthesis.md         ← multi-case comparison tables / 案例综合表
│   ├── Flashcards.md             ← Spaced Repetition cards / 闪卡
│   ├── Flashcards (Anki).txt     ← Anki import file / Anki 导入文件
│   ├── Outline.md                ← study outline / 学习大纲
│   ├── _state.json               ← saved state for incremental updates
│   └── .rag-index.json           ← local embedding index for Ask My Notes
├── References/                   ← resolved link pages / 解析的链接页
│   ├── Marbury v. Madison.md
│   ├── IRC § 741.md
│   └── 民法典.md
└── ...
```

---

## Privacy & Security / 隐私与安全

Please read this before processing sensitive material.

处理敏感材料前请先阅读本节。

- **Your notes are sent to Google.** Extraction, relationship mapping, semantic dedup/links, and Ask My Notes send the selected note text to the Google Gemini API. Do **not** process privileged or confidential client material unless your engagement permits sending it to a third-party AI service. (For a fully local option, run [Smart Connections](https://github.com/brianpetro/obsidian-smart-connections) with a local model on the generated notes.)

  **你的笔记会发送给 Google。** 实体提取、关系映射、语义去重/相关链接、问答都会把所选文本发送到 Gemini API。除非授权允许，请**不要**处理受特权保护或保密的材料。（需要完全本地方案，可对生成的笔记使用本地模型版的 Smart Connections。）

- **API key storage.** Your Gemini and CourtListener keys are stored locally and unencrypted in the plugin's `data.json` (standard Obsidian plugin data API). It is git-ignored here, but avoid syncing your vault to untrusted locations.

  **API 密钥存储。** 密钥以**明文**保存在插件 `data.json`（Obsidian 标准做法），本仓库已 git-ignore，但请避免把仓库同步到不受信任的位置。

- **Link Resolver & external requests.** "Resolve Unresolved Links" sends link text to CourtListener, Justia, Cornell LII, and flk.npc.gov.cn.

  **链接解析与外部请求。** “解析未解析链接”会把链接文本发送给上述公开法律数据库。

- **Reducing exposure.** Disable Semantic Dedup/Links, set Thinking Budget to *Disabled*, and prefer Flash models. A fully local LLM provider is on the roadmap (the plugin already talks to an `LLMClient` abstraction, not Gemini directly).

  **降低暴露。** 关闭语义功能、思考预算设为*关闭*、优先用 Flash 模型。完全本地 LLM 已在规划中（插件已通过 `LLMClient` 抽象层）。

---

## Development / 开发

```bash
npm install        # install dependencies / 安装依赖
npm run dev        # watch mode (auto-rebuild) / 监听模式
npm run build      # production build / 生产构建
npm test           # unit tests (Vitest) / 单元测试
npm run typecheck  # type-check only / 仅类型检查
npm run lint       # ESLint / 代码检查
npm run format     # Prettier / 代码格式化
```

CI (GitHub Actions) runs typecheck + tests + build on every push; tag a version to cut a BRAT-installable release.

CI（GitHub Actions）在每次推送时运行类型检查 + 测试 + 构建；打 tag 即可发布可用 BRAT 安装的版本。

**Tech stack / 技术栈:** TypeScript, esbuild, [Obsidian Plugin API](https://docs.obsidian.md/), [@google/genai](https://www.npmjs.com/package/@google/genai), [zod](https://zod.dev/), [mammoth](https://www.npmjs.com/package/mammoth), [Vitest](https://vitest.dev/)

---

## License / 许可证

MIT
