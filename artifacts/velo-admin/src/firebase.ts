import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Same Firebase project as the VELO mobile app (velo-ride-gh). The web API key
// is safe to ship — access is enforced by Firestore rules (admins collection).
const firebaseConfig = {
  apiKey: 'AIzaSyAU7KjVcRsKSWc6g9IonJSlallIDETtWdI',
  authDomain: 'velo-ride-gh.firebaseapp.com',
  projectId: 'velo-ride-gh',
  storageBucket: 'velo-ride-gh.firebasestorage.app',
  messagingSenderId: '485423622547',
  appId: '1:485423622547:web:050f36c7cb18d3ff282066',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
