import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceLink, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { listSets, getCategoriesInGroup, specToCatId } from '../lib/api.ts';
import { asst, READ_ONLY } from '../lib/helpers.ts';

const CategoryResult = z.object({
  categories: z.array(z.object({
    spec:        z.string(),
    categoryId:  z.string(),
    name:        z.string(),
    resourceUri: z.string(),
  })),
});

export function register(server: McpServer): void {
  server.registerTool(
    'arxiv_list_categories',
    {
      title:       'List arXiv Categories',
      description: [
        'List all arXiv subject categories from the live OAI-PMH taxonomy.',
        'Pass group to filter by top-level subject area.',
        'Valid groups: cs, math, physics, econ, eess, q-bio, q-fin, stat.',
      ].join(' '),
      annotations: { ...READ_ONLY, openWorldHint: false },
      inputSchema: {
        group: z.string().optional().describe('Subject group to filter by — e.g. "cs", "math"'),
      },
      outputSchema: { results: CategoryResult },
    },
    async ({ group }): Promise<CallToolResult> => {
      const sets = group ? await getCategoriesInGroup(group) : await listSets();

      const links: ResourceLink[] = sets.map(s => ({
        type:        'resource_link' as const,
        uri:         `arxiv:///${specToCatId(s.spec)}`,
        name:        specToCatId(s.spec),
        title:       s.name,
        description: s.name,
        mimeType:    'inode/directory',
        annotations: asst(0.6),
      }));

      const structured: z.infer<typeof CategoryResult> = {
        categories: sets.map(s => ({
          spec:        s.spec,
          categoryId:  specToCatId(s.spec),
          name:        s.name,
          resourceUri: `arxiv:///${specToCatId(s.spec)}`,
        })),
      };

      return {
        content:           links,
        structuredContent: { results: structured },
      };
    }
  );
}
