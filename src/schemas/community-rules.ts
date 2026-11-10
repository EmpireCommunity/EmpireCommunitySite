// docs/contracts/site-data.md section 14 (D-41). The one source of the rules text and of the "last updated" date shown
// on the /discord page. Plain text only (the page renders it as text); a newline is a line break, not markup.
import { z } from 'astro/zod';
import { Id, IsoDate, Localized } from './common.ts';

/** The one Discord address a rule may carry, as plain text (rule 5). Any other Discord URL in the text fails the build. */
export const TERMS_URL = 'https://discord.com/terms';

const DISCORD_HOST_URL = /(?:https?:)?\/\/(?:[a-z0-9-]+\.)*discord(?:app)?\.(?:com|gg)(?:\/[^\s"'<>)]*)?/gi;
const WHATSAPP = /whats\s?app|\bwa\.me\b/i;

/** Every text of an entry, both locales. */
function textsOf(rules: z.infer<typeof BaseRulesSchema>): string[] {
  const localized = [rules.intro, rules.closing, ...rules.rules.flatMap((rule) => [rule.title, rule.body])];
  return localized.flatMap((value) => (value === undefined ? [] : [value['pt-br'], value['en-us']]));
}

const BaseRulesSchema = z.strictObject({
  updatedOn: IsoDate,
  intro: Localized(400).optional(),
  rules: z
    .array(z.strictObject({ id: Id, title: Localized(80), body: Localized(600) }))
    .min(1)
    .max(40),
  closing: Localized(200).optional(),
});

export const CommunityRulesSchema = BaseRulesSchema.superRefine((rules, ctx) => {
  const seen = new Set<string>();
  rules.rules.forEach((rule, index) => {
    if (seen.has(rule.id)) ctx.addIssue({ code: 'custom', path: ['rules', index, 'id'], message: `duplicate rule id "${rule.id}"` });
    seen.add(rule.id);
  });
  for (const text of textsOf(rules)) {
    // The two locales carry identical content and WhatsApp appears only in pt-BR (C-1), so no rule text names it.
    if (WHATSAPP.test(text)) ctx.addIssue({ code: 'custom', path: ['rules'], message: 'no rule text may name WhatsApp (C-1)' });
    for (const url of text.match(DISCORD_HOST_URL) ?? []) {
      if (url !== TERMS_URL) ctx.addIssue({ code: 'custom', path: ['rules'], message: `the only Discord address allowed in a rule is ${TERMS_URL}, found ${url}` });
    }
  }
});
export type CommunityRules = z.infer<typeof CommunityRulesSchema>;
