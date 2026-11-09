// Origin fallback of the member count (docs/contracts/members-json.md section 4): `dist/data/members.json` with the
// same schema as the Worker's answer, from `community.yaml`. It is what a browser gets when the Worker is bypassed or
// gone, and `source: "built-in"` tells an operator that this happened.
import type { APIRoute } from 'astro';
import { getCommunity } from '../../lib/site-data.ts';

export const GET: APIRoute = async () => {
  const community = await getCommunity();
  const body = {
    schema: 1,
    discord: { members: community.discord.membersBuiltIn, updatedAt: new Date().toISOString(), source: 'built-in' },
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
