import { addDoc, collection, serverTimestamp, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

// A rider or driver flagging a problem with a trip — the base of dispute
// handling and fraud review. Categories mirror the common ride-hailing issues.
export type DisputeCategory =
  | 'overcharged'
  | 'safety'
  | 'driver_conduct'
  | 'rider_conduct'
  | 'route'
  | 'payment'
  | 'other';

export const DISPUTE_CATEGORIES: { id: DisputeCategory; label: string; icon: string; forRole?: 'rider' | 'driver' }[] = [
  { id: 'overcharged', label: 'Wrong fare / overcharged', icon: 'cash-outline' },
  { id: 'payment', label: 'Payment issue', icon: 'card-outline' },
  { id: 'safety', label: 'Safety concern', icon: 'shield-outline' },
  { id: 'driver_conduct', label: 'Driver behaviour', icon: 'person-outline', forRole: 'rider' },
  { id: 'rider_conduct', label: 'Passenger behaviour', icon: 'person-outline', forRole: 'driver' },
  { id: 'route', label: 'Wrong route / detour', icon: 'navigate-outline' },
  { id: 'other', label: 'Something else', icon: 'ellipsis-horizontal' },
];

export interface DisputeInput {
  rideId: string;
  reporterId: string;
  reporterRole: 'rider' | 'driver';
  category: DisputeCategory;
  note: string;
}

// Filed to a top-level `disputes` collection so an admin/ops surface can triage
// them independently of the ride. Status starts 'open'.
export async function createDispute(input: DisputeInput): Promise<string> {
  const ref = await addDoc(collection(db, 'disputes'), {
    rideId: input.rideId,
    reporterId: input.reporterId,
    reporterRole: input.reporterRole,
    category: input.category,
    note: input.note.trim().slice(0, 1000),
    status: 'open',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// The reporter's own filed disputes (so they can see "reported / under review").
export async function getMyDisputes(uid: string) {
  const q = query(collection(db, 'disputes'), where('reporterId', '==', uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
