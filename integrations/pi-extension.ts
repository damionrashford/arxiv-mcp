/**
 * arXiv MCP extension for Pi coding agent
 *
 * Provides /arxiv-search, /arxiv-paper, and /arxiv-categories commands.
 *
 * Setup (two steps):
 *
 * 1. Install pi-mcp-adapter (if not already installed):
 *      pi install npm:pi-mcp-adapter
 *    Restart Pi after installation.
 *
 * 2. Add the arXiv server to .mcp.json in your project root:
 *      {
 *        "mcpServers": {
 *          "arxiv": {
 *            "command": "node",
 *            "args": ["--experimental-strip-types", "/path/to/arxiv-mcp/server.ts"],
 *            "directTools": ["arxiv_search", "arxiv_get_paper", "arxiv_list_categories"]
 *          }
 *        }
 *      }
 *
 * 3. Copy this file to:
 *      ~/.pi/agent/extensions/arxiv.ts   (global — all projects)
 *    or
 *      .pi/extensions/arxiv.ts           (project-local)
 *
 * Test with: pi -e ./integrations/pi-extension.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function arxivExtension(pi: ExtensionAPI) {
  pi.registerCommand("arxiv-search", {
    description: "Search arXiv papers — usage: /arxiv-search <query>",
    handler: async (args, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify(
          "Usage: /arxiv-search <query>  e.g. /arxiv-search transformer attention cs.AI",
          "warning"
        );
        return;
      }
      if (!ctx.isIdle()) {
        ctx.ui.notify("Agent is busy — try again when the current turn finishes.", "warning");
        return;
      }
      pi.sendUserMessage(
        `Search arXiv for papers about: ${args.trim()}\n\nUse the arxiv_search tool with appropriate field prefixes (ti:, au:, cat:, abs:) and return the top 5 results with title, authors, date, and a one-sentence abstract summary for each.`
      );
    },
  });

  pi.registerCommand("arxiv-paper", {
    description: "Fetch an arXiv paper by ID — usage: /arxiv-paper <id>",
    handler: async (args, ctx) => {
      const id = args.trim();
      if (!id) {
        ctx.ui.notify(
          "Usage: /arxiv-paper 2501.12345  (new-style) or cs/9901002 (old-style)",
          "warning"
        );
        return;
      }
      if (!ctx.isIdle()) {
        ctx.ui.notify("Agent is busy — try again when the current turn finishes.", "warning");
        return;
      }
      pi.sendUserMessage(
        `Fetch arXiv paper ${id} using arxiv_get_paper. Return: title, authors, published date, categories, abstract, and links (arXiv URL, PDF URL). If sections are accessible, summarize the key contributions from the introduction.`
      );
    },
  });

  pi.registerCommand("arxiv-categories", {
    description: "List arXiv categories — usage: /arxiv-categories [group]",
    handler: async (args, ctx) => {
      if (!ctx.isIdle()) {
        ctx.ui.notify("Agent is busy — try again when the current turn finishes.", "warning");
        return;
      }
      const group = args.trim();
      if (group) {
        pi.sendUserMessage(
          `List all arXiv categories in the "${group}" subject group using arxiv_list_categories with group="${group}".`
        );
      } else {
        pi.sendUserMessage(
          `List the available arXiv subject groups using arxiv_list_categories. Show a brief description of each top-level group (cs, math, physics, econ, eess, q-bio, q-fin, stat).`
        );
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    const tools = pi.getAllTools();
    const hasArxiv = tools.some((t) => t.name.startsWith("arxiv"));
    if (hasArxiv) {
      ctx.ui.notify(
        "arXiv ready — /arxiv-search <query>, /arxiv-paper <id>, /arxiv-categories [group]",
        "info"
      );
    }
  });
}
