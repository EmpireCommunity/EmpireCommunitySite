// Replaces the built-in Discord member count with the live one (docs/contracts/members-json.md section 3).
// The HTML already carries a value, so every failure path does nothing: no error text, no loading state.
import { formatMembers, membersFromPayload } from '../lib/members.ts';
import { MEMBERS_JSON_PATH } from '../lib/routes.ts';

const FETCH_TIMEOUT_MS = 4000;

async function refresh(): Promise<void> {
  const elements = document.querySelectorAll('[data-members-discord]');
  if (elements.length === 0) return;
  const response = await fetch(MEMBERS_JSON_PATH, {
    credentials: 'omit',
    cache: 'default',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (response.status !== 200) return;
  const members = membersFromPayload(await response.json());
  if (members === undefined) return;
  // textContent only, never innerHTML.
  for (const element of elements) element.textContent = formatMembers(members, document.documentElement.lang);
}

refresh().catch(() => undefined);
