// What Docker Compose resolves for a template (`docker compose config --format json`): merge keys, anchors, extends,
// and label_file are applied; every profile is enabled (a profile-hidden service is still judged) and variables are
// not interpolated (a value written as a variable fails its exact-value rule instead of passing on a default). The compose checks judge this output, never the YAML text, so no YAML
// feature can hide a setting from them.
import { execFileSync } from 'node:child_process';

export function resolveCompose<T>(file: string): T {
  return JSON.parse(execFileSync('docker', ['compose', '-f', file, '--profile', '*', 'config', '--no-interpolate', '--format', 'json'], { encoding: 'utf8' })) as T;
}

/** Labels with keys folded to lower case (Traefik reads them case-insensitively) and the keys that collide once folded. */
export function foldLabels(raw: string[] | Record<string, unknown> | undefined): { labels: Record<string, string>; duplicates: string[] } {
  const entries: Array<[string, string]> = raw === undefined ? [] : Array.isArray(raw)
    ? raw.map((item) => {
        const at = item.indexOf('=');
        return at < 0 ? [item, ''] : [item.slice(0, at), item.slice(at + 1)];
      })
    : Object.entries(raw).map(([key, value]) => [key, String(value)]);
  const labels: Record<string, string> = {};
  const duplicates: string[] = [];
  for (const [key, value] of entries) {
    const folded = key.toLowerCase();
    if (folded in labels) duplicates.push(folded);
    labels[folded] = value;
  }
  return { labels, duplicates };
}
