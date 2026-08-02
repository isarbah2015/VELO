// Driver tier / promotion logic.
//
// Drivers earn their way up as they complete more rides AND keep a high star
// rating — the classic ride-hailing incentive loop. A rider requesting a
// Premium or Okada Bossu bike is matched to drivers who have reached that tier,
// so the tier both rewards good drivers and signals quality to riders.

export type Tier = 'standard' | 'premium' | 'bossu';

export interface TierRule {
  tier: Tier;
  label: string;
  minRides: number;
  minRating: number;
  blurb: string;
}

// Ordered lowest → highest. A driver holds the highest tier whose thresholds
// they satisfy (both rides AND rating).
export const TIER_RULES: TierRule[] = [
  { tier: 'standard', label: 'Standard', minRides: 0, minRating: 0, blurb: 'Every VELO driver starts here.' },
  { tier: 'premium', label: 'Premium', minRides: 25, minRating: 4.5, blurb: 'Unlocks Premium ride requests + higher fares.' },
  { tier: 'bossu', label: 'Okada Bossu', minRides: 100, minRating: 4.8, blurb: 'Top-tier elite: the highest-paying Bossu rides.' },
];

const rule = (t: Tier): TierRule => TIER_RULES.find((r) => r.tier === t) ?? TIER_RULES[0];

/** Highest tier a driver qualifies for given lifetime rides + rating. */
export function computeTier(totalRides: number, rating: number): Tier {
  let current: Tier = 'standard';
  for (const r of TIER_RULES) {
    if (totalRides >= r.minRides && rating >= r.minRating) current = r.tier;
  }
  return current;
}

/** Whether `tier` may serve a ride of `rideType` (higher tiers serve lower). */
export function tierCanServe(tier: Tier, rideType: 'Standard' | 'Premium' | 'Bossu'): boolean {
  const order: Tier[] = ['standard', 'premium', 'bossu'];
  const need: Tier = rideType === 'Bossu' ? 'bossu' : rideType === 'Premium' ? 'premium' : 'standard';
  return order.indexOf(tier) >= order.indexOf(need);
}

export interface TierProgress {
  tier: Tier;
  current: TierRule;
  next: TierRule | null; // null when already at the top
  ridesToNext: number; // rides still needed for the next tier (0 if rating is the only gap or maxed)
  ratingNeeded: number | null; // rating still required for next tier, or null if already met/maxed
  ridesProgress: number; // 0..1 toward next tier by ride count
}

/** Everything the driver profile needs to show current tier + path to the next. */
export function tierProgress(totalRides: number, rating: number): TierProgress {
  const tier = computeTier(totalRides, rating);
  const idx = TIER_RULES.findIndex((r) => r.tier === tier);
  const next = idx < TIER_RULES.length - 1 ? TIER_RULES[idx + 1] : null;

  if (!next) {
    return { tier, current: rule(tier), next: null, ridesToNext: 0, ratingNeeded: null, ridesProgress: 1 };
  }

  const ridesToNext = Math.max(0, next.minRides - totalRides);
  const ratingNeeded = rating >= next.minRating ? null : next.minRating;
  const span = next.minRides - rule(tier).minRides;
  const ridesProgress = span <= 0 ? 1 : Math.min(1, Math.max(0, (totalRides - rule(tier).minRides) / span));

  return { tier, current: rule(tier), next, ridesToNext, ratingNeeded, ridesProgress };
}
