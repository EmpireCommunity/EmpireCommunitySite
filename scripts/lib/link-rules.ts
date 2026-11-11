// Pure rules of the verify-links job (site-data sections 6 and 12). The network calls live in scripts/verify-links.ts.
export type LinkTarget = { where: string; url: string };
export type RepoTarget = { where: string; repo: string };

type ProjectEntry = { id?: unknown; url?: unknown; repo?: unknown };
type SiteData = { origin?: unknown; links?: Record<string, unknown> };

const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

/** External URLs to probe: every project `url` and every `site.yaml` link that is not a page of this site. */
export function linkTargets(projects: readonly ProjectEntry[], site: SiteData): LinkTarget[] {
  const origin = isText(site.origin) ? site.origin.replace(/\/$/, '') : '';
  const targets: LinkTarget[] = [];
  for (const project of projects) if (isText(project.url)) targets.push({ where: `projects.yaml ${String(project.id)}`, url: project.url });
  for (const [name, url] of Object.entries(site.links ?? {})) {
    if (isText(url) && !(origin !== '' && (url === origin || url.startsWith(`${origin}/`)))) targets.push({ where: `site.yaml links.${name}`, url });
  }
  return targets;
}

/** Repositories to check for public visibility: every project `repo`. */
export function repoTargets(projects: readonly ProjectEntry[]): RepoTarget[] {
  return projects.filter((project) => isText(project.repo)).map((project) => ({ where: `projects.yaml ${String(project.id)}`, repo: String(project.repo) }));
}

/** A link answers when the final status is 2xx or 3xx (redirects are not followed, so a 3xx is the answer). */
export const answers = (status: number): boolean => status >= 200 && status < 400;

/** The repository API answer of a public repository: 200 with private false. A 404 means missing or private. */
export const isPublicRepo = (status: number, body: { private?: unknown } | null): boolean => status === 200 && body?.private === false;

/** The invite resolves to the configured server: same code and the same guild id (a reassigned code never passes). */
export function inviteMatches(body: { code?: unknown; guild?: { id?: unknown } } | null, inviteCode: string, guildId: string): boolean {
  return body?.code === inviteCode && body.guild?.id === guildId;
}
