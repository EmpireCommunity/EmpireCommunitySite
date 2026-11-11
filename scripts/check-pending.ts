// Release guard: fails while any pending-check flag is not exactly false. It reads the VALUES of PENDING, so comments,
// spacing or any other spelling of the source cannot hide a flag. A release candidate passes --prerelease and may
// still wait for legalPages only (scripts/lib/pending-guard.ts). Usage: node scripts/check-pending.ts [--prerelease]
import { blockingFlags } from './lib/pending-guard.ts';
import { PENDING } from './lib/pending.ts';

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg !== '--prerelease');
if (unknown.length > 0) {
  console.error(`check-pending: unknown argument ${unknown.join(' ')}`);
  process.exit(2);
}
const open = blockingFlags(PENDING, args.includes('--prerelease'));
for (const name of open) console.log(`::error file=scripts/lib/pending.ts::pending flag ${name} is not false: the page it waits for is not in the site yet.`);
process.exit(open.length > 0 ? 1 : 0);
