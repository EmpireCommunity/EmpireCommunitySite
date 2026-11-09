// Checks whose target page or file is not part of the scaffold yet. A pending check only WARNS. When the page lands
// (the PR that adds it), flip its flag to false in that same PR so the check becomes blocking.
export const PENDING = {
  // /discord page (D-29, routing-locale "The /discord page")
  discordPage: true,
  // data-donations="not-open" block on the support pages (site-data section 10)
  supportBlock: true,
  // sitemap-index.xml, robots.txt, llms.txt (routing-locale section 5)
  discoveryFiles: true,
} as const;
