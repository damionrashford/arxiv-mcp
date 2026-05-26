import { z } from 'zod';

// shared paper shape — used by both arxiv_search and arxiv_get_paper
export const PaperResult = z.object({
  id:          z.string(),
  title:       z.string(),
  authors:     z.array(z.string()),
  published:   z.string(),
  updated:     z.string(),
  categories:  z.array(z.string()),
  doi:         z.string().nullable(),
  arxivUrl:    z.string(),
  pdfUrl:      z.string(),
  htmlUrl:     z.string(),
  resourceUri: z.string(),
});

export type PaperResultType = z.infer<typeof PaperResult>;
