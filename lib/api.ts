import { XMLParser } from 'fast-xml-parser';
import { cget, cset, HOUR, DAY } from './cache.ts';

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  trimValues: true,
});

// ─── types ────────────────────────────────────────────────────────────────────

export interface OaiSet { spec: string; name: string }

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  published: string;
  updated: string;
  doi?: string;
}

// ─── OAI-PMH taxonomy ─────────────────────────────────────────────────────────

export async function listSets(): Promise<OaiSet[]> {
  const cached = cget<OaiSet[]>('oai:sets');
  if (cached) return cached;

  const sets: OaiSet[] = [];
  let token: string | undefined;

  do {
    const url = token
      ? `https://oaipmh.arxiv.org/oai?verb=ListSets&resumptionToken=${encodeURIComponent(token)}`
      : `https://oaipmh.arxiv.org/oai?verb=ListSets`;

    const body = await fetch(url).then(r => r.text());
    const doc  = xml.parse(body)['OAI-PMH'];
    const ls   = doc?.ListSets;
    const raw  = ls?.set ?? [];
    const arr  = Array.isArray(raw) ? raw : [raw];

    for (const s of arr) {
      const spec = String(s.setSpec ?? '').trim();
      const name = String(s.setName ?? '').trim();
      if (spec) sets.push({ spec, name });
    }

    const rt = ls?.resumptionToken;
    token = typeof rt === 'string' && rt.trim() ? rt.trim() : undefined;
    if (token) await new Promise(r => setTimeout(r, 3000));
  } while (token);

  cset('oai:sets', sets, DAY);
  return sets;
}

// "cs:cs:AI" → "cs.AI",  "physics:hep-th" → "hep-th",  "cs" → "cs"
export function specToCatId(spec: string): string {
  const p = spec.split(':');
  if (p.length === 1) return p[0];
  if (p.length === 2) return p[1];
  return `${p[1]}.${p[2]}`;
}

export async function getGroups(): Promise<OaiSet[]> {
  const sets = await listSets();
  return sets.filter(s => !s.spec.includes(':'));
}

export async function getCategoriesInGroup(group: string): Promise<OaiSet[]> {
  const sets = await listSets();
  return sets.filter(s => s.spec.startsWith(`${group}:`) && s.spec !== group);
}

// ─── Atom API ─────────────────────────────────────────────────────────────────

const ATOM_BASE = 'https://export.arxiv.org/api/query';

export async function searchPapers(query: string, start = 0, max = 25): Promise<Paper[]> {
  const key = `atom:${query}:${start}:${max}`;
  const cached = cget<Paper[]>(key);
  if (cached) return cached;

  const url = `${ATOM_BASE}?${new URLSearchParams({
    search_query: query,
    start: String(start),
    max_results: String(max),
    sortBy: 'lastUpdatedDate',
    sortOrder: 'descending',
  })}`;

  const body = await fetch(url).then(r => r.text());
  if (body.trim().startsWith('Rate exceeded')) throw new Error('arXiv rate limit — wait 3s between calls');
  const papers = parseAtomFeed(body);
  cset(key, papers, HOUR);
  return papers;
}

export async function fetchPaper(id: string): Promise<Paper | null> {
  const key = `paper:${id}`;
  const cached = cget<Paper>(key);
  if (cached) return cached;

  const body = await fetch(`${ATOM_BASE}?id_list=${encodeURIComponent(id)}`).then(r => r.text());
  if (body.trim().startsWith('Rate exceeded')) throw new Error('arXiv rate limit — wait 3s between calls');
  const papers = parseAtomFeed(body);
  if (papers[0]) cset(key, papers[0], HOUR);
  return papers[0] ?? null;
}

export function parseAtomFeed(body: string): Paper[] {
  const feed = xml.parse(body)?.feed;
  if (!feed?.entry) return [];

  const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
  return entries.map((e: any): Paper => {
    const rawId = String(e.id ?? '');
    const id    = rawId.replace(/https?:\/\/arxiv\.org\/abs\//, '').replace(/v\d+$/, '');

    const authors = Array.isArray(e.author)
      ? e.author.map((a: any) => String(a.name ?? ''))
      : e.author?.name ? [String(e.author.name)] : [];

    const cats = Array.isArray(e.category)
      ? e.category.map((c: any) => String(c['@_term'] ?? ''))
      : e.category?.['@_term'] ? [String(e.category['@_term'])] : [];

    const doi = e['arxiv:doi'] ?? e.doi;

    return {
      id,
      title:      String(e.title   ?? '').replace(/\s+/g, ' ').trim(),
      abstract:   String(e.summary ?? '').replace(/\s+/g, ' ').trim(),
      authors:    authors.filter(Boolean),
      categories: cats.filter(Boolean),
      published:  String(e.published ?? ''),
      updated:    String(e.updated   ?? ''),
      doi:        doi ? String(doi).trim() : undefined,
    };
  });
}
