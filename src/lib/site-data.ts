// Reads of the data collections for the pages (docs/contracts/site-data.md). Every join link in the UI goes to
// `routePath(locale, 'discord')` (D-78); a channel's own `url` is deliberately never returned from here, because the WhatsApp
// group link is read only by the pt-BR gate page.
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

/** Discord is always first (D-3, R-5): the other channels follow by id, because the collection has no order field. */
const CHANNEL_FIRST = 'discord';

/** The channels whose audience includes the locale, Discord first, then the others by id. No `url`, on purpose. */
export async function getJoinChannels(locale: Locale): Promise<JoinChannel[]> {
  const entries = await getCollection('joinChannels');
  return entries
    .flatMap(({ data }) => {
      const label = data.label[locale];
      const description = data.description[locale];
      return data.audience.includes(locale) && label !== undefined && description !== undefined
        ? [{ id: data.id, label, description }]
        : [];
    })
    .sort((a, b) => Number(b.id === CHANNEL_FIRST) - Number(a.id === CHANNEL_FIRST) || a.id.localeCompare(b.id));
}

/** "no Discord e no WhatsApp" / "on Discord": one phrase per channel, joined as the language does. */
export function channelPhrase(locale: Locale, channels: readonly JoinChannel[], type: 'conjunction' | 'disjunction'): string {
  const lang = locale === 'pt-br' ? 'pt-BR' : 'en-US';
  return new Intl.ListFormat(lang, { style: 'long', type }).format(
    channels.map((channel) => t(locale, 'channel.in', { channel: channel.label })),
  );
}

export interface TeamPerson {
  id: string;
  name: string | undefined;
  nickname: string | undefined;
  role: string;
  bio: string | undefined;
  githubUrls: string[];
}

/**
 * The only read of `team.yaml` (personal data, site-data section 9). The collection schema has already refused an entry
 * without a valid consent block or with a field outside `consent.scope`, so everything returned here was consented to.
 * Photos are not rendered yet: an entry with one fails the build instead of dropping it silently.
 */
export async function getTeam(locale: Locale): Promise<{ founder: TeamPerson | undefined; members: TeamPerson[] }> {
  const people = (await getCollection('team')).map(({ data }): TeamPerson & { isFounder: boolean } => {
    if (data.photo !== undefined) throw new Error(`team ${data.id}: rendering a photo is not built yet (needs the image pipeline)`);
    return {
      id: data.id,
      isFounder: data.isFounder,
      name: data.name,
      nickname: data.nickname,
      role: data.role[locale],
      bio: data.bio?.[locale],
      githubUrls: (data.links ?? []).map((link) => link.url),
    };
  });
  return { founder: people.find((person) => person.isFounder), members: people.filter((person) => !person.isFounder) };
}

/** Live servers first, then the others by name: the data collection has no order field, so the order is explicit here. */
export function sortGameServers<T extends { name: string; status: string }>(servers: readonly T[]): T[] {
  return [...servers].sort((a, b) => Number(a.status !== 'live') - Number(b.status !== 'live') || a.name.localeCompare(b.name));
}
