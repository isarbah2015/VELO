// Runtime: Node.js 22 (see engines in package.json + runtime in firebase.json).
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
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

      // Only wallet rides are settled in-app. 'cash' and 'momo' are paid to the
      // driver directly (hand-to-hand cash or a MoMo transfer) — VELO has no
      // in-app MoMo charge rail (Paystack only tops up the wallet), so there is
      // deliberately nothing to debit here for those methods.
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
      // Notify whichever side did not trigger the cancel, with the stated
      // reason if one was given. Cancelling is always free for both sides.
      const driverTokens = await tokensFor(after.driverId);
      const reasonSuffix = after.cancellationReason ? ` Reason: ${after.cancellationReason}` : '';
      if (after.cancelledBy === 'driver') {
        await send(riderTokens, 'Ride cancelled', `Your driver cancelled the ride.${reasonSuffix}`, { rideId, type: 'cancelled' });
      } else if (after.cancelledBy === 'rider') {
        await send(driverTokens, 'Ride cancelled', `The rider cancelled the ride.${reasonSuffix}`, { rideId, type: 'cancelled' });
      } else {
        await send([...riderTokens, ...driverTokens], 'Ride cancelled', 'This ride was cancelled.', { rideId, type: 'cancelled' });
      }
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

// Terminal ride states — once reached, a share link should stop showing
// anything (the trip is over, so there's nothing live left to track).
const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'expired']);

// Mirrors a rider-shared ride into a public, unauthenticated-readable doc so
// the "Share" links in the app (see services/rides.ts enableSharing) work for
// anyone, without a VELO account — like Uber/Bolt's trip-tracking links.
// Deliberately narrow: no phone numbers, no fare, nothing but what a stranger
// glancing at the link should be able to see. Runs server-side specifically
// so the client never has direct write access to this collection — see
// firestore.rules (`publicTracking` is read-only from the client).
exports.mirrorRideForSharing = onDocumentWritten('rides/{rideId}', async (event) => {
  const rideId = event.params.rideId;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  const publicRef = db.doc(`publicTracking/${rideId}`);

  if (!after || !after.sharingEnabled || TERMINAL_STATUSES.has(after.status)) {
    await publicRef.delete().catch(() => {});
    return;
  }

  await publicRef.set({
    status: after.status ?? null,
    riderName: after.riderName ?? null,
    driverName: after.driverName ?? null,
    from: after.from ?? null,
    to: after.to ?? null,
    vehicle: after.vehicle ?? null,
    driverLoc: after.driverLoc ?? null,
    updatedAt: new Date().toISOString(),
  });
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

// Account deletion (Apple Guideline 5.1.1(v) / Google Play data-safety
// requirement: an app that lets you create an account must let you delete it
// from inside the app). Runs with Admin privileges so it can remove the
// caller's own data regardless of Firestore/Storage security rules, and can
// delete the Auth user without requiring a recent re-login. Callers may only
// ever delete their own uid — there is no "delete other user" path.
exports.deleteAccount = onCall(async (request) => {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const bucket = getStorage().bucket();
  await Promise.all([
    db.doc(`users/${uid}`).delete().catch(() => {}),
    db.doc(`drivers/${uid}`).delete().catch(() => {}),
    bucket.deleteFiles({ prefix: `avatars/${uid}/` }).catch(() => {}),
    bucket.deleteFiles({ prefix: `verification/${uid}/` }).catch(() => {}),
  ]);

  // Delete the Auth account last so a failure above still leaves the user
  // able to retry (an already-deleted Auth account can't retry at all).
  await getAuth().deleteUser(uid);

  return { success: true };
});
