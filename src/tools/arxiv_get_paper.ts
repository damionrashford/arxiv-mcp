import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceLink, EmbeddedResource, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { fetchPaper } from '../lib/api.ts';
import { asst, READ_ONLY } from '../lib/helpers.ts';
import { PaperResult } from '../lib/schemas.ts';

export function register(server: McpServer): void {
  server.registerTool(
    'arxiv_get_paper',
    {
      title:       'Get arXiv Paper',
      description: [
        'Fetch full metadata for an arXiv paper by ID.',
        'Returns an embedded metadata.json block plus resource links to all paper files:',
        'abstract, full text, LaTeX source, structured references, and per-section files.',
      ].join(' '),
      annotations: { ...READ_ONLY, openWorldHint: false },
      inputSchema: {
        id: z.string().describe('arXiv paper ID — e.g. "2501.12345" or "cs/9901002"'),
      },
      outputSchema: { paper: PaperResult.nullable() },
    },
    async ({ id }): Promise<CallToolResult> => {
      const paper = await fetchPaper(id);

      if (!paper) {
        return {
          isError:           true,
          content:           [{ type: 'text', text: `Paper not found: ${id}` }],
          structuredContent: { paper: null },
        };
      }

      const cat  = paper.categories[0] ?? 'cs';
      const base = `arxiv:///${cat}/${paper.id}`;
      const lm   = paper.updated;

      const metadata: z.infer<typeof PaperResult> = {
        id:          paper.id,
        title:       paper.title,
        authors:     paper.authors,
        published:   paper.published,
        updated:     paper.updated,
        categories:  paper.categories,
        doi:         paper.doi ?? null,
        arxivUrl:    `https://arxiv.org/abs/${paper.id}`,
        pdfUrl:      `https://arxiv.org/pdf/${paper.id}`,
        htmlUrl:     `https://arxiv.org/html/${paper.id}`,
        resourceUri: base,
      };

      const embedded: EmbeddedResource = {
        type: 'resource',
        resource: {
          uri:      `${base}/metadata.json`,
          mimeType: 'application/json',
          text:     JSON.stringify(metadata, null, 2),
        },
        annotations: asst(0.95, lm),
      };

      const links: ResourceLink[] = [
        { type: 'resource_link', uri: `${base}/abstract.txt`,   name: 'abstract.txt',   title: 'Abstract',     mimeType: 'text/plain',       annotations: asst(0.9,  lm) },
        { type: 'resource_link', uri: `${base}/paper.txt`,      name: 'paper.txt',      title: 'Full Text',    mimeType: 'text/plain',       annotations: asst(0.7,  lm) },
        { type: 'resource_link', uri: `${base}/references.json`,name: 'references.json',title: 'References',   mimeType: 'application/json', annotations: asst(0.75, lm) },
        { type: 'resource_link', uri: `${base}/source.tex`,     name: 'source.tex',     title: 'LaTeX Source', mimeType: 'text/x-tex',       annotations: asst(0.5,  lm) },
        { type: 'resource_link', uri: `${base}/sections`,       name: 'sections',       title: 'Sections',     mimeType: 'inode/directory',  annotations: asst(0.6      ) },
      ];

      return {
        content:           [embedded, ...links],
        structuredContent: { paper: metadata },
      };
    }
  );
}
