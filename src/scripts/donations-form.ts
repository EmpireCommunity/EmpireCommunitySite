// Progressive enhancement of the donation form (src/components/DonationsOpen.astro): without this script the donor types the
// amount in reais. With it, the preset buttons appear and write plain digits into the one amount field. Nothing is converted,
// checked or sent from here: the browser submits the form itself, same origin, and the service validates the amount.
const form = document.querySelector<HTMLFormElement>('#donation-form');
const field = form?.querySelector<HTMLInputElement>('#amount') ?? null;
const presets = form?.querySelector<HTMLElement>('[data-amount-presets]') ?? null;

if (field !== null && presets !== null) {
  presets.hidden = false;
  presets.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('button[data-amount]');
    if (button === null || button === undefined) return;
    field.value = button.dataset.amount ?? '';
    field.focus();
  });
}
