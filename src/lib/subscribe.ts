import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { searchPapers } from './api.ts';
import { cset } from './cache.ts';

const POLL_INTERVAL = 30 * 60 * 1000; // 30 minutes

// uri → Set of paper IDs seen at last poll
const watchedUris = new Map<string, Set<string>>();
let timer: ReturnType<typeof setInterval> | null = null;

export function wireSubscriptions(mcp: McpServer): void {
  const lowLevel = mcp.server;

  lowLevel.setRequestHandler(SubscribeRequestSchema, async (req) => {
    const { uri } = req.params;
    if (!watchedUris.has(uri)) {
      // snapshot current papers so we can diff later
      const known = await snapshotUri(uri);
      watchedUris.set(uri, known);
    }
    ensurePolling(mcp);
    return {};
  });

  lowLevel.setRequestHandler(UnsubscribeRequestSchema, async (req) => {
    watchedUris.delete(req.params.uri);
    if (watchedUris.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
    return {};
  });
}

function ensurePolling(mcp: McpServer): void {
  if (timer) return;
  timer = setInterval(() => poll(mcp), POLL_INTERVAL);
}

async function poll(mcp: McpServer): Promise<void> {
  for (const [uri, known] of watchedUris) {
    try {
      const fresh = await snapshotUri(uri);
      const hasNew = [...fresh].some(id => !known.has(id));
      if (hasNew) {
        watchedUris.set(uri, fresh);
        // invalidate cache so next read returns fresh data
        const cat = uriToCategory(uri);
        if (cat) cset(`atom:cat:${cat}:0:25`, null, 0);
        await mcp.server.sendResourceUpdated({ uri });
        await mcp.server.sendResourceListChanged();
      }
    } catch {
      // don't crash the poll loop on transient errors
    }
  }
}

async function snapshotUri(uri: string): Promise<Set<string>> {
  const cat = uriToCategory(uri);
  if (!cat) return new Set();
  const papers = await searchPapers(`cat:${cat}`, 0, 25);
  return new Set(papers.map(p => p.id));
}

// arxiv:///cs.AI  →  "cs.AI"
function uriToCategory(uri: string): string | null {
  const m = uri.match(/^arxiv:\/\/\/([^/]+)$/);
  return m?.[1] ?? null;
}
