// robots.txt (docs/contracts/routing-locale.md section 5): everything allowed, the sitemap named. `/data/` is not
// disallowed. The /discord page keeps out of the index with its own `noindex`, which a crawler can only read if it may fetch it.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  if (site === undefined) throw new Error('`site` must be set in astro.config.ts');
  const body = ['User-agent: *', 'Allow: /', '', `Sitemap: ${new URL('/sitemap-index.xml', site).href}`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
