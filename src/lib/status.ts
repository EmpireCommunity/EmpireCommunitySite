// Status vocabulary (information-architecture section 5). The data files and schemas use `live`,
// `in-development` and `coming-soon`; the design record names the three tokens `live`, `development` and `soon`.
// This is the one place that maps one to the other.
import type { MessageKey } from '../i18n/index.ts';

/** Values allowed by the schemas: projects use the first two, game servers the first and the last. */
export type DataStatus = 'live' | 'in-development' | 'coming-soon';

/** Names used by the design record (`status-live`, `status-development`, `status-soon`). */
export type StatusKind = 'live' | 'development' | 'soon';

export const STATUS_KIND: Readonly<Record<DataStatus, StatusKind>> = {
  live: 'live',
  'in-development': 'development',
  'coming-soon': 'soon',
};

export const STATUS_LABEL: Readonly<Record<StatusKind, MessageKey>> = {
  live: 'status.live',
  development: 'status.inDevelopment',
  soon: 'status.comingSoon',
};

export function statusKind(status: DataStatus): StatusKind {
  return STATUS_KIND[status];
}
