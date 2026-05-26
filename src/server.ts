import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { wireSubscriptions } from './lib/subscribe.ts';
import { register as registerArxiv } from './resources/arxiv.ts';

const server = new McpServer(
  { name: 'arxiv-vfs', version: '2.0.0' },
  {
    capabilities: { resources: { subscribe: true, listChanged: true } },
    instructions: `\
arXiv is a navigable virtual filesystem. Read resources directly — no tools needed.

## Navigate by reading arxiv:/// URIs

  arxiv:///                         → subject groups (cs, math, physics, …)
  arxiv:///{group}                  → categories in a group  (e.g. arxiv:///cs)
  arxiv:///{cat}                    → 25 most-recent papers  (e.g. arxiv:///cs.AI)
  arxiv:///paper/{id}/              → paper directory by ID  (e.g. arxiv:///paper/2501.12948/)
  arxiv:///{cat}/{id}/              → paper directory by category + ID
  arxiv:///search/{query}/          → search results         (spaces as +)
  arxiv:///search/{query}/{id}/     → paper directory via search

## Paper directory files

  metadata.json   · title, authors, dates, DOI, URLs         (priority 0.95)
  abstract.txt    · full abstract                             (priority 0.90)
  references.json · structured bibliography with arXiv IDs   (priority 0.75)
  paper.txt       · full text via HTML→text, PDF fallback     (priority 0.70)
  sections/       · per-section text files                    (priority 0.60)
  source.tex      · main LaTeX from source tarball            (priority 0.50)

## Typical workflows

  Browse a topic:   arxiv:/// → arxiv:///cs → arxiv:///cs.LG → pick a paper
  Search:           arxiv:///search/diffusion+model/ → pick a result
  Jump to paper:    arxiv:///paper/2501.12948/ → read abstract.txt or paper.txt

## Subscriptions

  Subscribe to arxiv:///{cat} for notifications/resources/updated when new papers arrive.
  Server polls every 30 min.

## Rate limits

  arXiv asks for ≥3s between requests. Taxonomy cached 24h, papers/search cached 1h.`,
  }
);

wireSubscriptions(server);
registerArxiv(server);

await server.connect(new StdioServerTransport());
