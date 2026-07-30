import {
  collection, doc, addDoc, getDocs, updateDoc, query, orderBy, serverTimestamp, increment, writeBatch,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { PaymentMethod, WalletTransaction } from '@/context/AppContext';

// Firestore has no "only one doc in this subcollection can be default"
// constraint, so adding a new default method batches in clearing the old
// one — a plain addDoc plus N sequential updates would both cost more
// round-trips and risk landing two defaults if one write failed.
export async function addPaymentMethod(uid: string, method: Omit<PaymentMethod, 'id'>, existingMethods: PaymentMethod[]) {
  const col = collection(db, 'users', uid, 'paymentMethods');
  const newRef = doc(col);
  const batch = writeBatch(db);
  batch.set(newRef, { ...method, createdAt: serverTimestamp() });
  if (method.isDefault) {
    existingMethods.filter((m) => m.isDefault).forEach((m) => {
      batch.update(doc(col, m.id), { isDefault: false });
    });
  }
  await batch.commit();
  return newRef.id;
}

export async function getPaymentMethods(uid: string): Promise<PaymentMethod[]> {
  const q = query(collection(db, 'users', uid, 'paymentMethods'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentMethod));
}

export async function removePaymentMethodDoc(uid: string, methodId: string) {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'users', uid, 'paymentMethods', methodId));
}

export async function setDefaultPaymentMethod(uid: string, methods: PaymentMethod[], methodId: string) {
  const col = collection(db, 'users', uid, 'paymentMethods');
  const batch = writeBatch(db);
  methods.forEach((m) => batch.update(doc(col, m.id), { isDefault: m.id === methodId }));
  await batch.commit();
}

export async function getTransactions(uid: string): Promise<WalletTransaction[]> {
  const q = query(collection(db, 'users', uid, 'transactions'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WalletTransaction));
}

export async function topUpWallet(uid: string, amount: number, description: string) {
  await updateDoc(doc(db, 'users', uid), { walletBalance: increment(amount) });
  const ref = await addDoc(collection(db, 'users', uid, 'transactions'), {
    type: 'topup',
    amount,
    description,
    date: new Date().toISOString(),
  });
  return ref.id;
}
