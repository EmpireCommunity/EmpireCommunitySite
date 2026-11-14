// Expected values from routing-locale section 6, shared by local HTTP tests and the public integrity monitor.
export const DEFAULT_CSP = "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; img-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
// The support pages' form posts to the donations service (`'self'`), which answers with a redirect to the one payment host of its
// allowlist; browsers apply `form-action` to that redirect, so the host is listed here and nowhere else (donations contract
// section 2, T-56 m1). The directive is an HTTP header, so no payment host is ever written in the page.
export const SUPPORT_CSP = "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self' https://www.mercadopago.com.br; frame-ancestors 'none'";
export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()';

/**
 * HTML carries its encoding in the header (routing-locale section 6; the support page guard reads UTF-8): `text/html; charset=utf-8`.
 * Only a 2xx answer is held to it: nginx does not run its charset filter on redirect or error answers (small bodies no browser renders as a page).
 * Returns the problem, or `undefined` when the answer is fine. The HTTP test applies it to every response it fetches.
 */
export function htmlCharsetProblem(response: { status: number; headers: { get(name: string): string | null } }): string | undefined {
  const contentType = response.headers.get('content-type') ?? '';
  if (response.status >= 300 || !/^text\/html/i.test(contentType)) return undefined;
  return /;\s*charset=utf-8\s*$/i.test(contentType) ? undefined : `HTML is served without charset=utf-8: ${contentType}`;
}
