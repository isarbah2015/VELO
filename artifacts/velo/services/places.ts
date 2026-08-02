import {
  collection, doc, addDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

// A rider's saved place — Home, Work, or any custom favourite — used for
// one-tap destination fill at booking. Stored under users/{uid}/places.
export interface SavedPlace {
  id: string;
  label: string; // 'Home' | 'Work' | custom
  address: string;
  icon?: string; // Ionicons glyph name, chosen from the label
}

// Pick a sensible icon from a place label so Home/Work read at a glance.
export function iconForLabel(label: string): string {
  const l = label.trim().toLowerCase();
  if (l === 'home') return 'home';
  if (l === 'work' || l === 'office') return 'briefcase';
  return 'bookmark';
}

export async function getPlaces(uid: string): Promise<SavedPlace[]> {
  const q = query(collection(db, 'users', uid, 'places'), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedPlace));
}

export async function addPlace(uid: string, label: string, address: string): Promise<string> {
  const ref = await addDoc(collection(db, 'users', uid, 'places'), {
    label: label.trim(),
    address: address.trim(),
    icon: iconForLabel(label),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function removePlace(uid: string, placeId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'places', placeId));
}
