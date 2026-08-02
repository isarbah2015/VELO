import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '@/config/firebase';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

// The photos a driver must supply to be verified: their Ghana Card plus the
// four sides of the motorcycle for identification.
export type DocKey = 'ghanaCard' | 'bikeFront' | 'bikeBack' | 'bikeLeft' | 'bikeRight';

export const DOC_FIELDS: { key: DocKey; label: string }[] = [
  { key: 'ghanaCard', label: 'Ghana Card' },
  { key: 'bikeFront', label: 'Motorcycle — Front' },
  { key: 'bikeBack', label: 'Motorcycle — Back' },
  { key: 'bikeLeft', label: 'Motorcycle — Left' },
  { key: 'bikeRight', label: 'Motorcycle — Right' },
];

// Structured vehicle details captured alongside the photos, so a rider can be
// told exactly what to look for ("GR-1234-24, red Bajaj Boxer") and the
// platform has the plate on record for accountability.
export interface VehicleInfo {
  plate: string;
  model: string; // make/model, e.g. "Bajaj Boxer"
  color: string;
}

export interface VerificationData {
  status: VerificationStatus;
  docs?: Partial<Record<DocKey, string>>;
  vehicle?: VehicleInfo;
  submittedAt?: unknown;
}

// Upload a local image URI to Storage under this driver's verification folder
// and return its download URL. RN has no File/Blob from a path, so we fetch
// the local uri into a blob first.
export async function uploadVerificationImage(uid: string, key: DocKey, uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const storageRef = ref(storage, `verification/${uid}/${key}.jpg`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

// Persist the uploaded document URLs and flip the driver into "pending"
// review. An ops team / admin flips this to verified or rejected later.
export async function submitVerification(uid: string, docs: Record<DocKey, string>, vehicle: VehicleInfo) {
  await updateDoc(doc(db, 'drivers', uid), {
    verification: {
      status: 'pending' as VerificationStatus,
      docs,
      vehicle: {
        plate: vehicle.plate.trim().toUpperCase(),
        model: vehicle.model.trim(),
        color: vehicle.color.trim(),
      },
      submittedAt: serverTimestamp(),
    },
  });
}

export async function getVerification(uid: string): Promise<VerificationData> {
  const snap = await getDoc(doc(db, 'drivers', uid));
  return (snap.get('verification') as VerificationData) ?? { status: 'unverified' };
}
