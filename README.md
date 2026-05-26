# arXiv MCP Server

> **MCP server that turns arXiv into a navigable virtual filesystem.** Browse 2M+ research papers as `arxiv:///` URIs — full-text extraction, per-section files, LaTeX source, structured references, and live category subscriptions. The only TypeScript arXiv MCP with MCP Resources (not just tools).

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.29-blueviolet)](https://modelcontextprotocol.io)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Works with **Claude Desktop**, **Claude Code**, **Cursor**, **Windsurf**, **Zed**, and any MCP-compatible client.

---

## Why this arXiv MCP server?

Every other arXiv MCP gives you search tools that return JSON. This one exposes arXiv as a **browsable virtual filesystem** using MCP Resources — the part of the protocol most servers ignore.

| Feature | This server | Other arXiv MCPs |
|---|---|---|
| Language | TypeScript | Python (all of them) |
| MCP Resources (VFS) | ✅ `arxiv:///` URI scheme | ❌ tools only |
| Full-text extraction | ✅ HTML-first + PDF fallback | ❌ abstract only |
| Per-section files | ✅ `sections/s01-introduction.txt` | ❌ |
| LaTeX source | ✅ extracted from tarball | ❌ |
| Structured references | ✅ JSON with arXiv IDs | ❌ |
| Live subscriptions | ✅ `resources/subscribe` + polling | ❌ |
| Tool output schemas | ✅ full JSON Schema | ❌ |
| Embedded resources in tools | ✅ | ❌ |

---

## Quick start

**1. Add to your MCP client config:**

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

**2. Install dependencies:**

```bash
npm install
```

**3. Run:**

```bash
npm start
```

---

## The `arxiv:///` virtual filesystem

Navigate arXiv like a file tree. Each level reveals the next:

```
arxiv:///                           ← all subject groups (cs, math, physics, …)
arxiv:///cs                         ← categories in cs (cs.AI, cs.LG, cs.CL, …)
arxiv:///cs.AI                      ← 25 most-recent papers in cs.AI
arxiv:///cs.AI/2501.12345/          ← paper directory
  ├── metadata.json                 ← title, authors, dates, DOI, URLs
  ├── abstract.txt                  ← full abstract
  ├── paper.txt                     ← full text (HTML→text, PDF fallback)
  ├── source.tex                    ← main LaTeX file from source tarball
  ├── references.json               ← bibliography with linked arXiv IDs
  └── sections/
        ├── s01-introduction.txt
        ├── s02-related-work.txt
        └── s03-methodology.txt …
arxiv:///search/transformer+llm/    ← keyword search results
```

Every entry carries MCP annotations: `audience`, `priority` (0.5–0.95), and `lastModified` from the paper's update date. Clients and LLMs use these to prioritize what to read.

---

## Tools

All three tools return both `content` (MCP content blocks for LLMs) and `structuredContent` (typed JSON matching the output schema) — so they work for both LLM context injection and programmatic use.

### `arxiv_search`

Search arXiv using the full Atom API query syntax. Returns `resource_link` content blocks pointing to browsable paper directories.

```
Field prefixes:  ti:(title)  au:(author)  cat:(category)  abs:(abstract)  all:(all fields)
Operators:       AND  OR  ANDNOT

Examples:
  "ti:attention mechanism AND cat:cs.AI"
  "au:lecun AND cat:cs.LG"
  "cat:cs.CL AND ti:large language model"
  "abs:diffusion model AND cat:cs.CV"
```

### `arxiv_get_paper`

Fetch a paper by arXiv ID. Returns an **embedded** `metadata.json` resource (immediately readable by the LLM) plus `resource_link` items for all paper files.

```
"2501.12345"      → new-style ID
"cs/9901002"      → old-style ID
"2301.07041"      → example: Verifiable Fully Homomorphic Encryption
```

### `arxiv_list_categories`

Full live taxonomy fetched from the OAI-PMH API — no hardcoded category lists. Optional `group` filter.

```
groups: cs, math, physics, econ, eess, q-bio, q-fin, stat
```

---

## MCP features used

This server uses the full MCP protocol surface, not just tools:

- **`resources` capability** with `subscribe: true` and `listChanged: true`
- **Resource templates** — RFC 6570 `arxiv://{+path}` URI template
- **Resource annotations** — `audience`, `priority`, `lastModified` on every directory entry and file
- **`resources/subscribe`** — subscribe to `arxiv:///{cat}`, get `notifications/resources/updated` when new papers arrive (30-min poll)
- **`notifications/resources/list_changed`** — fires when a subscribed category's paper list changes
- **Embedded resources** — `arxiv_get_paper` returns metadata inline so the LLM doesn't need a second fetch
- **Resource links** — tools return `type: "resource_link"` so clients can fetch or subscribe to results
- **Tool annotations** — `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`
- **Tool output schemas** — full JSON Schema draft-07 on all three tools
- **Structured content** — `structuredContent` alongside `content` in every tool result
- **`isError`** — error paths return `isError: true` with actionable text for LLM self-correction

---

## Project structure

```
arxiv-mcp/
  server.ts                  ← entry point — wires everything, connects transport
  resources/
    arxiv.ts                 ← arxiv:/// virtual filesystem resource + routing
  tools/
    arxiv_search.ts          ← search tool
    arxiv_get_paper.ts       ← get paper tool
    arxiv_list_categories.ts ← list categories tool
  lib/
    api.ts                   ← OAI-PMH ListSets + Atom search/fetch
    extract.ts               ← HTML extraction, sections, references, TeX tarball
    subscribe.ts             ← resources/subscribe + 30-min polling
    cache.ts                 ← TTL in-memory cache
    helpers.ts               ← annotation builder, READ_ONLY hints, notFound error
    schemas.ts               ← shared Zod schemas
```

---

## Configuration for popular MCP clients

### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "arxiv": {
      "command": "node",
      "args": ["--experimental-strip-types", "/absolute/path/to/arxiv-mcp/server.ts"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add arxiv -- node --experimental-strip-types /absolute/path/to/arxiv-mcp/server.ts
```

### Cursor / Windsurf / Zed

Add the same `command` + `args` to your client's MCP server config. All three support stdio MCP servers.

---

## Caching

| Data | TTL |
|---|---|
| OAI-PMH taxonomy (all categories) | 24 hours |
| Paper metadata + search results | 1 hour |
| Extracted HTML text / sections / references | 1 hour |
| LaTeX source | 1 hour |
| PDF text (fallback) | 1 hour |

arXiv rate-limits requests to ~3s between calls. The cache means repeated navigation is instant.

---

## Requirements

- Node.js ≥ 22 (`--experimental-strip-types`)
- Network access to `arxiv.org`, `export.arxiv.org`, `oaipmh.arxiv.org`

---

## License

MIT
