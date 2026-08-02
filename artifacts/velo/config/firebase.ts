import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
// The React Native build of Firebase Auth (index.rn) exposes
// getReactNativePersistence; the base `firebase/auth` types don't, so import it
// from `@firebase/auth` (Metro resolves this to the RN entry at runtime).
// @ts-ignore — transitive package with no direct type path; resolved by Metro.
import { getReactNativePersistence } from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAU7KjVcRsKSWc6g9IonJSlallIDETtWdI',
  authDomain: 'velo-ride-gh.firebaseapp.com',
  projectId: 'velo-ride-gh',
  storageBucket: 'velo-ride-gh.firebasestorage.app',
  messagingSenderId: '485423622547',
  appId: '1:485423622547:web:050f36c7cb18d3ff282066',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Persist the native auth session in AsyncStorage so a signed-in user stays
// signed in across app restarts. initializeAuth must run exactly once per app;
// on a Fast-Refresh re-run it throws "already-initialized", so fall back to
// getAuth in that case.
function initAuth() {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}
export const auth = initAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
