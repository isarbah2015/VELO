import { doc, updateDoc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { updateRideStatus } from './rides';

export interface DriverStatus {
  online: boolean;
  ridesToday: number;
  totalRides: number; // lifetime completed rides — drives tier promotion
  todayEarnings: number;
  weeklyEarnings: number[];
  rating: number;
  acceptanceRate: number;
  cancellationRate: number;
}

export async function setOnlineStatus(uid: string, online: boolean) {
  await updateDoc(doc(db, 'drivers', uid), { online, updatedAt: serverTimestamp() });
}

export async function getDriverStatus(uid: string): Promise<DriverStatus | null> {
  const snap = await getDoc(doc(db, 'drivers', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { totalRides: 0, ...data } as DriverStatus; // default for older docs
}

export async function acceptRide(rideId: string, driverId: string, driverName: string) {
  await updateRideStatus(rideId, 'accepted', { driverId, driverName });
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
