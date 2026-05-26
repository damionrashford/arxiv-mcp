import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { wireSubscriptions } from './lib/subscribe.ts';
import { register as registerArxiv } from './resources/arxiv.ts';
import { register as registerSearch } from './tools/arxiv_search.ts';
import { register as registerGetPaper } from './tools/arxiv_get_paper.ts';
import { register as registerListCategories } from './tools/arxiv_list_categories.ts';

const server = new McpServer(
  { name: 'arxiv-vfs', version: '2.0.0' },
  {
    capabilities: { resources: { subscribe: true, listChanged: true } },
    instructions: `\
arXiv Virtual Filesystem — browse and read arXiv papers as a navigable file tree.

## URI scheme: arxiv:///

  arxiv:///                       → top-level subject groups (cs, math, physics, …)
  arxiv:///{group}                → categories within a group
  arxiv:///{cat}                  → 25 most-recent papers in a category
  arxiv:///{cat}/{id}/            → paper directory (6 files + sections/)
    abstract.txt                  · full abstract (priority 0.9)
    metadata.json                 · title, authors, dates, DOI, URLs (priority 0.95)
    paper.txt                     · full paper text via HTML→text or PDF fallback (priority 0.7)
    source.tex                    · main LaTeX source from tarball (priority 0.5)
    references.json               · structured bibliography with arXiv IDs (priority 0.75)
    sections/                     · per-section text files (priority 0.6)
      s01-introduction.txt
      s02-related-work.txt  …
  arxiv:///search/{query}/        → keyword search results
  arxiv:///search/{query}/{id}/   → paper directory via search result

## Tools

  arxiv_search — search with field prefixes (ti: au: cat: abs: all:) and AND/OR/ANDNOT
  arxiv_get_paper — metadata + all resource links for a paper by ID
  arxiv_list_categories — live OAI-PMH taxonomy, optionally filtered by group

## Subscriptions

  Subscribe to arxiv:///{cat} to receive notifications/resources/updated when new papers
  arrive. Server polls every 30 min. Unsubscribe to stop.

## Rate limits

  arXiv asks for 3s between requests. Taxonomy cached 24h, papers/search cached 1h.`,
  }
);

wireSubscriptions(server);
registerArxiv(server);
registerSearch(server);
registerGetPaper(server);
registerListCategories(server);

await server.connect(new StdioServerTransport());
