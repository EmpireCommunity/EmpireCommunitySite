// The only reader of the /discord page data (docs/contracts/site-data.md sections 8 and 14, D-41): the community rules,
// the approved invite (site.yaml, the one source) and the WhatsApp community link (join-channels.yaml, read by this
// page alone, inside its pt-BR container). `getJoinChannels` deliberately never returns a channel `url`.
import { getCollection, getEntry } from 'astro:content';
import { formatRulesDate, inviteUrl } from './community-rules.ts';
import type { Locale } from './routes.ts';
import { getSite } from './site-data.ts';

export interface DiscordPageRule {
  id: string;
  title: string;
  body: string;
}

export interface DiscordPageLink {
  id: 'discord' | 'whatsapp';
  label: string;
  href: string;
}

export interface DiscordPageContainer {
  locale: Locale;
  date: string;
  rules: DiscordPageRule[];
  closing: string | undefined;
  /** Discord for everyone; WhatsApp only where the channel's audience includes the locale (pt-BR). */
  links: DiscordPageLink[];
}

export async function getDiscordPage(): Promise<Record<Locale, DiscordPageContainer>> {
  const [site, rulesEntry, channels] = await Promise.all([getSite(), getEntry('communityRules', 'community-rules'), getCollection('joinChannels')]);
  if (rulesEntry === undefined) throw new Error('src/data/community-rules.yaml is missing');
  const rules = rulesEntry.data;

  const container = (locale: Locale): DiscordPageContainer => {
    const links = channels.flatMap(({ data }): DiscordPageLink[] => {
      const label = data.label[locale];
      if (!data.audience.includes(locale) || label === undefined) return [];
      if (data.id === 'discord') return [{ id: 'discord', label, href: inviteUrl(site.discord.inviteCode) }];
      if (data.id === 'whatsapp') return [{ id: 'whatsapp', label, href: data.url }];
      return [];
    });
    return {
      locale,
      date: formatRulesDate(rules.updatedOn, locale),
      rules: rules.rules.map((rule) => ({ id: rule.id, title: rule.title[locale], body: rule.body[locale] })),
      closing: rules.closing?.[locale],
      links,
    };
  };
  return { 'pt-br': container('pt-br'), 'en-us': container('en-us') };
}
