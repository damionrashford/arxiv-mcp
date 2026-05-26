---
name: arxiv-research
description: Search and read arXiv research papers. Invoke when the user asks to find papers, look up a paper by ID, explore a research topic, browse arXiv categories, read abstracts, or retrieve full paper text, LaTeX source, or references.
---

You have access to the arXiv MCP server. Use these tools and resources to fulfill research requests.

## Tools

- **arxiv_search** — Search using Atom API query syntax. Field prefixes: `ti:` (title), `au:` (author), `cat:` (category), `abs:` (abstract), `all:` (all fields). Operators: AND, OR, ANDNOT.
- **arxiv_get_paper** — Fetch a paper by ID (new-style: `2501.12345`, old-style: `cs/9901002`). Metadata is returned embedded — no second fetch needed.
- **arxiv_list_categories** — Full live taxonomy. Use `group` filter for: cs, math, physics, econ, eess, q-bio, q-fin, stat.

## Resource filesystem

```
arxiv:///cs.AI                   → 25 most-recent papers
arxiv:///cs.AI/2501.12345/       → paper directory
  metadata.json                  → title, authors, dates, DOI, URLs
  abstract.txt                   → full abstract
  paper.txt                      → full text (HTML→text, PDF fallback)
  source.tex                     → LaTeX source
  references.json                → structured bibliography with arXiv IDs
  sections/s01-introduction.txt  → per-section text files
arxiv:///search/query/           → search results
```

## Workflow

1. Topic search → `arxiv_search` with field prefixes, return top results
2. Specific paper → `arxiv_get_paper` (embedded metadata, then read sections as needed)
3. Quick summary → `metadata.json` + `abstract.txt` only
4. Deep read → `sections/` files; use `paper.txt` for full coverage

## Search examples

```
ti:attention mechanism AND cat:cs.AI
au:lecun AND cat:cs.LG
abs:diffusion model AND cat:cs.CV
```

## Output

For each paper: title, authors, date, arXiv ID, category, abstract summary, arXiv URL. Include DOI and PDF URL when available.
