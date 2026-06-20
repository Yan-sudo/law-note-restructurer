# Law Note Restructurer

> **An Obsidian plugin that turns messy legal notes into a structured, interlinked knowledge base — powered by Google Gemini AI.**

**English** · [中文](README.zh-CN.md)

---

## What It Is

This is a **knowledge-base _generator_ for law students**, not a do-everything AI suite. It reads your raw notes and produces a clean, wikilinked vault of concepts, case briefs, rules, outlines, and study aids. For browsing, reviewing, and querying that vault, it is designed to **plug into the best existing Obsidian plugins** rather than reinvent them — see [Works Best With](#works-best-with).

What it does on raw Markdown / Word notes:

1. **Extracts** concepts, cases, principles, and rules using AI.
2. **Maps relationships** between cases and concepts.
3. **Generates** interlinked pages, dashboards, outlines, a relationship matrix, evolution chains, synthesis tables, and flashcards.
4. **Resolves** broken wikilinks by fetching from legal databases.

---

## Why It's Law-Specific

General note/AI plugins don't understand legal material. This plugin's value is the law-aware layer no generic tool provides:

- **Legal entity extraction** — concepts, cases (facts/holding/significance), rules (elements/exceptions/application steps), and principles, in an IRAC-friendly shape.
- **Doctrinal evolution** — chronological "established → modified → distinguished → overruled" chains per doctrine, with a Mermaid diagram.
- **Case synthesis** — side-by-side facts/holding comparison tables for multi-case doctrines.
- **Citation normalization & link resolving** — canonicalizes `IRC § 741` / `Treas. Reg.` / `26 CFR` / `民法典 第三条`, then fetches text from CourtListener, Justia, Cornell LII, and flk.npc.gov.cn.
- **Bilingual & multi-jurisdiction** — US + China, Chinese/English/mixed output.
- **Grows with you** — add more class notes anytime; updates merge in incrementally, your `%% lnr:notes %%` **My Notes** zones are never overwritten, and each run writes a **`What's New`** change graph (added = green, updated = orange).

---

## Works Best With

This plugin **generates** the vault; pair it with these mature, general-purpose plugins for everything downstream. (Don't expect — and don't wait for — this plugin to duplicate them.)

| Need | Recommended plugin | How this plugin feeds it |
|---|---|---|
| Semantic search & AI chat over the whole vault | [**Smart Connections**](https://github.com/brianpetro/obsidian-smart-connections) (local, no API key) or Copilot | Our wikilinked, tagged pages are ideal embedding targets. The built-in **Ask My Notes** is a zero-config, citation-grounded alternative — if you already run Smart Connections, just use that. |
| Spaced-repetition review | [**Spaced Repetition**](https://github.com/st3v3nmw/obsidian-spaced-repetition) | We emit `Flashcards.md` in its inline `Q::A` format, tagged `#flashcard`. |
| Export cards to Anki | [**Obsidian_to_Anki**](https://github.com/Pseudonium/Obsidian_to_Anki) — or our `Flashcards (Anki).txt` | Tab-separated front/back, ready to import. |
| Dynamic tables & queries | [**Dataview**](https://github.com/blacksmithgu/obsidian-dataview) | Pages carry `tags:`/`date:` frontmatter (`law/concept`, `law/case`, …) so you can build your own live views. |
| Citation library & PDFs | [**Zotero**](https://www.zotero.org/) + the Citations plugin | Complements our Link Resolver, which fetches primary-source text. |
| Relationship graph | Obsidian's native Graph, or Juggl / Excalibrain | Everything is `[[wikilinked]]`, so the graph works out of the box. |
| Install & auto-update this plugin | [**BRAT**](https://github.com/TfTHacker/obsidian42-brat) | See [Install](#install). |

---

## Status

Not yet in the Obsidian community store. Install via **BRAT** (recommended) or a manual build — see below. Desktop only (`isDesktopOnly: true`), because it makes network calls and reads local files.

---

## Getting Started

### Prerequisites

- Obsidian Desktop
- A free [Google Gemini API key](https://aistudio.google.com/)

### Install

**Option A — BRAT (recommended, auto-updates)**

1. Install the **BRAT** community plugin and enable it.
2. Command palette → *BRAT: Add a beta plugin for testing* → enter `https://github.com/Yan-sudo/law-note-restructurer`.
3. Enable **Law Note Restructurer** in Settings → Community Plugins.

> BRAT needs a GitHub Release with `main.js`, `manifest.json`, `styles.css`. This repo ships a release workflow: push a tag matching `manifest.json` (`git tag 0.1.0 && git push --tags`) to publish one.

**Option B — Manual build**

```bash
# Clone INTO your vault's plugins folder (note the two arguments)
git clone https://github.com/Yan-sudo/law-note-restructurer.git \
  /path/to/vault/.obsidian/plugins/law-note-restructurer

cd /path/to/vault/.obsidian/plugins/law-note-restructurer
npm install && npm run build
```

Then enable **Law Note Restructurer** in Obsidian → Settings → Community Plugins (reload plugins if needed).

### Configure

Open Settings → Law Note Restructurer:

| Setting | Description | Default |
|---|---|---|
| Gemini API Key | Your Google Gemini key | — |
| Model | `gemini-2.5-pro` (best), `flash` (recommended), `flash-lite` (cheapest) | `gemini-2.5-flash` |
| Embedding Provider | `Gemini` (cloud) or **`Ollama` (local — offline, free, no quota, private)** | `Gemini` |
| Embedding Model | Gemini model, or the Ollama model to pull | `gemini-embedding-001` · `nomic-embed-text` |
| Temperature | Lower = more focused. 0.2–0.4 recommended | 0.3 |
| Thinking Budget | Gemini 2.5 reasoning effort. Model default recommended; Disabled is cheapest (Flash only) | Model default |
| Streaming | Show real-time AI progress | On |
| Output Folder | Where to save generated files | `LawNotes/Generated` |
| Language | Chinese, English, or Mixed | Mixed |
| Concurrency | Parallel API calls (1–10) | 5 |
| Semantic Dedup | Merge same-meaning concepts via embeddings (extra cost) | Off |
| Semantic Related Links | Append "Related Concepts" to concept pages via embeddings | Off |
| Generate Flashcards | Spaced Repetition + Anki export from rules/holdings | On |
| CourtListener Token | Optional, for US case lookups | — |

### Local embeddings with Ollama (optional, recommended for privacy)

Run all embeddings (semantic dedup, related links, Ask My Notes retrieval) on your own machine — offline, free, no quota, and your notes never leave the device:

1. Install [Ollama](https://ollama.com) and make sure it's running.
2. Pull an embedding model: `ollama pull nomic-embed-text`.
3. In **Settings → Embedding Provider**, choose **Ollama (local)**.
4. Click **Test connection** — you should see `✓ Ollama OK — N-dimensional embeddings`.

If the test shows a **403 / CORS** error, allow Obsidian to reach Ollama and restart it:

```bash
# macOS
launchctl setenv OLLAMA_ORIGINS "*"
# Linux / Windows: set the env var OLLAMA_ORIGINS=*  (or app://obsidian.md) before starting Ollama
```

> Only **embeddings** go local. Answer *generation* in Ask My Notes still uses Gemini (a fully local generator is on the roadmap).

---

## Quick Start

Click the **⚖️ Law Notes** ribbon icon (left edge) to open the control panel, then:

1. **Restructure notes** → pick your class-note files (`.md`/`.docx`) and name the course. The plugin builds the whole knowledge base.
2. **Read & annotate** the generated pages. Anything you write in the **📝 My Notes** zone is kept forever.
3. **Add more class notes later** → **Update knowledge base**. It auto-detects what's new/changed, processes only that, and writes a **`What's New`** change graph.
4. **Ask my notes** → chat, or switch modes: **IRAC** (paste a fact pattern), **Practice**, **Socratic**, **US ↔ China**.

> 🔒 **Privacy tip:** set **Embedding Provider = Ollama** for offline, quota-free, on-device embeddings.

---

## Commands

**No need to memorize commands** — click the **⚖️ Law Notes** ribbon icon (left edge) to open a control panel with a labeled button for every action. Or open the command palette (`Ctrl/Cmd + P`):

| Command | What it does |
|---|---|
| **Restructure Legal Notes** | Full pipeline: select files → pick course → extract entities → review & dedup → map relationships → generate output |
| **Extract Legal Entities Only** | Only extract entities without generating pages |
| **Update Knowledge Base** | One click: auto-detects new/changed class notes (by mtime), processes only those, merges, regenerates affected pages, refreshes the What's New graph — no file picking |
| **Build Outline** | Pick **detail** (concise/standard/detailed) + **structure** (as-taught / thematic / **case lifecycle** / custom) → AI proposes a table of contents → **drag-reorder/edit** it → AI writes the full outline in that order |
| **Resolve Unresolved Links** | Find broken wikilinks and create pages from legal databases |
| **Ask My Notes** | Docked right-sidebar chat panel with **modes**: Q&A · **IRAC analysis** (paste a fact pattern) · **Practice** (hypothetical + model answer) · **Socratic** (it cold-calls you) · **US ↔ China** comparison. Plus folder scope, multi-turn history, incremental index, `[[source]]` links |
| **Rebuild Notes Index** | Force a full re-embed from scratch (rarely needed) |

> *Ask My Notes* and *Semantic Related Links* are lightweight, zero-config built-ins. If you want a more powerful, fully local semantic experience, use [Smart Connections](https://github.com/brianpetro/obsidian-smart-connections) on the generated vault instead.

---

## How It Works

```
┌─────────────────────────────────────────────┐
│  1. Pick files          .md / .docx          │
│  2. Choose course       new or existing      │
│     └─ Load state       if incremental       │
│  3. Extract entities    concepts/cases/...    │
│     └─ Merge & dedup    with existing data    │
│  4. Review              edit / merge dupes    │
│  5. Map relationships   case × concept matrix │
│  6. Generate output     all pages & files     │
│     └─ Save state       for next time         │
└─────────────────────────────────────────────┘
```

After the first full run, use **Update Knowledge Base** for the day-to-day loop: it skips the file picker, auto-detects new/changed notes (by mtime), and only re-processes those — your edits and links are preserved.

---

## Output Structure

```
LawNotes/Generated/
├── Tax Law/                      ← course folder
│   ├── Concepts/                 ← concept pages
│   ├── Cases/                    ← case briefs
│   ├── Dashboards/               ← per-concept dashboards
│   ├── Regulations/              ← regulation pages
│   ├── Relationship Matrix.md    ← case × concept grid
│   ├── Doctrinal Evolution.md    ← how doctrines evolved (chrono + Mermaid)
│   ├── Case Synthesis.md         ← multi-case comparison tables
│   ├── Authority Check.md        ← doctrines limited/overruled by later cases (mini-Shepard's)
│   ├── What's New.md             ← change graph: what this run added/updated
│   ├── Flashcards.md             ← Spaced Repetition cards
│   ├── Flashcards (Anki).txt     ← Anki import file
│   ├── Outline.md                ← study outline
│   ├── _state.json               ← saved state for incremental updates
│   └── .rag-index.json           ← local embedding index for Ask My Notes
├── References/                   ← resolved link pages
│   ├── Marbury v. Madison.md
│   ├── IRC § 741.md
│   └── 民法典.md
└── ...
```

---

## Privacy & Security

Please read this before processing sensitive material.

- **Your notes are sent to Google.** Extraction, relationship mapping, semantic dedup/links, and Ask My Notes send the selected note text to the Google Gemini API. Do **not** process privileged or confidential client material unless your engagement permits sending it to a third-party AI service.
- **API key storage.** Your Gemini and CourtListener keys are stored locally and unencrypted in the plugin's `data.json` (standard Obsidian plugin data API). It is git-ignored here, but avoid syncing your vault to untrusted locations.
- **Link Resolver & external requests.** "Resolve Unresolved Links" sends link text to CourtListener, Justia, Cornell LII, and flk.npc.gov.cn.
- **Local embeddings (recommended for sensitive material).** Set **Embedding Provider = Ollama** to run all embeddings (semantic dedup, related links, Ask My Notes retrieval) on a local [Ollama](https://ollama.com) server — offline, free, no quota, and your notes never leave the machine. Install Ollama, run `ollama pull nomic-embed-text`, and select it in settings. (Answer *generation* in Ask My Notes still uses Gemini; a fully local generator is on the roadmap via the `LLMClient` abstraction.)
- **Reducing exposure.** Use local embeddings (above), disable Semantic Dedup/Links, set Thinking Budget to *Disabled*, and prefer Flash models.

---

## Development

```bash
npm install        # install dependencies
npm run dev        # watch mode (auto-rebuild)
npm run build      # production build
npm test           # unit tests (Vitest)
npm run typecheck  # type-check only
npm run lint       # ESLint
npm run format     # Prettier
```

CI (GitHub Actions) runs typecheck + tests + build on every push; tag a version to cut a BRAT-installable release.

**Tech stack:** TypeScript, esbuild, [Obsidian Plugin API](https://docs.obsidian.md/), [@google/genai](https://www.npmjs.com/package/@google/genai), [zod](https://zod.dev/), [mammoth](https://www.npmjs.com/package/mammoth), [Vitest](https://vitest.dev/)

---

## License

MIT
