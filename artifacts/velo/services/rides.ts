import {
  collection, doc, addDoc, updateDoc, getDocs, query, where, orderBy,
  onSnapshot, type Unsubscribe, type FieldValue,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Ride } from '@/context/AppContext';

const ridesCol = collection(db, 'rides');

export async function createRide(input: {
  riderId: string;
  riderName: string;
  riderPhone?: string;
  from: string;
  to: string;
  fromCoord?: { lat: number; lng: number } | null;
  toCoord?: { lat: number; lng: number } | null;
  type: Ride['type'];
  price: number;
  scheduledFor?: string;
}): Promise<string> {
  const ref = await addDoc(ridesCol, {
    ...input,
    riderPhone: input.riderPhone ?? null,
    fromCoord: input.fromCoord ?? null,
    toCoord: input.toCoord ?? null,
    scheduledFor: input.scheduledFor ?? null,
    driverId: null,
    driverName: null,
    date: new Date().toISOString(),
    durationMin: 0,
    driverRating: 0,
    status: 'requested' as Ride['status'],
  });
  return ref.id;
}

// The rider streams their own position during pickup so the driver can see
// exactly where to meet them (mirrors updateDriverLocation the other way).
export async function updateRiderLocation(rideId: string, lat: number, lng: number) {
  await updateDoc(doc(db, 'rides', rideId), { riderLoc: { lat, lng, at: Date.now() } });
}

export function watchRide(rideId: string, callback: (ride: Ride | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'rides', rideId),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Ride) : null),
    (err) => {
      // A dropped listener (offline, permission, or the ride doc gone) must not
      // surface as an uncaught snapshot-listener error — report null and log.
      console.warn('[watchRide] listener error:', err.code ?? err.message);
      callback(null);
    }
  );
}

export async function getRideHistory(uid: string, role: 'rider' | 'driver' = 'rider'): Promise<Ride[]> {
  const field = role === 'driver' ? 'driverId' : 'riderId';
  const q = query(ridesCol, where(field, '==', uid), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ride));
}

// Stream the driver's live position onto the ride doc during an active trip
// so the rider's tracking screen can follow it in realtime. Best-effort
// telemetry — a dropped write (offline, or the ride doc already gone) must
// never surface as an unhandled rejection, so failures are swallowed.
export async function updateDriverLocation(rideId: string, lat: number, lng: number) {
  try {
    await updateDoc(doc(db, 'rides', rideId), { driverLoc: { lat, lng, at: Date.now() } });
  } catch {
    // ignore — the next GPS tick will retry
  }
}

export async function updateRideStatus(
  rideId: string,
  status: Ride['status'],
  extra: Record<string, string | number | FieldValue | null> = {}
) {
  await updateDoc(doc(db, 'rides', rideId), { status, ...extra });
}

// Open requests are any unassigned ride — driverId is left null by
// createRide until someone accepts, so any online driver can see the pool
// rather than each ride being routed to one specific driver.
export async function getDriverRequests(): Promise<Ride[]> {
  const q = query(ridesCol, where('status', '==', 'requested'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ride));
}

// Realtime version of getDriverRequests: an online driver subscribes to the
// open-request pool so a rider's new booking shows up instantly, no refresh.
export function watchDriverRequests(callback: (rides: Ride[]) => void): Unsubscribe {
  const q = query(ridesCol, where('status', '==', 'requested'), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ride))),
    (err) => { console.warn('[watchDriverRequests] listener error:', err.code ?? err.message); callback([]); }
  );
}
