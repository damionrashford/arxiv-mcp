import { parse as parseHtml } from 'node-html-parser';
import { extract as tarExtract } from 'tar-stream';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { PDFParse } from 'pdf-parse';
import { cget, cset, HOUR } from './cache.ts';

// ─── types ────────────────────────────────────────────────────────────────────

export interface Section { slug: string; title: string; text: string }
export interface Reference { num: string; text: string; arxivId?: string }

export interface Extracted {
  text: string;           // full paper text (single line)
  sections: Section[];    // ordered section files
  references: Reference[];
  source: 'html' | 'pdf';
}

const UA = 'arxiv-mcp/2.0 (research tool; mailto:research@example.com)';

// ─── HTML extraction ─────────────────────────────────────────────────────────

export async function extractHtml(paperId: string): Promise<Extracted | null> {
  const key = `html:${paperId}`;
  const cached = cget<Extracted>(key);
  if (cached) return cached;

  const res = await fetch(`https://arxiv.org/html/${paperId}`, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  });
  if (!res.ok) return null;

  const html = await res.text();
  const root = parseHtml(html);

  // ── sections ──────────────────────────────────────────────────────────────
  const sectionEls = root.querySelectorAll('section.ltx_section, section.ltx_appendix, div.ltx_section, div.ltx_appendix');
  const sections: Section[] = [];
  const allText: string[] = [];

  let idx = 0;
  for (const el of sectionEls) {
    const titleEl = el.querySelector('.ltx_title');
    const rawTitle = titleEl?.innerText?.replace(/\s+/g, ' ').trim() ?? `Section ${idx + 1}`;

    // strip math blocks, figure captions, and nested subsections from text
    const clone = parseHtml(el.outerHTML);
    clone.querySelectorAll('.ltx_equation, .ltx_figure, .ltx_Math, .ltx_note').forEach(n => {
      if (n.classList?.contains('ltx_equation') || n.classList?.contains('ltx_Math')) {
        n.replaceWith('[MATH]');
      } else if (n.classList?.contains('ltx_figure')) {
        const cap = n.querySelector('.ltx_caption')?.innerText?.trim();
        n.replaceWith(cap ? `[FIGURE: ${cap}]` : '[FIGURE]');
      } else {
        n.remove();
      }
    });
    // also remove nested subsection elements so they appear as separate sections
    clone.querySelectorAll('section.ltx_subsection, div.ltx_subsection').forEach(n => n.remove());

    const text = clone.innerText?.replace(/\s+/g, ' ').trim() ?? '';
    if (!text) continue;

    const slug = `s${String(idx + 1).padStart(2, '0')}-${rawTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)}`;

    sections.push({ slug, title: rawTitle, text });
    allText.push(text);
    idx++;
  }

  // ── full text fallback (if no sections found) ─────────────────────────────
  if (sections.length === 0) {
    const body = root.querySelector('body') ?? root;
    root.querySelectorAll('.ltx_equation, .ltx_Math').forEach(n => n.replaceWith('[MATH]'));
    root.querySelectorAll('.ltx_figure').forEach(n => {
      const cap = n.querySelector('.ltx_caption')?.innerText?.trim();
      n.replaceWith(cap ? `[FIGURE: ${cap}]` : '[FIGURE]');
    });
    allText.push(body.innerText?.replace(/\s+/g, ' ').trim() ?? '');
  }

  // ── references ────────────────────────────────────────────────────────────
  const references: Reference[] = [];
  const bibEls = root.querySelectorAll('li.ltx_bibitem, div.ltx_bibitem');
  for (const bib of bibEls) {
    const tag = bib.querySelector('.ltx_bibtag, .ltx_tag')?.innerText?.trim()
                  .replace(/^\[|\]$/g, '') ?? '';
    const text = bib.innerText?.replace(/\s+/g, ' ').trim() ?? '';
    // extract arXiv ID from href
    const arxivHref = bib.querySelector('a[href*="arxiv.org"]')?.getAttribute('href') ?? '';
    const arxivMatch = arxivHref.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]+|[a-z\-]+\/[0-9]+)/i);
    references.push({ num: tag, text, arxivId: arxivMatch?.[1] });
  }

  const result: Extracted = {
    text: allText.join(' ').replace(/\s+/g, ' ').trim(),
    sections,
    references,
    source: 'html',
  };

  cset(key, result, HOUR);
  return result;
}

// ─── PDF fallback ─────────────────────────────────────────────────────────────

export async function extractPdf(paperId: string): Promise<string | null> {
  const key = `pdf:${paperId}`;
  const cached = cget<string>(key);
  if (cached) return cached;

  const res = await fetch(`https://arxiv.org/pdf/${paperId}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) return null;

  const buf = new Uint8Array(await res.arrayBuffer());
  const result = await new PDFParse({ data: buf }).getText();
  const text = (result as { text: string }).text.replace(/\s+/g, ' ').trim();
  cset(key, text, HOUR);
  return text;
}

// ─── paper.txt: HTML-first, PDF fallback ─────────────────────────────────────

export async function getPaperText(paperId: string): Promise<{ text: string; source: 'html' | 'pdf' }> {
  const html = await extractHtml(paperId);
  if (html?.text) return { text: html.text, source: 'html' };

  const pdf = await extractPdf(paperId);
  if (pdf) return { text: pdf, source: 'pdf' };

  throw new Error(`Could not extract text for ${paperId} via HTML or PDF`);
}

// ─── TeX source from tarball ─────────────────────────────────────────────────

export async function extractTex(paperId: string): Promise<string | null> {
  const key = `tex:${paperId}`;
  const cached = cget<string>(key);
  if (cached) return cached;

  const res = await fetch(`https://arxiv.org/src/${paperId}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) return null;

  const buf = Buffer.from(await res.arrayBuffer());
  const tex = await parseTarGz(buf);
  if (tex) cset(key, tex, HOUR);
  return tex;
}

async function parseTarGz(buf: Buffer): Promise<string | null> {
  return new Promise((resolve) => {
    const candidates: { name: string; content: string }[] = [];

    const extract = tarExtract();
    extract.on('entry', (header, stream, next) => {
      if (!header.name.endsWith('.tex')) {
        stream.resume();
        stream.on('end', next);
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf8');
        candidates.push({ name: header.name, content });
        next();
      });
      stream.on('error', () => { stream.resume(); next(); });
    });

    extract.on('finish', () => {
      if (candidates.length === 0) { resolve(null); return; }

      // prefer file with \documentclass (main file), then largest .tex
      const withDocclass = candidates.filter(c => c.content.includes('\\documentclass'));
      const pool = withDocclass.length > 0 ? withDocclass : candidates;
      const main = pool.reduce((a, b) => b.content.length > a.content.length ? b : a);
      resolve(main.content);
    });

    extract.on('error', () => {
      // might be a plain .gz (single .tex file), try gunzip directly
      const readable = Readable.from([buf]);
      const gunzip = createGunzip();
      const chunks: Buffer[] = [];
      readable.pipe(gunzip);
      gunzip.on('data', (c: Buffer) => chunks.push(c));
      gunzip.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      gunzip.on('error', () => resolve(null));
    });

    // pipe buf → gunzip → tar
    const readable = Readable.from([buf]);
    const gunzip = createGunzip();
    readable.pipe(gunzip).pipe(extract);
  });
}
