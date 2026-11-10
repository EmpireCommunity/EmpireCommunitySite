// Cross-document rules for the legal pages (docs/contracts/site-data.md section 11), checked on every build:
// slug equals the file name, locale equals the folder, both locales exist for both slugs, and the two
// locales share the same version, effective date and heading ids in the same order.
// Semantic equality of the text is a human review in the PR and is not checked here.
import { posix } from 'node:path';
import { LEGAL_SLUGS } from '../schemas/legal.ts';

const LOCALES = ['pt-br', 'en-us'] as const;
const HEADING = /^#{1,6}\s/;
const HEADING_ID = /\{#([A-Za-z0-9_-]+)\}\s*$/;

export interface LegalDoc {
  filePath: string;
  locale: string;
  slug: string;
  version: string;
  effectiveDate: string | undefined;
  body: string;
}

/** Heading ids in order; a heading without an explicit `{#id}` is returned as `null`. Fenced code is skipped. */
export function headingIds(body: string): (string | null)[] {
  let fenced = false;
  const ids: (string | null)[] = [];
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced || !HEADING.test(line)) continue;
    ids.push(HEADING_ID.exec(line)?.[1] ?? null);
  }
  return ids;
}

export interface LegalOptions {
  /** True once the launch PR has flipped `PENDING.legalPages`: every file then carries an `effectiveDate`. */
  effectiveDateRequired?: boolean;
}

export function legalIssues(docs: readonly LegalDoc[], { effectiveDateRequired = false }: LegalOptions = {}): string[] {
  // Nothing authored yet: the scaffold ships no legal text. Once any file exists the full set is required.
  if (docs.length === 0) return [];
  const issues: string[] = [];
  const byKey = new Map<string, LegalDoc>();

  for (const doc of docs) {
    const folder = posix.basename(posix.dirname(doc.filePath));
    const name = posix.basename(doc.filePath, '.md');
    if (doc.locale !== folder) issues.push(`${doc.filePath}: locale "${doc.locale}" must equal the folder "${folder}"`);
    if (doc.slug !== name) issues.push(`${doc.filePath}: slug "${doc.slug}" must equal the file name "${name}"`);
    if (effectiveDateRequired && doc.effectiveDate === undefined) issues.push(`${doc.filePath}: effectiveDate is required once the legal pages are launched`);
    const ids = headingIds(doc.body);
    if (ids.includes(null)) issues.push(`${doc.filePath}: every heading needs an explicit id, e.g. "## Controller {#controller}"`);
    const named = ids.filter((id): id is string => id !== null);
    if (new Set(named).size !== named.length) issues.push(`${doc.filePath}: heading ids must be unique`);
    byKey.set(`${folder}/${name}`, doc);
  }

  for (const slug of LEGAL_SLUGS) {
    const [first, second] = LOCALES.map((locale) => byKey.get(`${locale}/${slug}`));
    for (const locale of LOCALES) {
      if (!byKey.has(`${locale}/${slug}`)) issues.push(`src/content/legal/${locale}/${slug}.md is missing`);
    }
    if (first === undefined || second === undefined) continue;
    if (first.version !== second.version) issues.push(`${slug}: version differs between locales`);
    if (first.effectiveDate !== second.effectiveDate) issues.push(`${slug}: effectiveDate differs between locales`);
    if (headingIds(first.body).join('|') !== headingIds(second.body).join('|')) {
      issues.push(`${slug}: heading ids differ between locales (same ids in the same order are required)`);
    }
  }
  return issues;
}

export function assertLegalParity(docs: readonly LegalDoc[], options: LegalOptions = {}): void {
  const issues = legalIssues(docs, options);
  if (issues.length > 0) throw new Error(`legal pages:\n- ${issues.join('\n- ')}`);
}
