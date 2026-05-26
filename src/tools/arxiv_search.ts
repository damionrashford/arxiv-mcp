import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceLink, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { searchPapers } from '../lib/api.ts';
import { asst, READ_ONLY } from '../lib/helpers.ts';
import { PaperResult } from '../lib/schemas.ts';

const SearchResult = z.object({
  query:  z.string(),
  count:  z.number(),
  papers: z.array(
    PaperResult
      .omit({ doi: true, arxivUrl: true, pdfUrl: true, htmlUrl: true })
      .extend({ description: z.string() })
  ),
});

export function register(server: McpServer): void {
  server.registerTool(
    'arxiv_search',
    {
      title:       'Search arXiv Papers',
      description: [
        'Search arXiv and return papers as resource links for direct reading.',
        'Field prefixes: ti:(title)  au:(author)  cat:(category)  abs:(abstract)  all:(all fields).',
        'Boolean operators: AND  OR  ANDNOT.',
        'Example: "ti:transformer AND cat:cs.AI"',
      ].join(' '),
      annotations: { ...READ_ONLY, openWorldHint: true },
      inputSchema: {
        query:      z.string().describe('arXiv search query string'),
        maxResults: z.number().int().min(1).max(50).default(10).describe('Number of results'),
        start:      z.number().int().min(0).default(0).describe('Pagination offset'),
      },
      outputSchema: { results: SearchResult },
    },
    async ({ query, maxResults = 10, start = 0 }): Promise<CallToolResult> => {
      const papers = await searchPapers(query, start, maxResults);

      const links: ResourceLink[] = papers.map(p => ({
        type:        'resource_link' as const,
        uri:         `arxiv:///${p.categories[0] ?? 'cs'}/${p.id}`,
        name:        p.id,
        title:       p.title,
        description: `${p.authors.slice(0, 3).join(', ')} · ${p.published.slice(0, 10)} · ${p.categories.join(', ')}`,
        mimeType:    'inode/directory',
        annotations: asst(0.8, p.updated),
      }));

      const structured: z.infer<typeof SearchResult> = {
        query,
        count: papers.length,
        papers: papers.map(p => ({
          id:          p.id,
          title:       p.title,
          authors:     p.authors,
          published:   p.published,
          updated:     p.updated,
          categories:  p.categories,
          resourceUri: `arxiv:///${p.categories[0] ?? 'cs'}/${p.id}`,
          description: `${p.authors.slice(0, 3).join(', ')} · ${p.published.slice(0, 10)}`,
        })),
      };

      return {
        content:          links,
        structuredContent: { results: structured },
      };
    }
  );
}
