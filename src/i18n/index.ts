// UI strings (docs/contracts/site-data.md section 3). pt-br is the master locale: the key set of
// en-us must equal it, which is a type error here and a test in tests/i18n.test.ts.
import enUs from './messages/en-us.json' with { type: 'json' };
import ptBr from './messages/pt-br.json' with { type: 'json' };
import type { Locale } from '../lib/routes.ts';

export type Messages = typeof ptBr;
export type MessageKey = keyof Messages;

type SameKeys<A, B> = [keyof A] extends [keyof B] ? ([keyof B] extends [keyof A] ? true : never) : never;
// Compile-time parity: a missing or extra key in en-us.json makes this line fail to type-check.
const keysMatch: SameKeys<typeof ptBr, typeof enUs> = true;
void keysMatch;

const MESSAGES: Readonly<Record<Locale, Readonly<Record<MessageKey, string>>>> = {
  'pt-br': ptBr,
  'en-us': enUs,
};

/** Returns the UI string for a key. An unknown key is a type error, never a runtime fallback. */
export function t(locale: Locale, key: MessageKey, params: Readonly<Record<string, string | number>> = {}): string {
  return MESSAGES[locale][key].replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}
