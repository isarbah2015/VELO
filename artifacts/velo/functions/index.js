// Runtime: Node.js 22 (see engines in package.json + runtime in firebase.json).
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { Expo } = require('expo-server-sdk');
const { createPaystackApp, creditWallet } = require('./paystack-app');
const { createPaystackClient } = require('./paystack-client');

initializeApp();
const db = getFirestore();
const expo = new Expo();

// Collect Expo push tokens stored on a user doc (users/{uid}.pushTokens[]).
async function tokensFor(uid) {
  if (!uid) return [];
  const snap = await db.doc(`users/${uid}`).get();
  const tokens = snap.get('pushTokens') || [];
  return tokens.filter((t) => Expo.isExpoPushToken(t));
}

// Send one notification to a set of tokens, chunked per Expo's limits.
async function send(tokens, title, body, data = {}) {
  if (!tokens.length) return;
  const messages = tokens.map((to) => ({
    to, sound: 'default', title, body, data, channelId: 'rides', priority: 'high',
  }));
  for (const chunk of expo.chunkPushNotificationChunks(messages)) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error('push send failed', err);
    }
  }
}

// Settle the fare when a ride completes. Runs on the trusted server so the
// driver's device is never allowed to touch the rider's wallet, and is
// idempotent: the ride's `settled` flag is flipped inside the same transaction
// that moves the money, so a duplicate status event can't double-charge.
//
//   - wallet: deduct the fare from the rider's walletBalance and log a
//     'deduction' transaction. (Balance can go slightly negative if the rider
//     spent their top-up between booking and completion — the debt is real and
//     recovered on their next top-up, rather than letting the ride go unpaid.)
//   - cash / momo: nothing to move — the driver collects in person — but still
//     mark settled + log the record so the trip shows a payment on both sides.
async function settleRide(rideId) {
  try {
    const rideRef = db.doc(`rides/${rideId}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(rideRef);
      if (!snap.exists) return;
      const ride = snap.data();
      if (ride.settled) return; // already settled — idempotent guard
      const fare = Number(ride.price) || 0;
      const method = ride.paymentMethod || 'cash';
      const riderId = ride.riderId;

      if (method === 'wallet' && riderId && fare > 0) {
        const userRef = db.doc(`users/${riderId}`);
        const userSnap = await tx.get(userRef);
        const balance = Number(userSnap.get('walletBalance')) || 0;
        tx.update(userRef, { walletBalance: balance - fare });
        const txnRef = db.collection(`users/${riderId}/transactions`).doc();
        tx.set(txnRef, {
          type: 'deduction',
          amount: fare,
          description: `Ride · ${ride.from || 'Pickup'} → ${ride.to || 'Destination'}`,
          rideId,
          date: new Date().toISOString(),
        });
      }
      tx.update(rideRef, { settled: true, settledAt: new Date().toISOString(), paidWith: method });
    });
  } catch (err) {
    console.error('settleRide failed', rideId, err);
  }
}

// A rider just booked → notify every online driver so they can grab it.
// This is the trusted, server-side replacement for the client fan-out.
exports.onRideRequested = onDocumentCreated('rides/{rideId}', async (event) => {
  const ride = event.data?.data();
  if (!ride || ride.status !== 'requested') return;

  const drivers = await db.collection('drivers').where('online', '==', true).get();
  const tokenLists = await Promise.all(drivers.docs.map((d) => tokensFor(d.id)));
  const tokens = tokenLists.flat();
  await send(
    tokens,
    'New ride request',
    `${ride.riderName} · ${ride.from} → ${ride.to} · ₵${Number(ride.price).toFixed(2)}`,
    { rideId: event.params.rideId, type: 'request' }
  );
});

// Ride status advanced → push the relevant party. Fires from the trusted
// server on the real Firestore transition, so no client is trusted to notify.
// Fold a rider's 1–5 star rating into the driver's running average. Riders
// can't write the driver doc (rules), so this runs server-side with admin
// rights, inside a transaction, and marks the ride `ratingApplied` so a retry
// or a re-edit can't double-count.
async function applyDriverRating(driverId, rating) {
  const ref = db.collection('drivers').doc(driverId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.data() || {};
    const count = (d.ratingCount || 0) + 1;
    const sum = (d.ratingSum || 0) + rating;
    tx.update(ref, { ratingCount: count, ratingSum: sum, rating: Math.round((sum / count) * 100) / 100 });
  });
}

exports.onRideStatusChange = onDocumentUpdated('rides/{rideId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const rideId = event.params.rideId;

  // Rate-driver loop: when the rider's star rating first appears on the ride,
  // fold it into the driver's average. Runs regardless of a status change so a
  // rating submitted after the trip completes is still counted.
  const newRating = Number(after.rating);
  if (
    newRating >= 1 && newRating <= 5 &&
    after.rating !== before.rating &&
    after.driverId && !after.ratingApplied
  ) {
    await applyDriverRating(after.driverId, newRating);
    await event.data.after.ref.update({ ratingApplied: true });
  }

  if (before.status === after.status) return;
  const riderTokens = await tokensFor(after.riderId);

  switch (after.status) {
    case 'accepted':
      await send(riderTokens, 'Driver found! 🏍️', `${after.driverName || 'Your driver'} is on the way.`, { rideId, type: 'accepted' });
      break;
    case 'arrived':
      await send(riderTokens, 'Your driver has arrived', 'Head out — your VELO is at the pickup point.', { rideId, type: 'arrived' });
      break;
    case 'in_progress':
      await send(riderTokens, 'Trip started', 'Enjoy the ride. Stay safe!', { rideId, type: 'in_progress' });
      break;
    case 'completed':
      await settleRide(rideId);
      await send(riderTokens, 'You have arrived 🎉', 'Thanks for riding with VELO. Rate your trip.', { rideId, type: 'completed' });
      break;
    case 'cancelled': {
      // Notify whichever side did not trigger the cancel.
      const driverTokens = await tokensFor(after.driverId);
      await send([...riderTokens, ...driverTokens], 'Ride cancelled', 'This ride was cancelled.', { rideId, type: 'cancelled' });
      break;
    }
    case 'expired':
      // No driver accepted before the request timed out — let the rider know so
      // they can rebook (covers the case where their app was backgrounded).
      await send(riderTokens, 'No drivers available', 'No driver picked up your request. Tap to try again.', { rideId, type: 'expired' });
      break;
    default:
      break;
  }
});

// ---- Paystack payments (wallet top-ups) --------------------------------
// Secrets are set with:  firebase functions:secrets:set PAYSTACK_SECRET_KEY
const paystackSecretKey = defineSecret('PAYSTACK_SECRET_KEY');
const paystackPublicKey = defineSecret('PAYSTACK_PUBLIC_KEY');

const paystackApp = createPaystackApp(
  () => paystackSecretKey.value(),
  () => (paystackPublicKey.value ? paystackPublicKey.value() : ''),
);

// HTTPS API: /config, /initialize, /verify/:reference
exports.paystackApi = onRequest(
  { secrets: [paystackSecretKey, paystackPublicKey], cors: true },
  paystackApp,
);

// Paystack webhook — credits the wallet server-side even if the app never
// returns to /verify (e.g. user closes the browser after paying).
exports.paystackWebhook = onRequest(
  { secrets: [paystackSecretKey] },
  async (req, res) => {
    try {
      const client = createPaystackClient(paystackSecretKey.value());
      const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
      const sig = req.headers['x-paystack-signature'];
      if (!client.verifyWebhookSignature(raw, sig)) {
        return res.status(401).send('invalid signature');
      }
      const event = req.body;
      if (event && event.event === 'charge.success') {
        const data = event.data || {};
        const meta = data.metadata || {};
        const uid = meta.userId;
        const reference = data.reference;
        if (uid && reference && String(reference).startsWith('VELO_')) {
          const amountGhs = Number(meta.amountGhs) || Number(data.amount) / 100;
          await creditWallet(db, { uid, reference, amountGhs, channel: data.channel });
        }
      }
      res.status(200).send('ok');
    } catch (err) {
      console.error('paystack webhook failed', err);
      res.status(500).send('error');
    }
  },
);
