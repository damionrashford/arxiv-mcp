import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listSets, getGroups, getCategoriesInGroup, specToCatId, searchPapers, fetchPaper } from '../lib/api.ts';
import { extractHtml, getPaperText, extractTex } from '../lib/extract.ts';
import { asst, notFound } from '../lib/helpers.ts';

export function register(server: McpServer): void {
  server.registerResource(
    'arxiv',
    new ResourceTemplate('arxiv://{+path}', {
      list: async () => ({
        resources: [{
          uri:         'arxiv:///',
          name:        'arXiv',
          title:       'arXiv Virtual Filesystem',
          description: 'Browse and read arXiv research papers as a navigable file tree',
          mimeType:    'inode/directory',
          annotations: asst(0.5),
        }],
      }),
    }),
    { title: 'arXiv Virtual Filesystem' },
    async (uri: URL) => {
      const raw   = uri.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      const parts = raw ? raw.split('/') : [];

      // ── root: list subject groups ───────────────────────────────────────────
      if (parts.length === 0) {
        const groups = await getGroups();
        return dir(uri, groups.map(g => ({
          uri:         `arxiv:///${g.spec}`,
          name:        g.spec,
          title:       g.name,
          description: g.name,
          mimeType:    'inode/directory',
          annotations: asst(0.5),
        })));
      }

      // ── /search ─────────────────────────────────────────────────────────────
      if (parts[0] === 'search') {
        if (parts.length === 1)
          return txt(uri, 'Navigate to arxiv:///search/{query} — spaces as + or %20');
        if (parts.length === 2) {
          const papers = await searchPapers(`all:${decodeURIComponent(parts[1])}`);
          return dir(uri, papers.map(p => paperEntry(`arxiv:///search/${parts[1]}/${p.id}`, p)));
        }
        if (parts.length === 3) return await paperDir(uri);
        if (parts.length === 4) return await paperFile(uri, parts[2], parts[3]);
        if (parts.length === 5 && parts[3] === 'sections')
          return await sectionFile(uri, parts[2], parts[4]);
        throw notFound(uri.href);
      }

      // ── /paper/{id} — direct lookup without knowing category ───────────────
      if (parts[0] === 'paper') {
        if (parts.length === 1) return txt(uri, 'Navigate to arxiv:///paper/{id}/ — e.g. arxiv:///paper/2501.12948/');
        if (parts.length === 2) return await paperDir(uri);
        if (parts.length === 3) {
          if (parts[2] === 'sections') return await sectionsDir(uri, parts[1]);
          return await paperFile(uri, parts[1], parts[2]);
        }
        if (parts.length === 4 && parts[2] === 'sections')
          return await sectionFile(uri, parts[1], parts[3]);
        throw notFound(uri.href);
      }

      // ── /{group} or /{cat} ──────────────────────────────────────────────────
      if (parts.length === 1) {
        const allSets = await listSets();
        if (allSets.some(s => s.spec === parts[0] && !s.spec.includes(':'))) {
          const cats = await getCategoriesInGroup(parts[0]);
          return dir(uri, cats.map(c => ({
            uri:         `arxiv:///${specToCatId(c.spec)}`,
            name:        specToCatId(c.spec),
            title:       c.name,
            description: c.name,
            mimeType:    'inode/directory',
            annotations: asst(0.6),
          })));
        }
        const papers = await searchPapers(`cat:${parts[0]}`);
        return dir(uri, papers.map(p => paperEntry(`arxiv:///${parts[0]}/${p.id}`, p)));
      }

      // ── /{cat}/{id} ─────────────────────────────────────────────────────────
      if (parts.length === 2) return await paperDir(uri);

      // ── /{cat}/{id}/{file-or-sections} ──────────────────────────────────────
      if (parts.length === 3) {
        if (parts[2] === 'sections') return await sectionsDir(uri, parts[1]);
        return await paperFile(uri, parts[1], parts[2]);
      }

      // ── /{cat}/{id}/sections/{slug} ─────────────────────────────────────────
      if (parts.length === 4 && parts[2] === 'sections')
        return await sectionFile(uri, parts[1], parts[3]);

      throw notFound(uri.href);
    }
  );
}

// ─── routing helpers ──────────────────────────────────────────────────────────

