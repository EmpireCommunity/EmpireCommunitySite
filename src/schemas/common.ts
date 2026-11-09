// Common types and rules: docs/contracts/site-data.md section 2. Zod comes from Astro (`astro/zod`).
import { z } from 'astro/zod';

export const Locale = z.enum(['pt-br', 'en-us']);
export type LocaleCode = z.infer<typeof Locale>;

/** Unique per collection, never renamed. */
export const Id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
/** Opaque, random, never derived from a name or nickname. */
export const PersonId = z.string().regex(/^p-[0-9a-f]{12}$/);
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const noMarkup = (value: string): boolean => !/[<>]/.test(value);

/** Plain text, no markup. Rich text exists only in the legal Markdown files. */
export const Text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(noMarkup, { message: 'plain text only: no markup' });

/** Always carries both locales: a missing translation fails the build (C-3). */
export const Localized = (max: number) =>
  z.strictObject({ 'pt-br': Text(max), 'en-us': Text(max) });

/**
 * Translation object for an entry with an `audience`. Its keys must equal the audience, checked by
 * `assertKeysEqualAudience` in the entry's superRefine (C-1).
 */
export const LocalizedFor = (max: number) =>
  z.strictObject({ 'pt-br': Text(max).optional(), 'en-us': Text(max).optional() });

export const Audience = z
  .array(Locale)
  .min(1)
  .refine((locales) => new Set(locales).size === locales.length, { message: 'audience has duplicates' });

const TRACKING_PARAM = /^(utm_.*|fbclid|gclid|ref)$/i;

function isCleanHttpsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username !== '' || url.password !== '') return false;
  return ![...url.searchParams.keys()].some((name) => TRACKING_PARAM.test(name));
}

/** https only, no credentials in the URL, no tracking parameters. */
export const HttpsUrl = z
  .string()
  .startsWith('https://')
  .refine(isCleanHttpsUrl, { message: 'must be a valid https URL without credentials or tracking parameters' });

/** Files live in src/assets/**; the size and metadata checks are CI steps (site-data section 2). */
const IMAGE_SRC = /^(\.\.\/)+assets\/[A-Za-z0-9._/-]+\.(webp|avif|jpe?g|png)$/;

export const Image = z
  .strictObject({
    src: z.string().regex(IMAGE_SRC),
    alt: Localized(140).optional(),
    decorative: z.boolean().default(false),
  })
  .refine((image) => image.decorative || image.alt !== undefined, {
    message: 'alt is required unless the image is decorative',
  });

/** Adds an issue for every locale key that is not in the entry's audience, or is missing from it. */
export function assertKeysEqualAudience(
  ctx: z.RefinementCtx,
  field: string,
  value: Partial<Record<LocaleCode, string | undefined>> | undefined,
  audience: readonly LocaleCode[],
): void {
  const present = Object.entries(value ?? {})
    .filter(([, text]) => text !== undefined)
    .map(([locale]) => locale)
    .sort();
  const expected = [...audience].sort();
  if (present.join() !== expected.join()) {
    ctx.addIssue({
      code: 'custom',
      path: [field],
      message: `${field} keys must equal the audience (${expected.join(', ')}), found (${present.join(', ')})`,
    });
  }
}
