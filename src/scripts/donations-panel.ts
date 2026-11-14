// The transparency panel of the Support page (docs/contracts/donations.md section 6, plan P2-08): the browser entry. All
// the logic is in `src/lib/donations-panel-controller.ts` (tested against stand-ins); this file only hands it the real
// page, `fetch` and timer. The page renders this script only when donations are open (support.astro), so it never runs
// while the site shows "not open".
import { startPanel } from '../lib/donations-panel-controller.ts';
import type { PanelNode } from '../lib/donations-panel-controller.ts';

void startPanel(document.querySelector<HTMLElement>('[data-donations-panel]') as PanelNode | null, {
  doc: document,
  lang: document.documentElement.lang || 'pt-BR',
  fetch: (url, init) => fetch(url, init),
  timer: (run, ms) => {
    const id = setTimeout(run, ms);
    return () => clearTimeout(id);
  },
});
