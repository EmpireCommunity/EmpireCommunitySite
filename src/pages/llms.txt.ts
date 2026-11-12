// llms.txt (docs/contracts/routing-locale.md section 5): one file at the root, English, describing the community and
// linking the en-US pages. WhatsApp is pt-BR only (C-1), so it is never named here; the check in `check-dist` enforces it.
// Titles and descriptions are the en-US page messages, and every URL comes from `routes.ts`. The legal pages join the
// list when their texts are published (`PENDING.legalPages` is false).
import type { APIRoute } from 'astro';
import { t } from '../i18n/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { routePath } from '../lib/routes.ts';
import { PENDING } from '../../scripts/lib/pending.ts';
import type { InnerRouteKey } from '../lib/routes.ts';

const PAGES: readonly InnerRouteKey[] = ['projects', 'game-servers', 'join', 'support', 'organization', ...(PENDING.legalPages ? [] : (['terms', 'privacy'] as const))];

export const GET: APIRoute = ({ site }) => {
  if (site === undefined) throw new Error('`site` must be set in astro.config.ts');
  const absolute = (path: string) => new URL(path, site).href;
  const entry = (key: InnerRouteKey) =>
    `- [${t('en-us', `meta.${key}.title` as MessageKey)}](${absolute(routePath('en-us', key))}): ${t('en-us', `meta.${key}.description` as MessageKey)}`;
  const body = [
    '# EmpireCommunity',
    '',
    `> ${t('en-us', 'meta.home.description')}`,
    '',
    '## Pages',
    '',
    `- [${t('en-us', 'meta.home.title')}](${absolute(routePath('en-us', 'home'))}): ${t('en-us', 'meta.home.description')}`,
    ...PAGES.map(entry),
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
