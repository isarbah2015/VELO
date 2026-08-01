const { createHmac, timingSafeEqual } = require('node:crypto');

const PAYSTACK_API = 'https://api.paystack.co';

// GHS is charged in pesewas (1 GHS = 100 pesewas).
function ghsToPesewas(amountGhs) {
  return Math.round(Number(amountGhs) * 100);
}

class PaystackClient {
  constructor(secretKey) {
    this.secretKey = secretKey;
  }

  headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initializeTransaction({ email, amountPesewas, reference, callbackUrl, metadata }) {
    const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        email,
        amount: amountPesewas,
        currency: 'GHS',
        reference,
        callback_url: callbackUrl,
        metadata,
        channels: ['card', 'mobile_money', 'bank'],
      }),
    });
    const body = await res.json();
    if (!res.ok || !body.status || !body.data) {
      throw new Error(body.message || `Paystack initialize failed (${res.status})`);
    }
    return body.data; // { authorization_url, access_code, reference }
  }

  async verifyTransaction(reference) {
    const res = await fetch(
      `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: this.headers() },
    );
    const body = await res.json();
    if (!res.ok || !body.status || !body.data) {
      throw new Error(body.message || `Paystack verify failed (${res.status})`);
    }
    return body.data; // { status, reference, amount, currency, paid_at, channel, metadata }
  }

  verifyWebhookSignature(rawBody, signature) {
    if (!signature) return false;
    const digest = createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}

function createPaystackClient(secretKey) {
  const key = (secretKey || '').trim();
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured');
  return new PaystackClient(key);
}

module.exports = { PaystackClient, createPaystackClient, ghsToPesewas };
