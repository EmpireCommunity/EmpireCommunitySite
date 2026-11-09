// The only module that reads team data (docs/contracts/site-data.md section 9). The collection loader has
// already validated every entry (consent and scope) and the one-founder rule before any page runs.
import { getCollection } from 'astro:content';

export async function getTeam() {
  const entries = await getCollection('team');
  return entries.map((entry) => entry.data);
}
