# arXiv MCP Server

> **MCP server that turns arXiv into a navigable virtual filesystem.** Browse 2M+ research papers as `arxiv:///` URIs — full-text extraction, per-section files, LaTeX source, structured references, and live category subscriptions.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.29-blueviolet)](https://modelcontextprotocol.io)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What it does

Exposes arXiv as a **browsable virtual filesystem** using MCP Resources. Navigate subject groups, categories, and papers as `arxiv:///` URIs — then read the abstract, full text, LaTeX source, structured references, or individual sections as files.

Three tools handle everything the filesystem doesn't cover:

- **`arxiv_search`** — full Atom API query syntax with field prefixes and boolean operators
- **`arxiv_get_paper`** — metadata returned embedded (no second fetch needed) plus links to every file
- **`arxiv_list_categories`** — live OAI-PMH taxonomy, optionally filtered by subject group

---

## Install

### Claude Code — plugin (one command)

```bash
claude plugin install github:damionrashford/arxiv-mcp
```

The plugin auto-wires the `arxiv` MCP server and an `arxiv-researcher` subagent. No path configuration needed — `${CLAUDE_PLUGIN_ROOT}` resolves automatically.

> Requires Node.js ≥ 22 on your machine. Run `node --version` to check.

After installing, ask Claude to search for papers, read abstracts, or fetch a paper by ID — it routes to the `arxiv-researcher` agent automatically.

---

### Claude Code — manual

```bash
claude mcp add arxiv -- node --experimental-strip-types /absolute/path/to/arxiv-mcp/server.ts
```

Or add to your project's `.mcp.json`:

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

---

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

---

### OpenAI Codex CLI

Add to `~/.codex/config.toml` (user-global) or `.codex/config.toml` (project-local, must be a trusted directory):

```toml
[mcp_servers.arxiv]
command = "node"
args = ["--experimental-strip-types", "/path/to/arxiv-mcp/server.ts"]
enabled = true
startup_timeout_sec = 30
tool_timeout_sec = 120
default_tools_approval_mode = "auto"
```

The full config with per-tool overrides is in [`integrations/codex.toml`](integrations/codex.toml).

---

### Pi Coding Agent

**Step 1** — Install [pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter) if you don't have it:

```bash
pi install npm:pi-mcp-adapter
```

Restart Pi after installation.

**Step 2** — Add the arXiv server to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "arxiv": {
      "command": "node",
      "args": ["--experimental-strip-types", "/path/to/arxiv-mcp/server.ts"],
      "directTools": ["arxiv_search", "arxiv_get_paper", "arxiv_list_categories"]
    }
  }
}
```

**Step 3 (optional)** — Install the companion extension for `/arxiv-search`, `/arxiv-paper`, and `/arxiv-categories` slash commands:

```bash
# Global — available in all projects
cp integrations/pi-extension.ts ~/.pi/agent/extensions/arxiv.ts

# Or project-local
cp integrations/pi-extension.ts .pi/extensions/arxiv.ts
```

Once installed, the extension notifies you when arXiv tools are active and lets you trigger searches directly from the command bar.

---

### Cursor, Windsurf, Zed

Add to your client's MCP server config (same `command` + `args` as above):

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

---

## Requirements

- Node.js ≥ 22 (`--experimental-strip-types` flag)
- Network access to `arxiv.org`, `export.arxiv.org`, `oaipmh.arxiv.org`

Clone and install dependencies once:

```bash
git clone https://github.com/damionrashford/arxiv-mcp
cd arxiv-mcp
npm install
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

## MCP features

This server uses the full MCP protocol surface, not just tools:

- **`resources` capability** with `subscribe: true` and `listChanged: true`
- **Resource templates** — RFC 6570 `arxiv://{+path}` URI template
- **Resource annotations** — `audience`, `priority`, `lastModified` on every entry
- **`resources/subscribe`** — subscribe to `arxiv:///{cat}`, get `notifications/resources/updated` when new papers arrive (30-min poll)
- **`notifications/resources/list_changed`** — fires when a subscribed category's paper list changes
- **Embedded resources** — `arxiv_get_paper` returns metadata inline so the LLM doesn't need a second fetch
- **Resource links** — tools return `type: "resource_link"` so clients can fetch or subscribe to results
- **Tool annotations** — `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`
- **Tool output schemas** — full JSON Schema draft-07 on all three tools
- **Structured content** — `structuredContent` alongside `content` in every tool result
- **`isError`** — error paths return `isError: true` with actionable text for LLM self-correction

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

## Project structure

```
arxiv-mcp/
  server.ts                  ← entry point
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
  agents/
    arxiv-researcher.md      ← Claude Code subagent definition
  integrations/
    codex.toml               ← OpenAI Codex CLI config snippet
    pi-extension.ts          ← Pi coding agent extension
  .claude-plugin/
    plugin.json              ← Claude Code plugin manifest
  .mcp.json                  ← MCP server definition (plugin + project scope)
```

---

## License

MIT
