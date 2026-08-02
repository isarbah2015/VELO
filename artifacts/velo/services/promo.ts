// Promo codes.
//
// A small, self-contained set of launch promo codes validated on the client.
// (A production build would validate + burn single-use codes server-side; these
// are standing launch offers, so a client table is enough and keeps VELO
// independent of any shared backend.) Each code is either a percentage off or a
// flat cedi discount, with an optional minimum fare.

export interface Promo {
  code: string;
  kind: 'percent' | 'flat';
  value: number; // percent (0..1) or flat cedis
  minFare?: number; // ignore the code below this fare
  blurb: string;
}

const PROMOS: Promo[] = [
  { code: 'VELO10', kind: 'percent', value: 0.1, blurb: '10% off your ride' },
  { code: 'WELCOME', kind: 'flat', value: 5, blurb: '₵5 off your ride' },
  { code: 'ACCRA20', kind: 'percent', value: 0.2, minFare: 15, blurb: '20% off rides over ₵15' },
];

export type PromoResult =
  | { ok: true; promo: Promo; discount: number; newFare: number }
  | { ok: false; reason: string };

/** Look up a promo by code (case-insensitive), returning it or null. */
export function findPromo(code: string): Promo | null {
  const c = code.trim().toUpperCase();
  return PROMOS.find((p) => p.code === c) ?? null;
}

/**
 * Validate a code against a fare and compute the resulting discount.
 * The discount never exceeds the fare (no negative totals).
 */
export function applyPromo(code: string, fare: number): PromoResult {
  const promo = findPromo(code);
  if (!promo) return { ok: false, reason: 'Invalid promo code' };
  if (promo.minFare && fare < promo.minFare) {
    return { ok: false, reason: `Valid on fares over ₵${promo.minFare.toFixed(2)}` };
  }
  const raw = promo.kind === 'percent' ? fare * promo.value : promo.value;
  const discount = Math.min(fare, Math.round(raw * 100) / 100);
  const newFare = Math.round((fare - discount) * 100) / 100;
  return { ok: true, promo, discount, newFare };
}
