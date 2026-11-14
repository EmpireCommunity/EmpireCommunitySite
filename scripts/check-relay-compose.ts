// Relay compose template validation (docs/contracts/deploy.md section 13).
// Usage: node scripts/check-relay-compose.ts [deploy/members-source/compose.yml]
// The rules run on what Docker Compose resolves (`docker compose config --format json`), not on the YAML text, so
// anchors, merge keys and any other YAML feature cannot hide a setting from the check.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { resolveCompose } from './lib/compose-resolve.ts';
import { relayComposeProblems, type RelayCompose } from './lib/relay-compose-rules.ts';

const file = process.argv[2] ?? 'deploy/members-source/compose.yml';
const site = parse(readFileSync('src/data/site.yaml', 'utf8')) as { discord?: { inviteCode?: unknown } };
const siteCode = typeof site.discord?.inviteCode === 'string' ? site.discord.inviteCode : '';
const resolved = resolveCompose<RelayCompose>(file);
const problems = relayComposeProblems(resolved, siteCode);
if (problems.length > 0) {
  for (const problem of problems) console.log(`::error file=${file}::${problem}`);
  process.exit(1);
}
console.log(`check-relay-compose: ${file} follows the deploy contract.`);
