// Header, menu and footer link lists (docs/design/information-architecture.md section 4). URLs come from
// `routes.ts`; labels are message keys, so the two locales cannot drift apart.
import type { MessageKey } from '../i18n/index.ts';
import type { InnerRouteKey } from './routes.ts';

interface LinkItem {
  key: InnerRouteKey;
  label: MessageKey;
}

/** The five pages in the header, the collapsed menu and the footer "Site" group, in this order. */
export const NAV_ITEMS = [
  { key: 'projects', label: 'nav.projects' },
  { key: 'game-servers', label: 'nav.game-servers' },
  { key: 'join', label: 'nav.join' },
  { key: 'support', label: 'nav.support' },
  { key: 'organization', label: 'nav.organization' },
] as const satisfies readonly LinkItem[];

/** The footer "Legal" group. */
export const LEGAL_ITEMS = [
  { key: 'terms', label: 'footer.terms' },
  { key: 'privacy', label: 'footer.privacy' },
] as const satisfies readonly LinkItem[];
