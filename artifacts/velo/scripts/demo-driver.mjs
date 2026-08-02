// Demo driver bot — for TESTING the full ride sequence without a second phone.
//
//   node scripts/demo-driver.mjs      (or)   pnpm run demo:driver
//
// Signs in as a demo driver, goes online, and watches Firestore for any
// `requested` ride. When one appears it accepts and walks it through the real
// lifecycle (accepted → arrived → in_progress → completed) with a moving GPS
// position — exactly what a real driver app would do — so the rider screen
// advances past "Finding your rider…" and you can watch the whole flow +
// push notifications fire. Leave it running in its own terminal.
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAU7KjVcRsKSWc6g9IonJSlallIDETtWdI',
  authDomain: 'velo-ride-gh.firebaseapp.com',
  projectId: 'velo-ride-gh',
  storageBucket: 'velo-ride-gh.firebasestorage.app',
  messagingSenderId: '485423622547',
  appId: '1:485423622547:web:050f36c7cb18d3ff282066',
};

const DRIVER_PHONE = '240000001';
const DRIVER_EMAIL = '240000001@phone.velo.app';
const DRIVER_PASS = 'velo123';
const DRIVER_NAME = 'Demo Driver';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureDriver() {
  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, DRIVER_EMAIL, DRIVER_PASS);
  } catch {
    cred = await createUserWithEmailAndPassword(auth, DRIVER_EMAIL, DRIVER_PASS);
    await setDoc(doc(db, 'users', cred.user.uid), {
      name: DRIVER_NAME,
      phone: DRIVER_PHONE,
      role: 'driver',
      walletBalance: 0,
      createdAt: serverTimestamp(),
    });
  }
  const uid = cred.user.uid;
  await setDoc(
    doc(db, 'drivers', uid),
    {
      online: true,
      rating: 4.9,
      ridesToday: 0,
      totalRides: 150, // top (Bossu) tier so it can accept any ride type in tests
      todayEarnings: 0,
      weeklyEarnings: [0, 0, 0, 0, 0, 0, 0],
      acceptanceRate: 100,
      cancellationRate: 0,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return uid;
}

const handled = new Set();

async function progressRide(rideId, uid) {
  handled.add(rideId);
  const rref = doc(db, 'rides', rideId);
  const start = { lat: 5.605, lng: -0.185 }; // near Accra Mall
  const end = { lat: 5.556, lng: -0.182 }; // toward Osu

  console.log(`→ accepting ride ${rideId}`);
  await updateDoc(rref, {
    status: 'accepted',
    driverId: uid,
    driverName: DRIVER_NAME,
    driverRating: 4.9,
    driverPhone: '+233 24 000 0001',
    driverLoc: { ...start, at: Date.now() },
  });

  await wait(5000);
  console.log('   driver arrived at pickup');
  await updateDoc(rref, { status: 'arrived', driverLoc: { ...start, at: Date.now() } });

  await wait(5000);
  console.log('   trip started');
  await updateDoc(rref, { status: 'in_progress' });

  // Stream a moving position from pickup to dropoff.
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    const lat = start.lat + (end.lat - start.lat) * t;
    const lng = start.lng + (end.lng - start.lng) * t;
    await updateDoc(rref, { driverLoc: { lat, lng, at: Date.now() } });
    await wait(1500);
  }

  console.log(`✓ ride ${rideId} completed`);
  await updateDoc(rref, { status: 'completed' });
}

const uid = await ensureDriver();
console.log(`Demo driver online (${uid}). Waiting for ride requests… (Ctrl+C to stop)`);

const q = query(collection(db, 'rides'), where('status', '==', 'requested'));
onSnapshot(
  q,
  (snap) => {
    snap.docs.forEach((d) => {
      if (!handled.has(d.id)) progressRide(d.id, uid).catch((e) => console.error('progress failed', e));
    });
  },
  (err) => console.error('watch failed', err),
);
