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
  from: string;
  to: string;
  type: Ride['type'];
  price: number;
  scheduledFor?: string;
}): Promise<string> {
  const ref = await addDoc(ridesCol, {
    ...input,
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

export function watchRide(rideId: string, callback: (ride: Ride | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'rides', rideId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Ride) : null);
  });
}

export async function getRideHistory(uid: string, role: 'rider' | 'driver' = 'rider'): Promise<Ride[]> {
  const field = role === 'driver' ? 'driverId' : 'riderId';
  const q = query(ridesCol, where(field, '==', uid), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ride));
}

// Stream the driver's live position onto the ride doc during an active trip
// so the rider's tracking screen can follow it in realtime.
export async function updateDriverLocation(rideId: string, lat: number, lng: number) {
  await updateDoc(doc(db, 'rides', rideId), { driverLoc: { lat, lng, at: Date.now() } });
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
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ride)));
  });
}
