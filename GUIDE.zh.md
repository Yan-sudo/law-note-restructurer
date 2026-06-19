# Law Note Restructurer 使用指南（中文）

> 本指南解决两件事：**①「为什么我看不到任何新功能」**，以及 **②每个新功能到底怎么用**。

---

## 0. 先解决：为什么你看不到任何新功能 ⚠️

**最常见、99% 的原因**：你在 GitHub 上合并了 PR，但**没有把代码更新到本地、也没有重新构建**。

关键概念：

```
源代码 (src/*.ts)  ──npm run build──►  main.js  ──Obsidian 加载──►  你看到的插件
   ↑ PR 合并改的是这里                    ↑ 这个文件没在仓库里（被 .gitignore）
```

- Obsidian 实际加载的是编译后的 **`main.js`**。
- `main.js` **不在 git 仓库里**（写进了 `.gitignore`，每个人本地自己构建）。
- 所以：**在 GitHub 网页上合并 PR，完全不会改动你电脑里的插件文件**。你本地跑的还是旧的 `main.js`。

### ✅ 正确的更新姿势（照着做一遍）

打开终端，进入你的插件目录（路径换成你自己的 vault）：

```bash
cd /你的vault路径/.obsidian/plugins/law-note-restructurer

# 1) 把合并后的最新代码拉到本地
git checkout main
git pull origin main

# 2) 安装依赖并重新构建出新的 main.js
npm install
npm run build
```

构建成功后，会在该目录生成新的 `main.js`。

### 然后在 Obsidian 里「重载插件」（否则还是旧的）

任选一种：

- **方法一（推荐）**：`设置 → 第三方插件` → 找到 **Law Note Restructurer** → 关掉开关再打开。
- **方法二**：命令面板（`Ctrl/Cmd + P`）→ 搜 **Reload app without saving** → 回车。
- **方法三**：直接重启 Obsidian。

### 验证是否生效

命令面板（`Ctrl/Cmd + P`）里搜：

- **Ask My Notes（问我的笔记）**
- **Rebuild Notes Index（重建笔记索引）**

**只要能搜到这两条命令，就说明新版本已经生效**（这两条是这次新增的，旧版本没有）。搜不到 = 上面的构建/重载没成功，回到第 0 节重做。

---

## 1. 安装 / 更新方式

### 方式 A：手动构建（目前唯一可用）

就是第 0 节那套：`git pull` → `npm install && npm run build` → 重载。**每次代码更新后都要重新 `npm run build`。**

### 方式 B：BRAT 一键安装（需要先发一个 Release）

更省事，但前提是仓库里有一个 GitHub Release。本仓库已内置自动发布工作流，发布步骤（维护者做一次）：

```bash
# tag 必须和 manifest.json 里的 version 一致（当前是 0.1.0）
git tag 0.1.0
git push origin 0.1.0
```

推送 tag 后，GitHub Actions 会自动构建并发布带 `main.js / manifest.json / styles.css` 的 Release。之后任何人都可以：

1. 安装并启用 **BRAT** 插件；
2. 命令面板 → *BRAT: Add a beta plugin for testing* → 填 `https://github.com/Yan-sudo/law-note-restructurer`；
3. 在 `设置 → 第三方插件` 启用本插件。以后 BRAT 还能帮你自动更新。

---

## 2. 准备工作

1. **Gemini API Key**：去 <https://aistudio.google.com/> 免费申请。
2. 打开 `设置 → Law Note Restructurer`，把 Key 填到 **Gemini API Key**。
3. 关键设置项一览：

| 设置项 | 作用 | 建议 |
|---|---|---|
| Gemini API Key | AI 调用密钥 | 必填 |
| Model | 模型 | `gemini-2.5-flash`（性价比）/ `pro`（最准） |
| Temperature | 随机性 | 0.2–0.4 |
| Thinking Budget | 推理力度（2.5） | 默认即可；想省钱选 Disabled（仅 Flash） |
| Output Folder | 生成文件位置 | 默认 `LawNotes/Generated` |
| Language | 输出语言 | 中文 / 英文 / 混合 |
| **Semantic Deduplication** | 语义去重（合并同义概念） | 默认**关**，需要才开（有额外开销） |
| **Semantic Related Links** | 概念页加"语义相关"链接 | 默认**关** |
| **Generate Flashcards** | 生成闪卡 + Anki 导出 | 默认**开** |

> ⚠️ 注意：**Semantic Deduplication / Semantic Related Links 默认是关闭的**。如果你想体验这两个功能，必须先在设置里把开关打开，否则跑流程时不会发生任何事——这也可能是你"看不到功能"的原因之一。

---

## 3. 各功能怎么用

### 3.1 主流程（生成知识库）

命令面板 → **Restructure Legal Notes（重构法学笔记）**，按引导：

