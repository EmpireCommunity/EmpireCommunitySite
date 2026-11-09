// docs/contracts/site-data.md section 8 (D-3). WhatsApp is pt-BR only (C-1).
import { z } from 'astro/zod';
import { Audience, assertKeysEqualAudience, HttpsUrl, Id, LocalizedFor } from './common.ts';
import { DISCORD_URL } from './site.ts';

export const JoinChannelSchema = z
  .strictObject({
    id: Id,
    url: HttpsUrl,
    audience: Audience,
    label: LocalizedFor(40),
    description: LocalizedFor(200),
  })
  .superRefine((channel, ctx) => {
    assertKeysEqualAudience(ctx, 'label', channel.label, channel.audience);
    assertKeysEqualAudience(ctx, 'description', channel.description, channel.audience);
    if (channel.id === 'discord') {
      if (channel.url !== DISCORD_URL) {
        ctx.addIssue({ code: 'custom', path: ['url'], message: `discord url must be ${DISCORD_URL}` });
      }
      if (channel.audience.length !== 2) {
        ctx.addIssue({ code: 'custom', path: ['audience'], message: 'discord audience is both locales' });
      }
    }
    if (channel.id === 'whatsapp') {
      if (channel.audience.length !== 1 || channel.audience[0] !== 'pt-br') {
        ctx.addIssue({ code: 'custom', path: ['audience'], message: 'whatsapp audience is exactly [pt-br]' });
      }
      if (!channel.url.startsWith('https://chat.whatsapp.com/')) {
        ctx.addIssue({ code: 'custom', path: ['url'], message: 'whatsapp url must be a chat.whatsapp.com group link' });
      }
    }
  });
export type JoinChannel = z.infer<typeof JoinChannelSchema>;
