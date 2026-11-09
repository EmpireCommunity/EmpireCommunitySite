// Reads of the data collections for the pages (docs/contracts/site-data.md). Every join link in the UI goes to
// `links.discord` (R-5, D-41); a channel's own `url` is deliberately never returned from here, because the WhatsApp
// group link is read only by the /discord page.
import { getCollection, getEntry } from 'astro:content';
import { t } from '../i18n/index.ts';
import type { Locale } from './routes.ts';

export async function getSite() {
  const entry = await getEntry('site', 'site');
  if (entry === undefined) throw new Error('src/data/site.yaml is missing');
  return entry.data;
}

export async function getCommunity() {
  const entry = await getEntry('community', 'community');
  if (entry === undefined) throw new Error('src/data/community.yaml is missing');
  return entry.data;
}

export interface JoinChannel {
  id: string;
  label: string;
  description: string;
}

/** The channels whose audience includes the locale, in file order (Discord first). No `url`, on purpose. */
export async function getJoinChannels(locale: Locale): Promise<JoinChannel[]> {
  const entries = await getCollection('joinChannels');
  return entries.flatMap(({ data }) => {
    const label = data.label[locale];
    const description = data.description[locale];
    return data.audience.includes(locale) && label !== undefined && description !== undefined
      ? [{ id: data.id, label, description }]
      : [];
  });
}

/** "no Discord e no WhatsApp" / "on Discord": one phrase per channel, joined as the language does. */
export function channelPhrase(locale: Locale, channels: readonly JoinChannel[], type: 'conjunction' | 'disjunction'): string {
  const lang = locale === 'pt-br' ? 'pt-BR' : 'en-US';
  return new Intl.ListFormat(lang, { style: 'long', type }).format(
    channels.map((channel) => t(locale, 'channel.in', { channel: channel.label })),
  );
}