```
选 .md/.docx 文件 → 选/建课程 → AI 提取实体 → 人工审查去重 → 映射关系 → 生成输出
```

生成结果在 `LawNotes/Generated/<课程名>/` 下。

### 3.2 学说演进 + 案例综合表（自动生成，无需开关）

跑完主流程后，课程文件夹里会多出两个文件：

- **`Doctrinal Evolution.md`（学说演进）**：每个学说按时间排序的"确立→修正→区分→推翻"链，并自带一张 **Mermaid 流程图**。
  - 看图需要 Obsidian **阅读视图**（右上角切换 Reading view），编辑视图里 Mermaid 不渲染。
- **`Case Synthesis.md`（案例综合）**：被多个案例涉及的概念，自动生成"事实/裁判"对比表。

> 看不到这两个文件？检查你打开的是不是**正确的课程文件夹**，以及主流程是否真的跑到了第 6 步"生成输出"。

### 3.3 闪卡（默认开）

跑完主流程后，课程文件夹里有：

- **`Flashcards.md`**：行内 `问题::答案` 格式，文件已打 `#flashcard` 标签。
  - **复习需要装 [Spaced Repetition 插件](https://github.com/st3v3nmw/obsidian-spaced-repetition)**：装好后用它的"Review flashcards"命令即可开始间隔重复。光有这个文件、不装该插件，是不会自动出现复习界面的。
- **`Flashcards (Anki).txt`**：Tab 分隔的正/背面。导入 Anki：`File → Import`，分隔符选 **Tab**，字段映射 正面/背面。

### 3.4 语义去重（默认关 → 需先开）

1. 设置里打开 **Semantic Deduplication**（可调 Similarity Threshold，默认 0.9）。
2. 再跑 **Restructure Legal Notes**。
3. 提取阶段会用 embedding 合并"同义但名字不同"的概念（如 *Aggregate Principle* 与 *Aggregate Theory of Partnership Taxation*），并弹 Notice 告诉你合并了几个。

### 3.5 语义相关链接（默认关 → 需先开）

1. 设置里打开 **Semantic Related Links**。
2. 再跑主流程。
3. 每个概念页底部会追加一个 **「Related Concepts（语义相关）」** 小节，列出语义最接近的其他概念 `[[wikilink]]`。

### 3.6 Ask My Notes（问我的笔记 / RAG 问答）

> 前提：先用主流程生成过笔记（索引是对 `Output Folder` 下的笔记建立的）。

1. 命令面板 → **Ask My Notes（问我的笔记）**。
2. **首次提问**会自动把你的笔记切块、做 embedding、建本地索引（文件 `.rag-index.json`），可能要等几秒到几十秒。
3. 输入问题（如"promissory estoppel 的构成要件？"），回车或点 Ask。
4. 得到**仅基于你笔记**的回答，并附可点击的 `[[来源]]` 链接。
5. 笔记有较大改动后，跑 **Rebuild Notes Index（重建笔记索引）** 刷新索引。

> 想要更强、完全本地（无需 API key）的语义体验，可以在生成的笔记库上改用 [Smart Connections](https://github.com/brianpetro/obsidian-smart-connections) 插件——我们内置的问答是零配置的轻量替代。

### 3.7 链接解析

命令面板 → **Resolve Unresolved Links** → 扫描未解析的 `[[wikilink]]`，自动分类（美/中、判例/法条），从 CourtListener / Cornell LII / 国家法律法规数据库等抓取原文建页。

---

## 4. 常见问题（看不到东西时按这个排查）

| 现象 | 原因 | 解决 |
|---|---|---|
| 命令面板搜不到 **Ask My Notes** 等新命令 | 没重新构建 / 没重载插件 | 第 0 节：`git pull` → `npm run build` → 重载插件 |
| `npm run build` 报错 | 依赖没装 | 先 `npm install` 再 `npm run build` |
| 跑了流程但没有 Doctrinal Evolution / 闪卡 | 没跑到"生成输出"步，或看错文件夹 | 确认主流程完整跑完，打开正确的 `<课程>` 文件夹 |
| 语义去重/相关链接"没反应" | 这俩**默认关闭** | 设置里手动打开开关，再跑流程 |
| 闪卡不能复习 | 没装 Spaced Repetition 插件 | 装该插件后用它的复习命令 |
| Mermaid 图不显示 | 在编辑视图 | 切到阅读视图（Reading view） |
| 提取直接失败/报错 | API key 无效，或模型拒绝结构化输出 | 检查 Key；换 `gemini-2.5-flash`；重试 |
| 改了代码但 Obsidian 没变化 | 忘了重新 build 或重载 | 每次改代码都要 `npm run build` + 重载 |

---

## 5. 一句话总结

> **新功能 = 新代码 → 必须本地 `git pull` + `npm run build` + 重载 Obsidian 才会出现。** GitHub 上合并 PR 不会自动更新你电脑里的插件。
