// The Cloudflare custom rule "members.json sem parametros" refuses any query string on /data/members.json with a 403
// at the edge (members-json 2.9, Ops Runbook). At the public URL that 403 is the intended answer, so the origin 404/405
// the test expects in CI is never reached. Local and CI runs (PUBLIC unset) keep expecting the origin answer.
export function isIntendedEdgeBlock(input: { publicUrl: boolean; path: string; status: number; server: string | null }): boolean {
  if (!input.publicUrl || input.status !== 403) return false;
  if (!input.path.startsWith('/data/members.json?')) return false;
  // Only Cloudflare's own refusal counts: a 403 from the origin or another layer is still a failure.
  return input.server !== null && input.server.toLowerCase() === 'cloudflare';
}
