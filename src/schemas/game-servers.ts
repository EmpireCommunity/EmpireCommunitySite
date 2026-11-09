// docs/contracts/site-data.md section 7. No address, IP or port exists in the schema (strict object).
import { z } from 'astro/zod';
import { Id, Localized } from './common.ts';

export const GameServerSchema = z
  .strictObject({
    id: Id,
    name: z.string().trim().min(1).max(60),
    status: z.enum(['live', 'coming-soon']),
    summary: Localized(160),
    howToJoin: Localized(200).optional(),
  })
  .superRefine((server, ctx) => {
    if (server.status === 'live' && server.howToJoin === undefined) {
      ctx.addIssue({ code: 'custom', path: ['howToJoin'], message: 'howToJoin is required when status is live' });
    }
    if (server.status !== 'live' && server.howToJoin !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['howToJoin'], message: 'howToJoin is forbidden unless status is live' });
    }
  });
export type GameServer = z.infer<typeof GameServerSchema>;
