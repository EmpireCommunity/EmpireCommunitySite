// Collections and Zod schemas: docs/contracts/site-data.md section 1. Any schema error fails the build.
// YAML files go through `yamlLoader` (not Astro's `file()`), so a malformed, missing or duplicate-id file
// fails the build too. Cross-entry rules run after each load.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { assertLegalParity, type LegalDoc } from './lib/legal-rules.ts';
import { assertSingleFounder } from './lib/team-rules.ts';
import { parseEntryList, parseSingleDocument } from './lib/yaml-entries.ts';
import { yamlLoader } from './lib/yaml-loader.ts';
import { CommunitySchema } from './schemas/community.ts';
import { CommunityRulesSchema } from './schemas/community-rules.ts';
import { GameServerSchema } from './schemas/game-servers.ts';
import { JoinChannelSchema } from './schemas/join-channels.ts';
import { LegalSchema } from './schemas/legal.ts';
import { ProjectSchema } from './schemas/projects.ts';
import { SiteSchema } from './schemas/site.ts';
import { SupportSchema } from './schemas/support.ts';
import { TeamMemberSchema } from './schemas/team.ts';

const site = defineCollection({
  loader: yamlLoader({
    path: 'src/data/site.yaml',
    parse: (text, source) => parseSingleDocument(text, source, 'site'),
  }),
  schema: SiteSchema.extend({ id: z.literal('site') }),
});

// Required: it carries the verified `discord.membersBuiltIn` the HTML and the origin members.json are built from.
const community = defineCollection({
  loader: yamlLoader({
    path: 'src/data/community.yaml',
    parse: (text, source) => parseSingleDocument(text, source, 'community'),
  }),
  schema: CommunitySchema.extend({ id: z.literal('community') }),
});

const projects = defineCollection({
  loader: yamlLoader({ path: 'src/data/projects.yaml', parse: parseEntryList }),
  schema: ProjectSchema,
});

const gameServers = defineCollection({
  loader: yamlLoader({ path: 'src/data/game-servers.yaml', parse: parseEntryList }),
  schema: GameServerSchema,
});

const joinChannels = defineCollection({
  loader: yamlLoader({ path: 'src/data/join-channels.yaml', parse: parseEntryList }),
  schema: JoinChannelSchema,
});

// The support page data: one document, validated strictly (no payment field can exist in it).
const support = defineCollection({
  loader: yamlLoader({
    path: 'src/data/support.yaml',
    parse: (text, source) => parseSingleDocument(text, source, 'support'),
  }),
  schema: SupportSchema.extend({ id: z.literal('support') }),
});

// The /discord page rules (D-41): required, because the page is built from it.
const communityRules = defineCollection({
  loader: yamlLoader({
    path: 'src/data/community-rules.yaml',
    parse: (text, source) => parseSingleDocument(text, source, 'community-rules'),
  }),
  schema: CommunityRulesSchema.safeExtend({ id: z.literal('community-rules') }),
});

const team = defineCollection({
  loader: yamlLoader({ path: 'src/data/team.yaml', parse: parseEntryList, validate: assertSingleFounder }),
  schema: TeamMemberSchema,
});

// The front matter `slug` would make both locales share one id, so the id is the relative path
// (`pt-br/terms-of-service`). The parity rules run after every load.
function legalLoader(): Loader {
  const inner = glob({
    pattern: '**/*.md',
    base: './src/content/legal',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  });
  return {
    ...inner,
    load: async (context) => {
      await inner.load(context);
      const docs = context.store.values().map((entry): LegalDoc => ({
        filePath: entry.filePath ?? entry.id,
        locale: String(entry.data['locale']),
        slug: String(entry.data['slug']),
        version: String(entry.data['version']),
        effectiveDate: String(entry.data['effectiveDate']),
        body: entry.body ?? '',
      }));
      assertLegalParity(docs);
    },
  };
}

const legal = defineCollection({ loader: legalLoader(), schema: LegalSchema });

export const collections = { site, community, projects, gameServers, joinChannels, communityRules, support, team, legal };
