import { LOCALES, routePath } from '../src/lib/routes.ts';
// Secret-free public observations only (deploy section 8). Never invoke http-test.ts here: its negative /data/ probes
// belong to the local image test, not the live Worker. Run from the repository root: node scripts/integrity.ts.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { INTEGRITY_PENDING } from './lib/integrity-pending.ts';
import {
  SITE_ORIGIN, WORKER_CONFIG_URL, SITEMAP_LIMIT, discordEntry, discordRedirect, discordRetryDelay, findingLevel,
  inviteLookup, inviteLinks, liveMembers, memberAgreement, noPayment, publicDestination, publicHeaders, rewriting, rootRedirect, sitemapUrls, siteUrl,
  workerCopies, type PublicResponse, type Level,
} from './lib/integrity-rules.ts';

const site = parse(readFileSync('src/data/site.yaml', 'utf8')) as { discord?: { inviteCode?: string; guildId?: string } };
const invite = site.discord?.inviteCode;
const guild = site.discord?.guildId;
if (typeof invite !== 'string' || !/^[A-Za-z0-9-]{2,32}$/.test(invite)
  || typeof guild !== 'string' || !/^\d{17,20}$/.test(guild)) throw new Error('Invalid public Discord configuration');
const now = Date.now();
let errors = 0;
// Untrusted public text never becomes an Actions command or log payload. Only static findings are printed.
const escapeAnnotation = (value: string) => value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
function report(row: string, pending: boolean, problems: string[], level: Level = findingLevel(pending)): void {
  if (problems.length === 0) { console.log(`integrity: ${escapeAnnotation(row)} passed`); return; }
  if (level === 'error') errors += 1;
  for (const problem of problems) console.log(`::${level}::${escapeAnnotation(`${row}: ${problem}${pending ? ' (target pending launch; integrity-pending.ts)' : ''}`)}`);
}
async function check(row: string, pending: boolean, run: () => Promise<string[] | { problems: string[]; level: Level }>): Promise<void> {
  try {
    const result = await run();
    if (Array.isArray(result)) report(row, pending, result);
    else report(row, pending, result.problems, pending ? 'warning' : result.level);
  }
  catch { report(row, pending, ['Public read or response validation failed']); }
}

/** Fixed egress destinations; redirects are inspected, never followed. Deadline covers reading the bounded body. */
async function read(url: string): Promise<PublicResponse> {
  publicDestination(url);
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1024 * 1024) {
          await reader.cancel().catch(() => {});
          throw new Error('Public response exceeds the size limit');
        }
        chunks.push(chunk.value);
      }
    }
  } finally { reader?.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { status: response.status, headers: response.headers, text: new TextDecoder().decode(bytes) };
}
const reads = new Map<string, Promise<PublicResponse>>();
function once(path: string): Promise<PublicResponse> {
  const url = new URL(path, SITE_ORIGIN).href;
  let pending = reads.get(url);
  if (pending === undefined) { pending = read(url); reads.set(url, pending); }
  return pending;
}
function successful(response: PublicResponse): string[] {
  return response.status === 200 && !response.headers.has('location') ? [] : ['Expected 200 without Location'];
}

// The live Worker gets one GET, no query, no retry, even while the static site is not launched.
await check('Member count', false, async () => {
  const response = await once('/data/members.json');
  return [...successful(response), ...liveMembers(response.text, now)];
});
await check('Invite copies agree', false, async () => {
  const response = await read(WORKER_CONFIG_URL);
  return [...successful(response), ...workerCopies(response.text, invite, guild)];
});
await check('Root', INTEGRITY_PENDING.root, async () => rootRedirect(await once('/?utm_source=ci')));
await check('Discord redirect', INTEGRITY_PENDING.root, async () => [
  ...discordRedirect(await once('/discord?utm_source=ci')),
  ...discordRedirect(await once('/discord/?utm_source=ci')),
]);

for (const path of ['/pt-br/', '/en-us/', '/pt-br/support/', '/en-us/support/']) {
  await check(`Payment guard ${path}`, INTEGRITY_PENDING.site, async () => {
    const response = await once(path);
    const support = path.endsWith('/support/');
    return [...successful(response), ...noPayment(response.text, support, path.split('/')[1]), ...(support ? rewriting(response.text) : [])];
  });
}
for (const path of ['/pt-br/', '/en-us/support/']) {
  await check(`Headers ${path}`, INTEGRITY_PENDING.site, async () => {
    const response = await once(path);
    return [...successful(response), ...publicHeaders(response, path.endsWith('/support/'))];
  });
}

let deployedCode: string | undefined;
let inviteAnswer: PublicResponse | undefined;
await check('Discord entry', INTEGRITY_PENDING.site, async () => {
  const results = await Promise.all(LOCALES.flatMap((locale) => [routePath(locale, 'discord'), `${routePath(locale, 'discord')}?utm_source=ci`]
    .map(async (path) => discordEntry(await once(path), locale))));
  const code = results[0]?.code;
  const problems = results.flatMap((result) => result.problems);
  if (code === undefined || results.some((result) => result.code !== code)) problems.push('Locale gates and queries must share one invite');
  if (problems.length === 0) deployedCode = code;
  return problems;
});

await check('Discord invite guild', INTEGRITY_PENDING.site, async () => {
  if (deployedCode === undefined) return ['No deployed invite to verify'];
  const url = `https://discord.com/api/v10/invites/${deployedCode}?with_counts=true`;
  const attempt = async () => {
    try { return await read(url); }
    catch { return { status: 0, headers: new Headers(), text: '' }; }
  };
  let response = await attempt();
  const delay = discordRetryDelay(response.status, response.headers.get('retry-after'), Date.now());
  if (delay !== undefined) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    response = await attempt();
  }
  inviteAnswer = response;
  return inviteLookup(response, deployedCode, guild);
});

// B-WK1: reuses the answer above (one Discord call per run); never prints it. Warns when the lookup is refused or missing.
await check('Member count agrees with Discord', false, async () => memberAgreement((await once('/data/members.json')).text, inviteAnswer, guild));

await check('Site-wide Discord links', INTEGRITY_PENDING.site, async () => {
  if (deployedCode === undefined) return ['No deployed invite to verify'];
  const documents = [`${SITE_ORIGIN}/sitemap-index.xml`];
  const seen = new Set<string>();
  const pages = new Set<string>(['/pt-br/', '/en-us/', '/pt-br/support/', '/en-us/support/'].map((path) => new URL(path, SITE_ORIGIN).href));
  while (documents.length > 0) {
    const url = documents.shift()!;
    if (seen.has(url)) continue;
    if (seen.size >= 20) throw new Error('Too many sitemap documents');
    seen.add(url);
    const response = await once(siteUrl(url).href);
    if (successful(response).length > 0) return ['Sitemap is not available'];
    const children = sitemapUrls(response.text);
    if (/<sitemapindex\b/.test(response.text)) documents.push(...children);
    else for (const child of children) pages.add(child);
    if (documents.length > SITEMAP_LIMIT || pages.size > SITEMAP_LIMIT) throw new Error('Too many public URLs');
  }
  for (const url of pages) {
    const response = await once(url);
    if (successful(response).length > 0 || inviteLinks(response.text, deployedCode, false, new URL(url).pathname).length > 0) return ['A public sitemap page has invalid status or Discord links'];
  }
  return [];
});

console.log(`integrity: ${errors} active row(s) failed; pending targets only warn.`);
process.exitCode = errors > 0 ? 1 : 0;
