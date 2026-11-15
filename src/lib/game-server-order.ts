// Order of the game servers (docs/contracts/site-data.md section 7, B-T60). Pure, so tests can import it
// (`site-data.ts` needs `astro:content`); `site-data.ts` re-exports `sortGameServers` for the pages.

/** Live servers first, then ascending `order`; `name` is the last key, so the file order never matters. */
export function sortGameServers<T extends { name: string; status: string; order: number }>(servers: readonly T[]): T[] {
  return [...servers].sort(
    (a, b) =>
      Number(a.status !== 'live') - Number(b.status !== 'live') || a.order - b.order || a.name.localeCompare(b.name),
  );
}

/** Cross-entry rule: two servers with the same `order` would bring the alphabetical order back, so the build fails. */
export function assertUniqueServerOrder(entries: readonly unknown[]): void {
  const seen = new Map<number, string>();
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, order } = entry as { id?: unknown; order?: unknown };
    if (typeof order !== 'number') continue;
    const first = seen.get(order);
    if (first !== undefined) {
      throw new Error(`game-servers.yaml: "${first}" and "${String(id)}" share order ${order}; every server needs its own order`);
    }
    seen.set(order, String(id));
  }
}
