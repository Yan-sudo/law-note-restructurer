# Law Note Restructurer（法学笔记重构器）

> **一个 Obsidian 插件，利用 Google Gemini AI 将凌乱的法学笔记转化为结构化、互相链接的知识库。**

[English](README.md) · **中文**

---

## 这是什么

这是一个**面向法学学生的知识库_生成器_**，而不是大而全的 AI 套件。它读取你的原始笔记，生成一个整洁、互链的概念页 / 案例摘要 / 规则 / 大纲 / 学习辅助的笔记库。至于浏览、复习和查询，它特意设计为**对接 Obsidian 现有的成熟插件**，而非重复造轮子——见[推荐搭配](#推荐搭配)。

它对原始 Markdown / Word 笔记做的事：

1. 用 AI **提取**概念、案例、原则和规则。
2. **映射**案例与概念之间的关系。
3. **生成**互链页面、仪表盘、大纲、关系矩阵、学说演进、案例综合表和闪卡。
4. 从法律数据库获取内容，**解析**未解析的链接。

---

## 为什么是"法学专用"

通用笔记/AI 插件不理解法律材料。本插件的价值在于通用工具不具备的"法律感知"能力：

- **法律实体提取**——概念、案例（事实/裁判/意义）、规则（要素/例外/适用步骤）、原则，符合 IRAC 结构。
- **学说演进**——每个学说按时间排序的"确立→修正→区分→推翻"链，附 Mermaid 图。
- **案例综合**——多案例学说的事实/裁判对比表。
- **引用归一化与链接解析**——统一 `IRC § 741`、`Treas. Reg.`、`26 CFR`、`民法典 第三条` 等格式，再从 CourtListener、Justia、Cornell LII、国家法律法规数据库抓取原文。
- **双语 + 多法域**——美国 + 中国，中/英/混合输出。
- **随你成长**——随时加新笔记，增量合并；你的 `%% lnr:notes %%` **My Notes** 区永不被覆盖；每次更新生成 **`What's New`** 变更图（新增=绿、更新=橙）。

---

## 推荐搭配

本插件负责**生成**笔记库；下游能力请搭配下列成熟通用插件，无需也不必让本插件重复实现。

| 需求 | 推荐插件 | 如何对接 |
|---|---|---|
| 全库语义搜索与 AI 对话 | [**Smart Connections**](https://github.com/brianpetro/obsidian-smart-connections)（本地、无需 API key）或 Copilot | 我们生成的互链页是理想的嵌入对象；内置的 **Ask My Notes** 是零配置、带引用的替代方案，已用 Smart Connections 可直接用它。 |
| 间隔重复复习 | [**Spaced Repetition**](https://github.com/st3v3nmw/obsidian-spaced-repetition) | 我们输出符合其行内 `Q::A` 格式、标记 `#flashcard` 的 `Flashcards.md`。 |
| 导出到 Anki | [**Obsidian_to_Anki**](https://github.com/Pseudonium/Obsidian_to_Anki)——或我们的 `Flashcards (Anki).txt` | Tab 分隔的正/背面，可直接导入。 |
| 动态表格与查询 | [**Dataview**](https://github.com/blacksmithgu/obsidian-dataview) | 页面带 `tags:`/`date:` 元数据（`law/concept`、`law/case` 等），可自建实时视图。 |
| 文献库与 PDF | [**Zotero**](https://www.zotero.org/) + Citations 插件 | 与我们抓取原文的链接解析互补。 |
| 关系图谱 | Obsidian 原生 Graph，或 Juggl / Excalibrain | 全部 `[[wikilink]]` 互链，开箱即用。 |
| 安装与自动更新本插件 | [**BRAT**](https://github.com/TfTHacker/obsidian42-brat) | 见[安装](#安装)。 |

---

## 当前状态

尚未上架 Obsidian 社区插件商店。请用 **BRAT**（推荐）或手动构建安装（见下）。仅支持桌面端（`isDesktopOnly: true`），因为需要联网请求和读取本地文件。

---

## 快速开始

### 前提条件

- Obsidian 桌面版
- 免费的 [Google Gemini API 密钥](https://aistudio.google.com/)

### 安装

**方式 A — BRAT（推荐，可自动更新）**

1. 安装并启用 **BRAT** 插件。
2. 命令面板 → *BRAT: Add a beta plugin for testing* → 输入 `https://github.com/Yan-sudo/law-note-restructurer`。
3. 在 设置 → 第三方插件 启用 **Law Note Restructurer**。

> BRAT 需要带 `main.js`、`manifest.json`、`styles.css` 的 GitHub Release。本仓库已内置发布工作流：推送与 `manifest.json` 版本一致的 tag（`git tag 0.1.0 && git push --tags`）即可自动发布。

**方式 B — 手动构建**

```bash
# 克隆到你的仓库插件目录（注意是两个参数）
git clone https://github.com/Yan-sudo/law-note-restructurer.git \
  /path/to/vault/.obsidian/plugins/law-note-restructurer

cd /path/to/vault/.obsidian/plugins/law-note-restructurer
npm install && npm run build
```

然后在 Obsidian → 设置 → 第三方插件 中启用 **Law Note Restructurer**（必要时刷新插件列表）。

### 配置

打开 设置 → Law Note Restructurer：

| 设置项 | 说明 | 默认值 |
|---|---|---|
| Gemini API 密钥 | 你的 Google Gemini 密钥（完全本地时无需填写） | — |
| 生成来源 | `Gemini` 云端，或 **`Ollama` 本地（离线、免费、无需密钥）** | `Gemini` |
| 模型 | Gemini 模型，或要拉取的 Ollama 模型 | `gemini-2.5-flash` · `llama3.1` |
| 嵌入来源 | `Gemini` 云端，或 **`Ollama` 本地（离线、免费、不限额、隐私）** | `Gemini` |
| 嵌入模型 | Gemini 模型，或要拉取的 Ollama 模型 | `gemini-embedding-001` · `nomic-embed-text` |
| 温度 | 越低越精确，建议 0.2–0.4 | 0.3 |
| 思考预算 | Gemini 2.5 推理力度。默认即可；关闭最省（仅 Flash） | 模型默认 |
| 流式输出 | 实时显示 AI 进度 | 开 |
| 输出文件夹 | 生成文件的保存位置 | `LawNotes/Generated` |
| 语言 | 中文、英文或混合 | 混合 |
| 并发数 | 并行 API 请求数（1–10） | 5 |
| 自动确认审阅 | 跳过实体/关系审阅弹窗，直接生成（无人值守） | 关 |
| 累计用量 | 费用计 — 累计 token 与粗略美元估算，可重置 | — |
| 回答长度 | 问答默认详略：简短 / 标准 / 详尽 | 标准 |
| 自动更新数据库 | 后台按 15分/1时/6时/1天 增量更新指定课程 | 关 |
| 语义去重 | 用 embedding 合并同义概念（额外开销） | 关 |
| 语义相关链接 | 给概念页加"语义相关"链接 | 关 |
| 生成闪卡 | 从规则与判决生成闪卡与 Anki 导出 | 开 |
| CourtListener 令牌 | 可选，用于美国判例查询 | — |

### 用 Ollama 做本地嵌入（可选，隐私推荐）

让所有嵌入（语义去重、相关链接、Ask My Notes 检索）都在你自己机器上跑——离线、免费、不限额、数据不出本机：

1. 安装 [Ollama](https://ollama.com) 并确保它在运行。
2. 拉取嵌入模型：`ollama pull nomic-embed-text`。
3. 在 **设置 → Embedding Provider** 选 **Ollama (local)**。
4. 点 **Test connection（测试连接）**——应显示 `✓ Ollama OK — N-dimensional embeddings`。

如果测试报 **403 / CORS** 错误，需允许 Obsidian 访问 Ollama 并重启：

```bash
# macOS
launchctl setenv OLLAMA_ORIGINS "*"
# Linux / Windows：启动 Ollama 前设置环境变量 OLLAMA_ORIGINS=*（或 app://obsidian.md）
```

### 完全本地、无需密钥（Ollama 生成）

你可以把**所有步骤**都放到本机跑——抽取、重构、大纲、Ask My Notes 回答——无需 Gemini 密钥、不限额：

1. 安装 [Ollama](https://ollama.com) 并拉取一个够强的模型：`ollama pull llama3.1`（或更强的 `qwen2.5:14b`）。
2. 在 **设置 → 生成来源** 选 **Ollama (local)**，并填写模型名。
3. 把 **嵌入来源** 也设为 **Ollama**（见上文），这样没有任何一步会联网。

> 本地生成的质量取决于你拉取的模型——模型越大笔记越好但越慢。若追求大文档的最佳质量，建议生成仍用 Gemini，仅把**嵌入**放到本地。

---

## 快速上手

点左侧 **⚖️ Law Notes** 功能区图标打开控制台。它按**数据库优先**的流程编排：**① 数据库 → ② 保持更新 → ③ 学习与工具**（先建好数据库，更新/学习功能才解锁）。

1. **① 构建数据库** → 选课堂笔记（`.md`/`.docx`）并命名课程，插件构建整个知识库。
2. **阅读 + 批注**生成的页面；写在 **📝 My Notes** 区里的内容永久保留。
3. **② 立即更新**（或在设置里开 **自动更新**）→ 自动只处理新增/改动并生成 **`What's New`** 变更图。
4. **③ Ask my notes** → 问答，或切换模式：**IRAC**、**练习**、**苏格拉底**、**中美对照**；可选回答长度（简短/标准/详尽）。**构建大纲**可选详略、标题层级、目录章节数，再拖拽调整目录。

> ⏳ **长任务不再卡住你：** 每个长任务（构建、更新、大纲、索引）都会在**状态栏显示百分比**并在侧边栏放一张**可最小化的进度卡**——点 **最小化** 即可继续干别的。

> 🔒 **隐私提示：** 把 **Embedding Provider 设为 Ollama** 即可离线、不限额、数据不出本机。

---

## 命令

**不用记命令** —— 点左侧 **⚖️ Law Notes** 功能区图标，打开图形控制台，每个功能一个按钮。也可用命令面板（`Ctrl/Cmd + P`）：

| 命令 | 作用 |
|---|---|
| **Restructure Legal Notes** | 完整流程：选文件 → 选课程 → 提取实体 → 审查去重 → 映射关系 → 生成输出 |
| **Extract Legal Entities Only** | 仅提取实体，不生成页面 |
| **Update Knowledge Base** | 一键增量：按 mtime 自动检测新增/改动的课堂笔记，只处理这些并合并、重生成受影响页、刷新变更图，无需选文件 |
| **Build Outline** | 选**详细程度**（精简/标准/详尽）+ **结构方式**（按授课顺序 / 按主题 / **案件生命历程** / 自定义）→ AI 先出目录（TOC）→ **拖拽/编辑**调整顺序 → 再按此顺序生成完整大纲 |
| **Resolve Unresolved Links** | 查找未解析链接，从法律数据库创建页面 |
| **Ask My Notes** | 右侧常驻聊天面板，含**模式**：问答 · **IRAC 分析**（粘案情）· **练习**（出题+范例答案）· **苏格拉底**（反过来考你）· **中美对照**。另有文件夹范围、多轮历史、增量索引、来源链接 |
| **Rebuild Notes Index** | 强制从头重建索引（一般用不到） |

> *Ask My Notes* 与 *语义相关链接* 是轻量、零配置的内置功能。若想要更强大且完全本地的语义体验，可在生成的笔记库上改用 [Smart Connections](https://github.com/brianpetro/obsidian-smart-connections)。

---

## 工作流程

```
┌─────────────────────────────────────────────┐
│  1. 选文件          .md / .docx               │
│  2. 选课程          新建或已有                 │
│     └─ 加载状态      若增量更新                 │
│  3. 提取实体        概念/案例/原则/规则         │
│     └─ 合并去重      与已有数据合并             │
│  4. 人工审查        编辑 / 合并重复项           │
│  5. 映射关系        案例 × 概念关系矩阵          │
│  6. 生成输出        所有页面和文件              │
│     └─ 保存状态      供下次使用                 │
└─────────────────────────────────────────────┘
```

首次完整运行后，日常用 **Update Knowledge Base** 即可：跳过选文件，按 mtime 自动识别新增/改动的笔记，只重处理这些——你的批注和链接都保留。

---

## 输出结构

```
LawNotes/Generated/
├── Tax Law/                      ← 课程文件夹
│   ├── Concepts/                 ← 概念页
│   ├── Cases/                    ← 案例摘要
│   ├── Dashboards/               ← 仪表盘
│   ├── Regulations/              ← 法规页
│   ├── Relationship Matrix.md    ← 关系矩阵
│   ├── Doctrinal Evolution.md    ← 学说演进（时间序 + Mermaid 图）
│   ├── Case Synthesis.md         ← 案例综合表
│   ├── Authority Check.md        ← 效力校验（被后案限制/推翻，迷你 Shepard's）
│   ├── What's New.md             ← 本次更新的高亮关系图
│   ├── Flashcards.md             ← 闪卡（Spaced Repetition）
│   ├── Flashcards (Anki).txt     ← Anki 导入文件
│   ├── Outline.md                ← 学习大纲
│   ├── _state.json               ← 供增量更新的状态
│   └── .rag-index.json           ← Ask My Notes 的本地嵌入索引
├── References/                   ← 解析的链接页
│   ├── Marbury v. Madison.md
│   ├── IRC § 741.md
│   └── 民法典.md
└── ...
```

---

## 隐私与安全

处理敏感材料前请先阅读本节。

- **你的笔记会发送给 Google。** 实体提取、关系映射、语义去重/相关链接、问答都会把所选文本发送到 Gemini API。除非你的工作授权允许，请**不要**处理受特权保护或保密的客户材料。
- **API 密钥存储。** 你的 Gemini 与 CourtListener 密钥以**明文**保存在插件 `data.json`（Obsidian 标准做法）。本仓库已 git-ignore，但请避免把仓库同步到不受信任的位置。
- **链接解析与外部请求。** “解析未解析链接”会把链接文本发送给 CourtListener、Justia、Cornell LII、flk.npc.gov.cn。
- **完全本地、零云端（敏感材料推荐）。** 把 **生成来源** 和 **嵌入来源** 都设为 **Ollama**，即可让实体提取、重构、大纲、嵌入、Ask My Notes 回答全部在本地 [Ollama](https://ollama.com) 服务上运行——离线、免费、无需密钥、不限额、数据不出本机。装好 Ollama，运行 `ollama pull llama3.1` 与 `ollama pull nomic-embed-text`，在设置里选它即可。
- **降低暴露。** 走完全本地（见上），或生成仍用 Gemini 而仅把 **嵌入来源设为 Ollama**;关闭语义去重/相关链接、思考预算设为*关闭*、优先用 Flash 模型。

---

## 开发

```bash
npm install        # 安装依赖
npm run dev        # 监听模式（自动重建）
npm run build      # 生产构建
npm test           # 单元测试（Vitest）
npm run typecheck  # 仅类型检查
npm run lint       # ESLint
npm run format     # Prettier
```

CI（GitHub Actions）在每次推送时运行类型检查 + 测试 + 构建；打 tag 即可发布可用 BRAT 安装的版本。

**技术栈：** TypeScript、esbuild、[Obsidian Plugin API](https://docs.obsidian.md/)、[@google/genai](https://www.npmjs.com/package/@google/genai)、[zod](https://zod.dev/)、[mammoth](https://www.npmjs.com/package/mammoth)、[Vitest](https://vitest.dev/)

---

## 许可证

MIT
