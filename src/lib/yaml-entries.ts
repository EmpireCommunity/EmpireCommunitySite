// Pure parsing and rules for the YAML data files (docs/contracts/site-data.md sections 1 and 2). Kept free of
// Astro imports so the rules run under `node --test`. Every problem throws: a data file must never be
// skipped quietly, because that would let a broken or empty file produce a passing build.
import { parse } from 'yaml';

export type RawEntry = Record<string, unknown> & { id: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A list file: a YAML sequence of mappings, each with a string `id` that is unique in the file. */
export function parseEntryList(text: string, source: string): RawEntry[] {
  const data: unknown = parse(text) ?? [];
  if (!Array.isArray(data)) throw new Error(`${source}: expected a YAML list of entries`);
  const seen = new Set<string>();
  return data.map((item: unknown, index) => {
    if (!isPlainObject(item) || typeof item['id'] !== 'string' || item['id'] === '') {
      throw new Error(`${source}: entry ${index + 1} must be a mapping with a string "id"`);
    }
    const id = item['id'];
    if (seen.has(id)) throw new Error(`${source}: duplicate id "${id}"`);
    seen.add(id);
    return { ...item, id };
  });
}

/** A one-document file (site.yaml, community.yaml), exposed as a one-entry collection with the given id. */
export function parseSingleDocument(text: string, source: string, id: string): RawEntry[] {
  const data: unknown = parse(text);
  if (!isPlainObject(data)) throw new Error(`${source}: expected a YAML mapping for the "${id}" document`);
  return [{ ...data, id }];
}
