import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { makeReferralCode } from './referrals';

export type Role = 'rider' | 'driver';

export interface UserProfile {
  name: string;
  phone: string;
  role: Role;
  walletBalance: number;
  referralCode?: string;
  referredBy?: string;
}

const DEFAULT_DRIVER_DOC = {
  online: false,
  ridesToday: 0,
  todayEarnings: 0,
  weeklyEarnings: [0, 0, 0, 0, 0, 0, 0],
  rating: 5.0,
  acceptanceRate: 100,
  cancellationRate: 0,
};

// Firebase Auth needs an email/password pair, but VELO's UI only ever
// collects a Ghana phone number — so the phone is normalized into a
// synthetic address under a reserved domain purely for Auth's sake. The
// real phone number lives on the Firestore profile, never this address.
function phoneToAuthEmail(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return `${digits}@phone.velo.app`;
}

export async function register(name: string, phone: string, password: string, role: Role = 'rider') {
  const cred = await createUserWithEmailAndPassword(auth, phoneToAuthEmail(phone), password);
  await setDoc(doc(db, 'users', cred.user.uid), {
    name,
    phone,
    role,
    walletBalance: 0,
    referralCode: makeReferralCode(name, cred.user.uid),
    createdAt: serverTimestamp(),
  });
  if (role === 'driver') {
    await setDoc(doc(db, 'drivers', cred.user.uid), { ...DEFAULT_DRIVER_DOC, updatedAt: serverTimestamp() });
  }
  return cred.user;
}

export async function login(phone: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, phoneToAuthEmail(phone), password);
  return cred.user;
}

// Google sign-in returns a Firebase user with no VELO profile on first login.
// Provision one lazily (real Google email, no phone yet) so the rest of the
// app — which assumes a users/{uid} doc — works unchanged.
export async function ensureGoogleProfile(user: FirebaseUser): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const name = user.displayName || user.email?.split('@')[0] || 'VELO Rider';
  await setDoc(ref, {
    name,
    phone: '',
    email: user.email ?? '',
    role: 'rider',
    walletBalance: 0,
    referralCode: makeReferralCode(name, user.uid),
    createdAt: serverTimestamp(),
  });
}

export function logout() {
  return signOut(auth);
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// Switching into Driver mode for the first time provisions the drivers/{uid}
// doc lazily, since a rider who never drove has no earnings/status doc yet.
export async function setUserRole(uid: string, role: Role) {
  await updateDoc(doc(db, 'users', uid), { role });
  if (role === 'driver') {
    const driverSnap = await getDoc(doc(db, 'drivers', uid));
    if (!driverSnap.exists()) {
      await setDoc(doc(db, 'drivers', uid), { ...DEFAULT_DRIVER_DOC, updatedAt: serverTimestamp() });
    }
  }
}
