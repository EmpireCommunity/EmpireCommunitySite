// /data/members.json at the public URL is answered by the member-count Worker, whose header set is its own
// (members-json section 1, "Headers (Worker response)"): not the origin's page headers. The origin fallback file says
// source "built-in" (members-json section 4), so the body tells which side answered; anything else is the Worker.
export const WORKER_CONTENT_TYPE = 'application/json; charset=utf-8';
export const WORKER_CACHE = 'public, max-age=600';

/** Which side answered /data/members.json, read from the body: the origin fallback carries source "built-in". */
export function membersAnswerSide(body: unknown): 'origin' | 'worker' {
  const discord = typeof body === 'object' && body !== null && 'discord' in body ? body.discord : undefined;
  const source = typeof discord === 'object' && discord !== null && 'source' in discord ? discord.source : undefined;
  return source === 'built-in' ? 'origin' : 'worker';
}

/** Problems of a Worker answer against members-json section 1: status, the exact headers, and what it never sends. */
export function workerMembersProblems(status: number, headers: Headers): string[] {
  const problems: string[] = [];
  if (status !== 200) problems.push(`status ${status}, expected 200`);
  if (headers.get('content-type') !== WORKER_CONTENT_TYPE) problems.push(`Content-Type is ${headers.get('content-type')}, expected ${WORKER_CONTENT_TYPE}`);
  if (headers.get('x-content-type-options') !== 'nosniff') problems.push('X-Content-Type-Options is not nosniff');
  if (headers.get('cache-control') !== WORKER_CACHE) problems.push(`Cache-Control is ${headers.get('cache-control')}, expected ${WORKER_CACHE}`);
  if (headers.get('set-cookie') !== null) problems.push('Set-Cookie present');
  for (const [name] of headers) if (name.startsWith('access-control-')) problems.push(`${name} present`);
  return problems;
}
