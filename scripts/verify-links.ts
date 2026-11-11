// verify-links job (site-data sections 6 and 12, C-2): external URLs answer, linked repositories are public, the Discord
// invite resolves to the configured server. Network job: secret-free and read-only. GITHUB_TOKEN, when present, only
// raises the GitHub API rate limit (it carries contents: read, never a write scope).
// Usage: node scripts/verify-links.ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { answers, inviteMatches, isPublicRepo, linkTargets, repoTargets } from './lib/link-rules.ts';

const read = (path: string): unknown => parse(readFileSync(path, 'utf-8'));
const projects = read('src/data/projects.yaml') as { id?: unknown; url?: unknown; repo?: unknown }[];
const site = read('src/data/site.yaml') as { origin?: string; links?: Record<string, string>; discord: { inviteCode: string; guildId: string } };

const TIMEOUT_MS = 15_000;
const ATTEMPTS = 3;
const problems: string[] = [];
const token = process.env.GITHUB_TOKEN ?? '';

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  let last: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), ...init });
      if (response.status < 500 && response.status !== 429) return response;
      last = new Error(`status ${response.status}`);
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }
  throw last;
}

for (const { where, url } of linkTargets(projects, site)) {
  try {
    // GET, not HEAD: some hosts refuse HEAD. The body is not read.
    const response = await request(url);
    await response.body?.cancel();
    if (!answers(response.status)) problems.push(`${where}: ${url} answered ${response.status}`);
  } catch (error) {
    problems.push(`${where}: ${url} did not answer (${String(error)})`);
  }
}

for (const { where, repo } of repoTargets(projects)) {
  try {
    const response = await request(`https://api.github.com/repos/${repo}`, {
      headers: { accept: 'application/vnd.github+json', ...(token === '' ? {} : { authorization: `Bearer ${token}` }) },
    });
    const body = response.status === 200 ? ((await response.json()) as { private?: unknown }) : null;
    if (!isPublicRepo(response.status, body)) problems.push(`${where}: repository ${repo} is not public (API status ${response.status})`);
  } catch (error) {
    problems.push(`${where}: repository ${repo} could not be checked (${String(error)})`);
  }
}

try {
  const response = await request(`https://discord.com/api/v10/invites/${encodeURIComponent(site.discord.inviteCode)}`);
  const body = response.status === 200 ? ((await response.json()) as { code?: unknown; guild?: { id?: unknown } }) : null;
  if (!inviteMatches(body, site.discord.inviteCode, site.discord.guildId)) problems.push(`site.yaml discord: the invite does not resolve to the configured server (API status ${response.status})`);
} catch (error) {
  problems.push(`site.yaml discord: the invite could not be checked (${String(error)})`);
}

for (const problem of problems) console.log(`::error::${problem}`);
console.log(`verify-links: ${problems.length} problem(s).`);
process.exit(problems.length > 0 ? 1 : 0);
