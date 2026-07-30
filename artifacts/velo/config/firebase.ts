import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAU7KjVcRsKSWc6g9IonJSlallIDETtWdI',
  authDomain: 'velo-ride-gh.firebaseapp.com',
  projectId: 'velo-ride-gh',
  storageBucket: 'velo-ride-gh.firebasestorage.app',
  messagingSenderId: '485423622547',
  appId: '1:485423622547:web:050f36c7cb18d3ff282066',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// firebase v12's `firebase/auth` subpath export doesn't route to the
// React Native build (its exports map has no "react-native" condition —
// only `@firebase/auth` directly does), so `getReactNativePersistence`
// isn't reliably resolvable from here. Falling back to plain `getAuth`
// means native sessions are in-memory only and won't survive an app
// restart — acceptable for now, revisit if persistent native sessions
// become a requirement.
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
