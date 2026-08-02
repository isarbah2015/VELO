const express = require('express');
const cors = require('cors');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createPaystackClient, ghsToPesewas } = require('./paystack-client');

// Credits a verified Paystack payment to the user's wallet exactly once.
// Idempotency: the wallet transaction doc id IS the Paystack reference, so a
// retried verify/webhook for the same reference is a no-op inside the txn.
async function creditWallet(db, { uid, reference, amountGhs, channel }) {
  const txRef = db.doc(`users/${uid}/transactions/${reference}`);
  const userRef = db.doc(`users/${uid}`);
  return db.runTransaction(async (t) => {
    const existing = await t.get(txRef);
    if (existing.exists) return { credited: false }; // already applied
    t.set(txRef, {
      type: 'topup',
      amount: amountGhs,
      description: `Wallet top-up via Paystack${channel ? ` (${channel})` : ''}`,
      date: new Date().toISOString(),
      reference,
    });
    t.update(userRef, { walletBalance: FieldValue.increment(amountGhs) });
    return { credited: true };
  });
}

function createPaystackApp(getSecretKey, getPublicKey) {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json());
  const db = getFirestore();

  async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ status: false, message: 'Sign in required' });
    }
    try {
      const decoded = await getAuth().verifyIdToken(header.slice(7));
      req.uid = decoded.uid;
      next();
    } catch {
      res.status(401).json({ status: false, message: 'Invalid auth token' });
    }
  }

  // Public config — lets the app show whether payments are live.
  app.get('/config', (_req, res) => {
    const publicKey = getPublicKey().trim();
    res.json({
      configured: Boolean(getSecretKey().trim()),
      publicKey: publicKey || null,
      currency: 'GHS',
      channels: ['card', 'mobile_money', 'bank'],
    });
  });

  // Start a wallet top-up. Returns the Paystack checkout URL to open.
  app.post('/initialize', requireAuth, async (req, res) => {
    try {
      const { email, amountGhs, callbackUrl } = req.body || {};
      const amount = Number(amountGhs);
      if (!email || !amount || amount < 1) {
        return res.status(400).json({ status: false, message: 'email and amountGhs (>= 1) are required' });
      }
      const client = createPaystackClient(getSecretKey());
      const reference = `VELO_${req.uid.slice(0, 8)}_${Date.now()}`;
      const data = await client.initializeTransaction({
        email: String(email),
        amountPesewas: ghsToPesewas(amount),
        reference,
        callbackUrl: callbackUrl ? String(callbackUrl) : undefined,
        metadata: {
          userId: req.uid,
          amountGhs: amount,
          product: 'velo_wallet_topup',
          custom_fields: [
            { display_name: 'Product', variable_name: 'product', value: 'VELO Wallet Top-up' },
          ],
        },
      });
      res.json({ status: true, data: { ...data, reference } });
    } catch (e) {
      res.status(502).json({ status: false, message: e.message || 'Initialize failed' });
    }
  });

  // Verify a reference and, if paid, credit the wallet (idempotent).
  app.get('/verify/:reference', requireAuth, async (req, res) => {
    try {
      const reference = String(req.params.reference || '').trim();
      if (!reference.startsWith('VELO_')) {
        return res.status(400).json({ status: false, message: 'Invalid reference' });
      }
      const client = createPaystackClient(getSecretKey());
      const data = await client.verifyTransaction(reference);
      const paid = data.status === 'success';
      const metaUid = data.metadata && data.metadata.userId;

      if (paid) {
        if (metaUid !== req.uid) {
          return res.status(403).json({ status: false, message: 'Reference does not belong to you' });
        }
        const amountGhs = Number(data.metadata.amountGhs) || data.amount / 100;
        await creditWallet(db, { uid: req.uid, reference, amountGhs, channel: data.channel });
      }
      res.json({ status: true, paid, data: { reference, amount: data.amount, channel: data.channel } });
    } catch (e) {
      res.status(502).json({ status: false, message: e.message || 'Verify failed' });
    }
  });

  return app;
}

module.exports = { createPaystackApp, creditWallet };
