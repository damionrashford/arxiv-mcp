# arXiv MCP Server

> **MCP server that turns arXiv into a navigable virtual filesystem.** Browse 2M+ research papers as `arxiv:///` URIs — full-text extraction, per-section files, LaTeX source, structured references, and live category subscriptions.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.29-blueviolet)](https://modelcontextprotocol.io)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Works with **Claude Code**, **Claude Desktop**, **OpenAI Codex CLI**, **Pi**, **Cursor**, **Windsurf**, **Zed**, and any MCP-compatible client.

---

## What it does

Exposes arXiv as a **browsable virtual filesystem** using MCP Resources. Navigate subject groups, categories, and papers as `arxiv:///` URIs — then read the abstract, full text, LaTeX source, structured references, or individual sections as files.

Three tools handle search and retrieval:

- **`arxiv_search`** — full Atom API query syntax with field prefixes (`ti:`, `au:`, `cat:`, `abs:`) and boolean operators
- **`arxiv_get_paper`** — metadata returned embedded in one call, plus resource links to every file
- **`arxiv_list_categories`** — live OAI-PMH taxonomy, optionally filtered by subject group

---

## Requirements

- Node.js ≥ 22 (run `node --version` to check)
- Network access to `arxiv.org`, `export.arxiv.org`, `oaipmh.arxiv.org`

Clone and install dependencies once:

```bash
git clone https://github.com/damionrashford/arxiv-mcp
cd arxiv-mcp && npm install
```

---

## Install

### Claude Code — plugin

One command. No path configuration needed.

```bash
claude plugin install github:damionrashford/arxiv-mcp
```

The plugin auto-wires the `arxiv` MCP server. Ask Claude to find papers, read abstracts, or fetch a paper by ID.

To verify it loaded:

```bash
claude mcp list
```

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

### OpenAI Codex CLI — plugin

Install directly from the Codex plugin marketplace or browse via `/plugins` in the Codex CLI.

To install from the marketplace source, add to your workspace's `.agents/plugins/marketplace.json`:

```json
{
  "name": "arxiv-mcp",
  "source": { "github": { "repo": "damionrashford/arxiv-mcp" } }
}
```

Then install via the Codex app or CLI.

**Manual config** — add to `~/.codex/config.toml`:

```toml
[mcp_servers.arxiv]
command = "node"
args = ["--experimental-strip-types", "/path/to/arxiv-mcp/server.ts"]
enabled = true
startup_timeout_sec = 30
tool_timeout_sec = 120
default_tools_approval_mode = "auto"
```

Add per-tool overrides if needed:

```toml
[mcp_servers.arxiv.tools.arxiv_search]
approval_mode = "auto"

[mcp_servers.arxiv.tools.arxiv_get_paper]
approval_mode = "auto"

[mcp_servers.arxiv.tools.arxiv_list_categories]
approval_mode = "auto"
```

---

### Pi Coding Agent

**Step 1** — Add the arXiv server to your project's `.mcp.json`. Pi requires [pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter) — install it once with `pi install npm:pi-mcp-adapter`.

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

**Step 2 (optional)** — Add `/arxiv-search`, `/arxiv-paper`, and `/arxiv-categories` slash commands. Create `~/.pi/agent/extensions/arxiv.ts`:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("arxiv-search", {
    description: "Search arXiv — /arxiv-search <query>",
    handler: async (args, ctx) => {
      if (!args.trim()) { ctx.ui.notify("Usage: /arxiv-search <query>", "warning"); return; }
      if (!ctx.isIdle()) { ctx.ui.notify("Agent is busy", "warning"); return; }
      pi.sendUserMessage(`Search arXiv for: ${args.trim()}. Use arxiv_search with field prefixes and return the top 5 results with title, authors, date, and abstract summary.`);
    },
  });

  pi.registerCommand("arxiv-paper", {
    description: "Fetch arXiv paper — /arxiv-paper <id>",
    handler: async (args, ctx) => {
      if (!args.trim()) { ctx.ui.notify("Usage: /arxiv-paper 2501.12345", "warning"); return; }
      if (!ctx.isIdle()) { ctx.ui.notify("Agent is busy", "warning"); return; }
      pi.sendUserMessage(`Fetch arXiv paper ${args.trim()} using arxiv_get_paper. Return title, authors, date, categories, abstract, and links.`);
    },
  });

  pi.registerCommand("arxiv-categories", {
    description: "List arXiv categories — /arxiv-categories [group]",
    handler: async (args, ctx) => {
      if (!ctx.isIdle()) { ctx.ui.notify("Agent is busy", "warning"); return; }
      pi.sendUserMessage(args.trim()
        ? `List arXiv categories in the "${args.trim()}" group using arxiv_list_categories.`
        : `List all arXiv subject groups using arxiv_list_categories.`);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    if (pi.getAllTools().some((t) => t.name.startsWith("arxiv")))
      ctx.ui.notify("arXiv ready — /arxiv-search, /arxiv-paper, /arxiv-categories", "info");
  });
}
```

---

### Cursor — plugin

**Option 1: Marketplace** — browse `cursor.com/marketplace`, search for `arxiv-mcp`, and install.

**Option 2: Local install** — clone the repo into `~/.cursor/plugins/local/arxiv-mcp/`:

```bash
git clone https://github.com/damionrashford/arxiv-mcp ~/.cursor/plugins/local/arxiv-mcp
cd ~/.cursor/plugins/local/arxiv-mcp && npm install
```

Cursor discovers the plugin automatically from `~/.cursor/plugins/local/`.

**Option 3: Manual MCP config** — add to Cursor's MCP settings (Settings → MCP):

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

### Windsurf, Zed

Add the same `command` + `args` to your client's MCP server config:

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

## The `arxiv:///` virtual filesystem

Navigate arXiv like a file tree:

```
arxiv:///                           ← all subject groups (cs, math, physics, …)
arxiv:///cs                         ← categories in cs (cs.AI, cs.LG, cs.CL, …)
arxiv:///cs.AI                      ← 25 most-recent papers in cs.AI
arxiv:///cs.AI/2501.12345/          ← paper directory
  ├── metadata.json                 ← title, authors, dates, DOI, URLs       (priority 0.95)
  ├── abstract.txt                  ← full abstract                          (priority 0.90)
  ├── paper.txt                     ← full text (HTML→text, PDF fallback)    (priority 0.70)
  ├── references.json               ← bibliography with linked arXiv IDs     (priority 0.75)
  ├── source.tex                    ← main LaTeX file from source tarball    (priority 0.50)
  └── sections/
        ├── s01-introduction.txt
        ├── s02-related-work.txt
        └── s03-methodology.txt …   (priority 0.60)
arxiv:///search/transformer+llm/    ← keyword search results
```

Every entry carries MCP annotations: `audience`, `priority`, and `lastModified`. Clients use these to prioritize what to read.

---

## Tools

All three tools return both `content` (MCP content blocks) and `structuredContent` (typed JSON matching the output schema).

### `arxiv_search`

Search using the full Atom API query syntax. Returns `resource_link` content blocks pointing to browsable paper directories.

```
ti:attention mechanism AND cat:cs.AI
au:lecun AND cat:cs.LG
cat:cs.CL AND ti:large language model
abs:diffusion model AND cat:cs.CV
```

### `arxiv_get_paper`

Fetch a paper by arXiv ID. Returns an **embedded** `metadata.json` resource (immediately readable) plus `resource_link` items for all paper files.

```
2501.12345      → new-style ID
cs/9901002      → old-style ID
```

### `arxiv_list_categories`

Full live taxonomy from the OAI-PMH API. Optional `group` filter: `cs`, `math`, `physics`, `econ`, `eess`, `q-bio`, `q-fin`, `stat`.

---

## MCP features used

- **`resources` capability** with `subscribe: true` and `listChanged: true`
- **Resource templates** — RFC 6570 `arxiv://{+path}` URI template
- **Resource annotations** — `audience`, `priority`, `lastModified` on every entry
- **`resources/subscribe`** — subscribe to `arxiv:///{cat}`, get `notifications/resources/updated` when new papers arrive (30-min poll)
- **`notifications/resources/list_changed`** — fires when a subscribed category's paper list changes
- **Embedded resources** — `arxiv_get_paper` returns metadata inline, no second fetch
- **Resource links** — tools return `type: "resource_link"` so clients can fetch or subscribe
- **Tool annotations** — `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`
- **Tool output schemas** — full JSON Schema on all three tools
- **Structured content** — `structuredContent` alongside `content` in every result
- **`isError`** — error paths return `isError: true` with actionable text for LLM self-correction

---

## Caching

| Data | TTL |
|---|---|
| OAI-PMH taxonomy | 24 hours |
| Paper metadata + search results | 1 hour |
| Extracted text, sections, references | 1 hour |
| LaTeX source | 1 hour |
| PDF text (fallback) | 1 hour |

arXiv rate-limits to ~3s between requests. The cache makes repeated navigation instant.

---

## Project structure

```
arxiv-mcp/
  server.ts                        ← entry point
  resources/arxiv.ts               ← arxiv:/// virtual filesystem + routing
  tools/
    arxiv_search.ts
    arxiv_get_paper.ts
    arxiv_list_categories.ts
  lib/
    api.ts                         ← OAI-PMH + Atom API
    extract.ts                     ← HTML extraction, sections, TeX tarball
    subscribe.ts                   ← resources/subscribe + 30-min polling
    cache.ts                       ← TTL in-memory cache
    helpers.ts
    schemas.ts
  .claude-plugin/plugin.json        ← Claude Code plugin manifest
  .codex-plugin/plugin.json         ← Codex CLI plugin manifest
  .cursor-plugin/plugin.json        ← Cursor plugin manifest
```

---

## License

MIT
