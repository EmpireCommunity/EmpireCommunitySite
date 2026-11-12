// docs/contracts/site-data.md section 8 (D-3, D-78). Discord routes are derived; WhatsApp is pt-BR only (C-1).
import { z } from 'astro/zod';
import { Audience, assertKeysEqualAudience, HttpsUrl, Id, LocalizedFor } from './common.ts';

const ChannelFields = z.strictObject({
  id: Id,
  audience: Audience,
  label: LocalizedFor(40),
  description: LocalizedFor(200),
});

// The union also lets consumers narrow WhatsApp to a required URL without changing the existing reader API.
export const JoinChannelSchema = z.union([
  ChannelFields.extend({ id: z.literal('discord'), url: z.never().optional() }),
  ChannelFields.extend({ id: Id.refine((id) => id !== 'discord', 'discord has no url: use routePath'), url: HttpsUrl }),
]).superRefine((channel, ctx) => {
  assertKeysEqualAudience(ctx, 'label', channel.label, channel.audience);
  assertKeysEqualAudience(ctx, 'description', channel.description, channel.audience);
  if (channel.id === 'discord' && channel.audience.length !== 2) {
    ctx.addIssue({ code: 'custom', path: ['audience'], message: 'discord audience is both locales' });
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
