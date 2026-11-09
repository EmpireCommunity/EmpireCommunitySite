// docs/contracts/site-data.md section 6 (D-7: link only what works today).
import { z } from 'astro/zod';
import { HttpsUrl, Id, Localized } from './common.ts';

export const ProjectSchema = z
  .strictObject({
    id: Id,
    name: z.string().trim().min(1).max(60), // brand name, not translated
    kind: z.enum(['bot', 'game-hosting', 'site', 'mod', 'infrastructure', 'tool']),
    status: z.enum(['live', 'in-development']),
    summary: Localized(160),
    url: HttpsUrl.optional(),
    repo: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).optional(), // only for a public repository
    order: z.number().int().min(0).max(10_000),
  })
  .superRefine((project, ctx) => {
    if (project.url !== undefined && project.status !== 'live') {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'url is allowed only when status is live (D-7)' });
    }
  });
export type Project = z.infer<typeof ProjectSchema>;
