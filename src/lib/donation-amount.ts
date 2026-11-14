// What the Support form shares with its checks (donations contract section 2, 6.15). The page never converts or validates an
// amount: the donor types reais in the one field `amount` and the service turns it into integer cents with its one money
// function (minimum, digits, the R$ 5,000 confirmation step). The presets below only fill that field when the page script runs.

/** The only address the donation form posts to: the donations service, on the same origin. */
export const CHECKOUT_PATH = '/donations/api/v1/checkout';

/** The preset buttons (D-70), in whole reais, written as plain digits into the amount field. */
export const PRESET_REAIS = [10, 25, 50, 100] as const;
