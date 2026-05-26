import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

// shared annotation builder for assistant-facing content
export const asst = (priority: number, lastModified?: string) => ({
  audience: ['assistant' as const],
  priority,
  ...(lastModified ? { lastModified } : {}),
});

// standard read-only tool annotations
export const READ_ONLY: ToolAnnotations = {
  readOnlyHint:    true,
  destructiveHint: false,
  idempotentHint:  true,
};

// JSON-RPC -32002 error (resource not found)
export function notFound(href: string): Error & { code: number } {
  const e = new Error(`Resource not found: ${href}`) as Error & { code: number };
  e.code = -32002;
  return e;
}
