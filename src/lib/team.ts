// The only module that reads team data (docs/contracts/site-data.md section 9). Entries are already
// validated by the collection schema; this adds the cross-entry rule: at most one founder.
import { getCollection } from 'astro:content';

export async function getTeam() {
  const entries = await getCollection('team');
  const founders = entries.filter((entry) => entry.data.isFounder);
  if (founders.length > 1) {
    throw new Error(`team.yaml: at most one entry may set isFounder, found ${founders.length}`);
  }
  return entries.map((entry) => entry.data);
}
