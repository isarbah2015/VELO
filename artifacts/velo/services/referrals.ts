import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/config/firebase';

export type Tier = 'Standard' | 'Premium' | 'Bossu';

export interface TierInfo {
  tier: Tier;
  label: string;
  color: string;
  next: Tier | null;
  ridesToNext: number | null;
  perk: string;
}

// Loyalty tiers are earned by completed rides. Kept as pure client logic so
// the badge is always in sync with ride history without an extra write.
export function tierForRides(completedRides: number): TierInfo {
  if (completedRides >= 50) {
    return { tier: 'Bossu', label: 'Velo Okada Bossu', color: '#FFD000', next: null, ridesToNext: null, perk: 'Priority matching + 10% off' };
  }
  if (completedRides >= 10) {
    return { tier: 'Premium', label: 'Premium Rider', color: '#A78BFA', next: 'Bossu', ridesToNext: 50 - completedRides, perk: 'Faster matching + 5% off' };
  }
  return { tier: 'Standard', label: 'Standard Rider', color: '#71717A', next: 'Premium', ridesToNext: 10 - completedRides, perk: 'Standard fares' };
}

// A short, shareable, human-readable code derived from the user's name +
// a slice of their uid, so it's stable and unique without a lookup table.
export function makeReferralCode(name: string, uid: string): string {
  const base = (name || 'VELO').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'VELO';
  return `${base}${uid.slice(0, 4).toUpperCase()}`;
}

// Ensure the user has a referral code persisted; returns it. Idempotent.
export async function ensureReferralCode(uid: string, name: string): Promise<string> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const existing = snap.get('referralCode');
  if (existing) return existing;
  const code = makeReferralCode(name, uid);
  await updateDoc(ref, { referralCode: code });
  return code;
}

// Record that this user was referred by a code (once). Credits both sides a
// small wallet bonus — the classic two-sided referral incentive.
export async function applyReferralCode(uid: string, code: string): Promise<boolean> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (snap.get('referredBy') || snap.get('referralCode') === code) return false;
  await updateDoc(ref, { referredBy: code, walletBalance: increment(5) });
  return true;
}
