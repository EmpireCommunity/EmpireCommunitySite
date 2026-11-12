// The Cloudflare custom rule "members.json sem parametros" refuses any query string on /data/members.json with a 403
// at the edge (members-json 2.9, Ops Runbook). At the public URL that 403 is the intended answer, so the origin 404/405
// the test expects in CI is never reached. Local and CI runs (PUBLIC unset) keep expecting the origin answer.
// The Server header cannot tell the edge from the origin (Cloudflare rewrites it on every proxied response), so the
// edge block is recognised by what the origin always adds: nginx sends the contract CSP, the edge block page does not.
export function isIntendedEdgeBlock(input: { publicUrl: boolean; path: string; status: number; hasContractCsp: boolean }): boolean {
  if (!input.publicUrl || input.status !== 403) return false;
  if (!input.path.startsWith('/data/members.json?')) return false;
  return !input.hasContractCsp;
}
