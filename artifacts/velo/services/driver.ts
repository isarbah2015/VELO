import { doc, updateDoc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { updateRideStatus } from './rides';
import type { VerificationData } from './verification';

export interface DriverStatus {
  online: boolean;
  ridesToday: number;
  totalRides: number; // lifetime completed rides — drives tier promotion
  todayEarnings: number;
  weeklyEarnings: number[];
  rating: number;
  acceptanceRate: number;
  cancellationRate: number;
  verification?: VerificationData; // Ghana Card / vehicle review state
}

export async function setOnlineStatus(uid: string, online: boolean) {
  await updateDoc(doc(db, 'drivers', uid), { online, updatedAt: serverTimestamp() });
}

// How many drivers are online right now — shown on the rider's "finding a
// driver" screen so the wait feels grounded ("4 VELO drivers online") rather
// than an anonymous spinner. A cheap count query, best-effort.
export async function getOnlineDriverCount(): Promise<number> {
  try {
    const { getCountFromServer, query, where, collection } = await import('firebase/firestore');
    const q = query(collection(db, 'drivers'), where('online', '==', true));
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch {
    return 0;
  }
}

export async function getDriverStatus(uid: string): Promise<DriverStatus | null> {
  const snap = await getDoc(doc(db, 'drivers', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { totalRides: 0, ...data } as DriverStatus; // default for older docs
}

// Thrown when a driver taps Accept a beat after someone else already claimed
// the ride (or the rider cancelled). The UI catches this to show a friendly
// "just taken" message instead of silently double-assigning.
export class RideUnavailableError extends Error {
  constructor(public reason: 'taken' | 'gone' | 'cancelled') {
    super(reason);
    this.name = 'RideUnavailableError';
  }
}

// Accept-race guard: two online drivers can tap Accept on the same open request
// within milliseconds. A blind write would let the last writer win and leave
// both drivers thinking they got the ride. Claim it inside a transaction that
// only succeeds when the ride is still unassigned — the loser gets a
// RideUnavailableError and the request stays with whoever won.
export async function acceptRide(rideId: string, driverId: string, driverName: string) {
  const ref = doc(db, 'rides', rideId);
  const driverRef = doc(db, 'drivers', driverId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new RideUnavailableError('gone');
    const data = snap.data();
    if (data.status === 'cancelled') throw new RideUnavailableError('cancelled');
    // Already claimed by another driver (status advanced past 'requested', or a
    // driverId is already set) — this driver lost the race.
    if (data.driverId && data.driverId !== driverId) throw new RideUnavailableError('taken');
    if (data.status !== 'requested' && data.status !== 'accepted') {
      throw new RideUnavailableError('taken');
    }
    // Stamp the driver's verified vehicle onto the ride so the rider can be told
    // exactly which bike + plate to look for (read inside the txn, no extra RTT).
    const driverSnap = await tx.get(driverRef);
    const vehicle = driverSnap.get('verification.vehicle') ?? null;
    tx.update(ref, {
      status: 'accepted',
      driverId,
      driverName,
      vehicle,
      acceptedAt: serverTimestamp(),
    });
  });
}

// Declining leaves the ride unassigned (driverId stays null) so another
// online driver can still pick it up — it does not cancel the rider's request.
export async function declineRide(rideId: string) {
  await updateRideStatus(rideId, 'requested', { declinedAt: serverTimestamp() });
}

// Rolls a completed ride's fare into the driver's running totals atomically,
// since two rides finishing close together must not clobber each other's
// increment. Accepting a request is treated as completing it immediately —
// this app has no separate driver-side live-tracking screen, only
// accept/decline, so "accepted" and "earned" happen together.
export async function recordCompletedRide(driverId: string, fare: number) {
  const ref = doc(db, 'drivers', driverId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const weekly: number[] = data.weeklyEarnings ?? [0, 0, 0, 0, 0, 0, 0];
    const todayIdx = new Date().getDay();
    weekly[todayIdx] = (weekly[todayIdx] ?? 0) + fare;
    tx.update(ref, {
      todayEarnings: (data.todayEarnings ?? 0) + fare,
      ridesToday: (data.ridesToday ?? 0) + 1,
      totalRides: (data.totalRides ?? 0) + 1,
      weeklyEarnings: weekly,
      updatedAt: serverTimestamp(),
    });
  });
}
