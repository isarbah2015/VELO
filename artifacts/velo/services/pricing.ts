// VELO fare model — deliberately affordable for Ghana okada riders, with a
// minimum-fare floor so short trips still make sense, and a LOW platform fee so
// the app stays usable and attractive to drivers.
//
// Fare = max(minFare, base + perKm·km + perMin·min).
// Reference: Accra okada trips are cheaper than the ₵60–120 car fares; these
// rates keep a typical ~6 km hop in the low-double-digit cedis.
export type RideType = 'Standard' | 'Premium' | 'Bossu';

export interface TierRate {
  base: number;   // pickup / flag-fall (₵)
  perKm: number;  // ₵ per kilometre
  perMin: number; // ₵ per minute
  minFare: number; // floor so very short rides still cover the driver's time
}

export const FARE: Record<RideType, TierRate> = {
  Standard: { base: 3, perKm: 1.6, perMin: 0.25, minFare: 6 },
  Premium:  { base: 5, perKm: 2.2, perMin: 0.35, minFare: 9 },
  Bossu:    { base: 7, perKm: 3.0, perMin: 0.50, minFare: 13 },
};

/** Estimated fare in whole cedis for a trip of `km` / `min`, floored at minFare. */
export function estimateFare(type: RideType, km: number, min: number): number {
  const r = FARE[type];
  const raw = r.base + r.perKm * km + r.perMin * min;
  return Math.max(r.minFare, Math.round(raw));
}

/** Human-readable rate line for a tier, e.g. "Base ₵3 · ₵1.60/km · ₵0.25/min · min ₵6". */
export function rateLabel(type: RideType): string {
  const r = FARE[type];
  return `Base ₵${r.base} · ₵${r.perKm.toFixed(2)}/km · ₵${r.perMin.toFixed(2)}/min · min ₵${r.minFare}`;
}

// ── How VELO earns ───────────────────────────────────────────────────────────
// A flat 10% service fee — under Bolt (~15%) and far under Uber (~25%) — so the
// driver keeps 90% and the app still earns on every completed ride. The rider
// pays the fare; the driver's payout is fare − fee; the fee is VELO's revenue.
export const COMMISSION_RATE = 0.10;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The driver's take-home for a completed ride (fare minus VELO's fee). */
export function driverPayout(fare: number): number {
  return round2(fare * (1 - COMMISSION_RATE));
}

/** VELO's service fee (revenue) on a completed ride. */
export function platformFee(fare: number): number {
  return round2(fare * COMMISSION_RATE);
}
