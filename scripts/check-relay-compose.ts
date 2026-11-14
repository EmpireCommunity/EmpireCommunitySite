// Relay compose template validation (docs/contracts/deploy.md section 13).
// Usage: node scripts/check-relay-compose.ts [deploy/members-source/compose.yml]
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { relayComposeProblems, type RelayCompose } from './lib/relay-compose-rules.ts';

const file = process.argv[2] ?? 'deploy/members-source/compose.yml';
const site = parse(readFileSync('src/data/site.yaml', 'utf8')) as { discord?: { inviteCode?: unknown } };
const siteCode = typeof site.discord?.inviteCode === 'string' ? site.discord.inviteCode : '';
const problems = relayComposeProblems(parse(readFileSync(file, 'utf8')) as RelayCompose, siteCode);
if (problems.length > 0) {
  for (const problem of problems) console.log(`::error file=${file}::${problem}`);
  process.exit(1);
}
console.log(`check-relay-compose: ${file} follows the deploy contract.`);
