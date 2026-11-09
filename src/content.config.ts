// Collections and Zod schemas: docs/contracts/site-data.md section 1. Any schema error fails the build.
import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { singleDocument } from './lib/yaml-document.ts';
import { GameServerSchema } from './schemas/game-servers.ts';
import { JoinChannelSchema } from './schemas/join-channels.ts';
import { LegalSchema } from './schemas/legal.ts';
import { ProjectSchema } from './schemas/projects.ts';
import { SiteSchema } from './schemas/site.ts';
import { TeamMemberSchema } from './schemas/team.ts';

const site = defineCollection({
  loader: file('src/data/site.yaml', { parser: singleDocument('site') }),
  schema: SiteSchema.extend({ id: z.literal('site') }),
});

const projects = defineCollection({
  loader: file('src/data/projects.yaml'),
  schema: ProjectSchema,
});

const gameServers = defineCollection({
  loader: file('src/data/game-servers.yaml'),
  schema: GameServerSchema,
});

const joinChannels = defineCollection({
  loader: file('src/data/join-channels.yaml'),
  schema: JoinChannelSchema,
});

const team = defineCollection({
  loader: file('src/data/team.yaml'),
  schema: TeamMemberSchema,
});

const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: LegalSchema,
});

export const collections = { site, projects, gameServers, joinChannels, team, legal };
