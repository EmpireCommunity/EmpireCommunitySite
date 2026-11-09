// Content-layer loader for the YAML data files. It replaces Astro's `file()` loader, which only logs an
// error and carries on when a file is malformed, empty of ids or missing, and only warns on duplicate ids,
// so a broken data file could still produce a green build. Here every one of those fails the build.
// Per-entry schema errors come from `parseData` (the collection's Zod schema) and also fail it.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader, LoaderContext } from 'astro/loaders';
import type { RawEntry } from './yaml-entries.ts';

interface YamlLoaderOptions {
  /** Path from the project root, e.g. `src/data/team.yaml`. */
  path: string;
  parse: (text: string, source: string) => RawEntry[];
  /** When true a missing file is an empty collection (a file that is not shipped yet). */
  optional?: boolean;
  /** Cross-entry rule run on the validated entries after every load; throw to fail the build. */
  validate?: (entries: readonly unknown[]) => void;
}

export function yamlLoader({ path, parse, optional = false, validate }: YamlLoaderOptions): Loader {
  async function sync({ config, store, parseData }: LoaderContext): Promise<void> {
    const filePath = fileURLToPath(new URL(path, config.root));
    if (!existsSync(filePath)) {
      if (!optional) throw new Error(`${path}: data file not found`);
      store.clear();
      return;
    }
    const entries = parse(await readFile(filePath, 'utf-8'), path);
    store.clear();
    for (const raw of entries) {
      const data = await parseData({ id: raw.id, data: raw, filePath });
      store.set({ id: raw.id, data, filePath: posix.relative(fileURLToPath(config.root), filePath) });
    }
    validate?.(store.values().map((entry) => entry.data));
  }

  return {
    name: 'yaml-loader',
    load: async (context) => {
      await sync(context);
      const filePath = fileURLToPath(new URL(path, context.config.root));
      context.watcher?.add(filePath);
      context.watcher?.on('change', (changed) => {
        if (changed !== filePath) return;
        context.logger.info(`Reloading data from ${path}`);
        sync(context).catch((error: unknown) => {
          context.logger.error(error instanceof Error ? error.message : String(error));
        });
      });
    },
  };
}
