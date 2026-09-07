import { doc, updateDoc, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/config/firebase';

// Blocking another VELO user (from the per-ride chat) — the "block" half of
// Apple/Play's user-generated-content requirement that report-trip.tsx
// already covers the "report" half of. Stored as a plain array on the
// blocker's own profile: small (nobody blocks thousands of people) and it's
// the blocker's own doc, so no extra collection or security-rule surface.
// Enforced server-side too — see acceptRide in services/driver.ts and the
// `rides` update rule in firestore.rules — so it isn't just a client nicety.
export async function blockUser(uid: string, otherUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { blockedUserIds: arrayUnion(otherUid) });
}

export async function unblockUser(uid: string, otherUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { blockedUserIds: arrayRemove(otherUid) });
}

export async function isBlocked(uid: string, otherUid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', uid));
  const blocked: string[] = snap.data()?.blockedUserIds ?? [];
  return blocked.includes(otherUid);
}

export async function getBlockedIds(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.data()?.blockedUserIds ?? [];
}
