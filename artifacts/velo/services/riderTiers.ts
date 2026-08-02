// Rider loyalty tiers.
//
// The mirror of the driver tier ladder (services/tiers.ts): riders climb by
// completing trips, and each tier unlocks a standing fare discount + perks.
// Unlike driver tiers (which also gate ride *eligibility*), rider tiers are
// purely rewards — they never restrict what a rider can book.

export type RiderTier = 'bronze' | 'silver' | 'gold';

export interface RiderTierRule {
  tier: RiderTier;
  label: string;
  emoji: string;
  minRides: number;
  discountPct: number; // fraction off every fare, e.g. 0.1 = 10%
  perk: string;
}

// Ordered lowest → highest. A rider holds the highest tier whose ride threshold
// they've reached.
export const RIDER_TIER_RULES: RiderTierRule[] = [
  { tier: 'bronze', label: 'Bronze', emoji: '🥉', minRides: 0, discountPct: 0, perk: 'Standard fares — every trip counts toward Silver.' },
  { tier: 'silver', label: 'Silver', emoji: '🥈', minRides: 10, discountPct: 0.05, perk: '5% off every fare + priority matching.' },
  { tier: 'gold', label: 'Gold', emoji: '🥇', minRides: 30, discountPct: 0.10, perk: '10% off every fare + priority matching & support.' },
];

const rule = (t: RiderTier): RiderTierRule =>
  RIDER_TIER_RULES.find((r) => r.tier === t) ?? RIDER_TIER_RULES[0];

/** Highest tier a rider qualifies for given their completed-ride count. */
export function computeRiderTier(completedRides: number): RiderTier {
  let current: RiderTier = 'bronze';
  for (const r of RIDER_TIER_RULES) {
    if (completedRides >= r.minRides) current = r.tier;
  }
  return current;
}

/** The standing fare discount fraction for a rider's completed-ride count. */
export function riderDiscount(completedRides: number): number {
  return rule(computeRiderTier(completedRides)).discountPct;
}

/** Apply the loyalty discount to a fare, rounded to 2dp. */
export function applyRiderDiscount(fare: number, completedRides: number): number {
  const discounted = fare * (1 - riderDiscount(completedRides));
  return Math.round(discounted * 100) / 100;
}

export interface RiderTierProgress {
  tier: RiderTier;
  current: RiderTierRule;
  next: RiderTierRule | null; // null when already at the top
  ridesToNext: number; // trips still needed for the next tier (0 if maxed)
  progress: number; // 0..1 toward the next tier by ride count
}

/** Everything the rider tier card needs to show current tier + path to next. */
export function riderTierProgress(completedRides: number): RiderTierProgress {
  const tier = computeRiderTier(completedRides);
  const idx = RIDER_TIER_RULES.findIndex((r) => r.tier === tier);
  const next = idx < RIDER_TIER_RULES.length - 1 ? RIDER_TIER_RULES[idx + 1] : null;

  if (!next) {
    return { tier, current: rule(tier), next: null, ridesToNext: 0, progress: 1 };
  }

  const ridesToNext = Math.max(0, next.minRides - completedRides);
  const span = next.minRides - rule(tier).minRides;
  const progress = span <= 0 ? 1 : Math.min(1, Math.max(0, (completedRides - rule(tier).minRides) / span));

  return { tier, current: rule(tier), next, ridesToNext, progress };
}