function dir(uri: URL, children: object[]) {
  return { contents: [{ uri: uri.href, mimeType: 'inode/directory', text: JSON.stringify(children, null, 2) }] };
}

function txt(uri: URL, text: string, mimeType = 'text/plain') {
  return { contents: [{ uri: uri.href, mimeType, text }] };
}

function paperEntry(uri: string, p: { id: string; title: string; updated: string }) {
  return {
    uri,
    name:        p.id,
    title:       p.title,
    description: p.title,
    mimeType:    'inode/directory',
    annotations: asst(0.7, p.updated),
  };
}

async function paperDir(uri: URL) {
  const paperId = uri.pathname.replace(/\/$/, '').split('/').pop()!;
  const paper   = await fetchPaper(paperId);
  const lm      = paper?.updated ?? new Date().toISOString();
  const base    = uri.href.replace(/\/$/, '');
  return dir(uri, [
    { uri: `${base}/metadata.json`,  name: 'metadata.json',  title: 'Metadata',     mimeType: 'application/json', size: 512,   annotations: asst(0.95, lm) },
    { uri: `${base}/abstract.txt`,   name: 'abstract.txt',   title: 'Abstract',     mimeType: 'text/plain',       size: 1024,  annotations: asst(0.9,  lm) },
    { uri: `${base}/paper.txt`,      name: 'paper.txt',      title: 'Full Text',    mimeType: 'text/plain',       size: 81920, annotations: asst(0.7,  lm) },
    { uri: `${base}/references.json`,name: 'references.json',title: 'References',   mimeType: 'application/json', size: 4096,  annotations: asst(0.75, lm) },
    { uri: `${base}/source.tex`,     name: 'source.tex',     title: 'LaTeX Source', mimeType: 'text/x-tex',       size: 65536, annotations: asst(0.5,  lm) },
    { uri: `${base}/sections`,       name: 'sections',       title: 'Sections',     mimeType: 'inode/directory',               annotations: asst(0.6      ) },
  ]);
}

async function paperFile(uri: URL, paperId: string, file: string) {
  const paper = await fetchPaper(paperId);
  if (!paper) throw notFound(uri.href);

  switch (file) {
    case 'abstract.txt':
      return txt(uri, paper.abstract);

    case 'metadata.json':
      return txt(uri, JSON.stringify({
        id:         paper.id,
        title:      paper.title,
        authors:    paper.authors,
        published:  paper.published,
        updated:    paper.updated,
        categories: paper.categories,
        doi:        paper.doi ?? null,
        arxivUrl:   `https://arxiv.org/abs/${paper.id}`,
        pdfUrl:     `https://arxiv.org/pdf/${paper.id}`,
        htmlUrl:    `https://arxiv.org/html/${paper.id}`,
      }, null, 2), 'application/json');

    case 'paper.txt': {
      const { text } = await getPaperText(paper.id);
      return txt(uri, text);
    }

    case 'source.tex': {
      const tex = await extractTex(paper.id);
      return txt(uri, tex ?? '% LaTeX source not available for this paper.', 'text/x-tex');
    }

    case 'references.json': {
      const html = await extractHtml(paper.id);
      return txt(uri, JSON.stringify(html?.references ?? [], null, 2), 'application/json');
    }

    default:
      throw notFound(uri.href);
  }
}

async function sectionsDir(uri: URL, paperId: string) {
  const html = await extractHtml(paperId);
  if (!html?.sections.length)
    return txt(uri, 'No sections available — HTML version not found for this paper.');
  const paper = await fetchPaper(paperId);
  const lm    = paper?.updated ?? new Date().toISOString();
  const base  = uri.href.replace(/\/$/, '');
  return dir(uri, html.sections.map(s => ({
    uri:         `${base}/${s.slug}.txt`,
    name:        `${s.slug}.txt`,
    title:       s.title,
    description: s.title,
    mimeType:    'text/plain',
    size:        Buffer.byteLength(s.text, 'utf8'),
    annotations: asst(0.6, lm),
  })));
}

async function sectionFile(uri: URL, paperId: string, slug: string) {
  const html    = await extractHtml(paperId);
  if (!html) throw notFound(uri.href);
  const section = html.sections.find(s => s.slug === slug.replace(/\.txt$/, ''));
  if (!section) throw notFound(uri.href);
  return txt(uri, `# ${section.title}\n\n${section.text}`);
}
