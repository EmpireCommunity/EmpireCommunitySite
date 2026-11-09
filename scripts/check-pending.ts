// Release guard: fails while any pending-check flag is not exactly false. It reads the VALUES of PENDING, so comments,
// spacing or any other spelling of the source cannot hide a flag. Usage: node scripts/check-pending.ts
import { PENDING } from './lib/pending.ts';

const open = (Object.entries(PENDING) as [string, unknown][]).filter(([, value]) => value !== false).map(([name]) => name);
for (const name of open) console.log(`::error file=scripts/lib/pending.ts::pending flag ${name} is not false: the page it waits for is not in the site yet.`);
process.exit(open.length > 0 ? 1 : 0);
