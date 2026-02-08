# Law Note Restructurer

An Obsidian plugin that uses Google Gemini AI to restructure legal study notes into interconnected concept pages, case briefs, relationship matrices, dashboards, and outlines.

## Features

### AI-Powered Note Restructuring

Feed in your raw legal notes (Markdown or DOCX) and the plugin will:

1. **Extract Legal Entities** — concepts, cases, principles, and rules identified by Gemini AI
2. **Map Relationships** — how cases relate to concepts (establishes, applies, modifies, distinguishes, overrules, illustrates)
3. **Generate Structured Pages** — individual pages for each concept and case, plus:
   - Relationship Matrix (case-concept grid)
   - Study Outline
   - Per-concept Dashboards

All generated pages are interlinked with `[[wikilinks]]` for seamless navigation.

### Resolve Unresolved Links

The generated pages often reference legal authorities (cases, statutes) that don't have their own pages yet. The **Resolve Unresolved Links** command scans your vault for broken wikilinks and automatically creates pages by fetching content from free legal databases:

| Link Type | Source | Auth |
|-----------|--------|------|
| US Case Law | [CourtListener](https://www.courtlistener.com/) API with [Justia](https://www.justia.com/) fallback | Optional free token |
| US Statutes | [Cornell LII](https://www.law.cornell.edu/) | None |
| Chinese Laws | [国家法律法规数据库](https://flk.npc.gov.cn/) | None |
| Chinese Cases | Stub page with search links | N/A |

The plugin auto-classifies links using pattern matching (e.g. `Marbury v. Madison` → US case, `42 U.S.C. § 1983` → US statute, `民法典` → Chinese law) and lets you review and override classifications before fetching.

## Commands

| Command | Description |
|---------|-------------|
| **Restructure Legal Notes** | Run the full 4-step pipeline (select files → extract entities → map relationships → generate output) |
| **Extract Legal Entities Only** | Run only entity extraction (steps 1-2) |
| **Resolve Unresolved Links** | Scan for broken wikilinks and create pages from legal databases |

## Setup

### Requirements

- Obsidian Desktop (not mobile)
- A Google Gemini API key from [aistudio.google.com](https://aistudio.google.com/)

### Installation

1. Clone or copy this repo into your vault's `.obsidian/plugins/law-note-restructurer/` directory
2. Run `npm install && npm run build`
3. Enable the plugin in Obsidian Settings → Community Plugins

### Configuration

In Settings → Law Note Restructurer:

**AI Configuration**
- **Gemini API Key** — your Google Gemini API key
- **Model** — Gemini 2.5 Pro (best quality), Flash (recommended), or Flash Lite (cheapest)
- **Temperature** — 0.2-0.4 recommended for consistent output
- **Streaming** — real-time progress display during AI generation

**Output Configuration**
- **Output Folder** — where generated files go (default: `LawNotes/Generated`)
- **Language** — 中文, English, or Mixed
- **Source Footnotes** — annotate sections with their source file
- **Append to Existing** — fuzzy-match and append instead of overwrite

**Link Resolver**
- **CourtListener API Token** — optional, for US case law (get one free at [courtlistener.com](https://www.courtlistener.com/))
- **Resolved Links Folder** — where fetched pages go (default: `{output folder}/References`)
- **Scan Scope** — scan output folder only or entire vault
- **Request Delay** — rate limiting between requests (default: 1500ms)

## Generated File Structure

```
LawNotes/Generated/
├── Concepts/
│   ├── Consideration.md
│   ├── Offer and Acceptance.md
│   └── ...
├── Cases/
│   ├── Hadley v. Baxendale.md
│   └── ...
├── Dashboards/
│   ├── Consideration Dashboard.md
│   └── ...
├── References/
│   ├── Marbury v. Madison.md
│   ├── 42 U.S.C. § 1983.md
│   ├── 民法典.md
│   └── ...
├── Relationship Matrix.md
└── Outline.md
```

## Development

```bash
npm install        # Install dependencies
npm run dev        # Watch mode (auto-rebuild on save)
npm run build      # Production build (type-check + bundle)
```

### Tech Stack

- TypeScript + esbuild
- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [@google/genai](https://www.npmjs.com/package/@google/genai) — Gemini AI client
- [zod](https://zod.dev/) — structured output validation
- [mammoth](https://www.npmjs.com/package/mammoth) — DOCX parsing

## License

MIT
