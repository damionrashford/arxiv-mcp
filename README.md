# arxiv-mcp

MCP server that exposes arXiv as a browsable virtual filesystem. Navigate subject groups, categories, and papers as a file tree over the MCP `arxiv:///` URI scheme. Full-text extraction, per-section files, LaTeX source, structured references, and live category subscriptions.

## Requirements

- Node.js ≥ 22 (uses `--experimental-strip-types`)
- Network access to `arxiv.org`, `export.arxiv.org`, `oaipmh.arxiv.org`

## Start

```bash
npm start          # node --experimental-strip-types server.ts
npm run dev        # watch mode
```

## Project layout

```
arxiv-mcp/
  server.ts                  ← entry point — wires everything together
  resources/
    arxiv.ts                 ← arxiv:/// virtual filesystem resource
  tools/
    arxiv_search.ts          ← search arXiv, returns resource_link array
    arxiv_get_paper.ts       ← fetch paper metadata + file resource links
    arxiv_list_categories.ts ← live OAI-PMH taxonomy browser
  lib/
    api.ts                   ← OAI-PMH ListSets + Atom search/fetch
    extract.ts               ← HTML-first text extraction, sections, references, TeX tarball
    subscribe.ts             ← MCP resources/subscribe + 30-min polling
    cache.ts                 ← TTL in-memory cache
    helpers.ts               ← shared annotation builder, READ_ONLY hints, notFound error
    schemas.ts               ← shared Zod schemas (PaperResult)
```

## URI scheme

```
arxiv:///                           → list subject groups (cs, math, physics, …)
arxiv:///{group}                    → list categories in group
arxiv:///{cat}                      → list 25 most-recent papers
arxiv:///{cat}/{id}/                → paper directory
arxiv:///{cat}/{id}/abstract.txt    → full abstract
arxiv:///{cat}/{id}/metadata.json   → title, authors, dates, DOI, URLs
arxiv:///{cat}/{id}/paper.txt       → full text (HTML→text, falls back to PDF→text)
arxiv:///{cat}/{id}/source.tex      → main LaTeX file from source tarball
arxiv:///{cat}/{id}/references.json → structured bibliography with arXiv IDs
arxiv:///{cat}/{id}/sections/       → list of section files
arxiv:///{cat}/{id}/sections/s01-introduction.txt
arxiv:///search/{query}/            → keyword search results
arxiv:///search/{query}/{id}/       → paper directory via search
```

## Tools

| Tool | Description |
|---|---|
| `arxiv_search` | Search with field prefixes (`ti:` `au:` `cat:` `abs:` `all:`) and `AND`/`OR`/`ANDNOT`. Returns `resource_link` items + `structuredContent`. |
| `arxiv_get_paper` | Fetch paper by ID. Returns embedded `metadata.json` + `resource_link` items for all files. |
| `arxiv_list_categories` | Full live taxonomy from OAI-PMH. Optional `group` filter. |

All tools declare:
- `title` — human-readable display name
- `annotations` — `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`
- `outputSchema` — full JSON Schema draft-07 for structured output validation
- Both `content` (MCP content blocks) and `structuredContent` (typed JSON)

## MCP features used

- **Resources** with `subscribe: true` and `listChanged: true` capabilities
- **Resource templates** (`arxiv://{+path}`) with RFC 6570 URI template
- **Resource annotations** — `audience`, `priority`, `lastModified` on every entry
- **`resources/subscribe`** — subscribe to a category URI, get `notifications/resources/updated` when new papers arrive (polls every 30 min)
- **Embedded resources** — `arxiv_get_paper` returns metadata inline as `type: "resource"`
- **Resource links** — tools return `type: "resource_link"` so clients can fetch/subscribe
- **Tool annotations** — `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`
- **Tool output schemas** — each tool has a Zod-derived `outputSchema`
- **Structured content** — every tool returns `structuredContent` alongside `content`
- **`isError`** — error paths set `isError: true` with actionable text for LLM self-correction

## Caching

| Data | TTL |
|---|---|
| OAI-PMH taxonomy | 24 hours |
| Paper metadata / search results | 1 hour |
| Extracted HTML text / sections / references | 1 hour |
| TeX source | 1 hour |
| PDF text (fallback) | 1 hour |

## MCP config (Claude Desktop / claude.ai)

```json
{
  "mcpServers": {
    "arxiv": {
      "command": "node",
      "args": ["--experimental-strip-types", "/path/to/arxiv-mcp/server.ts"]
    }
  }
}
```
