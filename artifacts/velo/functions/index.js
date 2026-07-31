const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { Expo } = require('expo-server-sdk');

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
exports.onRideStatusChange = onDocumentUpdated('rides/{rideId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === after.status) return;

  const rideId = event.params.rideId;
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
      await send(riderTokens, 'You have arrived 🎉', 'Thanks for riding with VELO. Rate your trip.', { rideId, type: 'completed' });
      break;
    case 'cancelled': {
      // Notify whichever side did not trigger the cancel.
      const driverTokens = await tokensFor(after.driverId);
      await send([...riderTokens, ...driverTokens], 'Ride cancelled', 'This ride was cancelled.', { rideId, type: 'cancelled' });
      break;
    }
    default:
      break;
  }
});
