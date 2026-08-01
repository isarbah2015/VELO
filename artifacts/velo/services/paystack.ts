import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/config/firebase';

// VELO does not register a Paystack webhook (the shared Paystack account
// allows only one, already used by another app). Instead, every top-up is
// confirmed by calling /verify — which credits the wallet idempotently — and
// any top-up whose /verify didn't complete (app closed mid-payment) is
// re-verified on the next app return via reconcilePendingTopups().
const PENDING_KEY = 'velo_pending_topups';
const PENDING_TTL_MS = 60 * 60 * 1000; // drop abandoned references after 1h

type Pending = { ref: string; ts: number };

async function readPending(): Promise<Pending[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Pending[]) : [];
  } catch {
    return [];
  }
}

async function writePending(list: Pending[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    // best-effort; reconciliation is only a safety net
  }
}

async function addPending(ref: string): Promise<void> {
  const list = await readPending();
  if (!list.some((p) => p.ref === ref)) list.push({ ref, ts: Date.now() });
  await writePending(list);
}

async function removePending(ref: string): Promise<void> {
  const list = await readPending();
  await writePending(list.filter((p) => p.ref !== ref));
}

// Base URL of the deployed `paystackApi` Cloud Function. Override per-env with
// EXPO_PUBLIC_PAYSTACK_API_URL; defaults to the velo-ride-gh us-central1 URL.
const API_BASE =
  process.env.EXPO_PUBLIC_PAYSTACK_API_URL?.replace(/\/$/, '') ||
  'https://us-central1-velo-ride-gh.cloudfunctions.net/paystackApi';

async function authHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to make a payment');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export interface PaystackConfig {
  configured: boolean;
  publicKey: string | null;
  currency: string;
  channels: string[];
}

export async function getPaystackConfig(): Promise<PaystackConfig> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error('Could not reach payment service');
  return res.json();
}

export interface TopUpResult {
  paid: boolean;
  reference: string;
}

/**
 * Runs a full wallet top-up: initialize → open Paystack checkout (card /
 * mobile money / bank) in the browser → verify. On success the wallet is
 * credited server-side (idempotently). Resolves with the payment outcome.
 */
export async function topUpViaPaystack(amountGhs: number, email: string): Promise<TopUpResult> {
  const headers = await authHeader();
  const returnUrl = Linking.createURL('paystack-callback');

  const initRes = await fetch(`${API_BASE}/initialize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, amountGhs, callbackUrl: returnUrl }),
  });
  const init = await initRes.json();
  if (!initRes.ok || !init.status) {
    throw new Error(init.message || 'Could not start payment');
  }

  const { authorization_url: url, reference } = init.data as {
    authorization_url: string;
    reference: string;
  };

  // Record the reference before opening checkout, so a top-up interrupted by
  // the app being closed can still be reconciled on the next launch.
  await addPending(reference);

  // Opens Paystack's hosted checkout; resolves when the user returns.
  await WebBrowser.openAuthSessionAsync(url, returnUrl);

  // Confirm with the server regardless of how the browser closed.
  const verifyRes = await fetch(`${API_BASE}/verify/${encodeURIComponent(reference)}`, { headers });
  const verify = await verifyRes.json();
  if (!verifyRes.ok || !verify.status) {
    throw new Error(verify.message || 'Could not verify payment');
  }
  const paid = Boolean(verify.paid);
  if (paid) await removePending(reference);
  return { paid, reference };
}

/**
 * Re-verifies any top-up whose /verify never completed (e.g. the app was
 * closed right after paying). Credits the wallet server-side for any that
 * succeeded, and drops references older than the TTL as abandoned. Safe to
 * call on wallet mount / app foreground. Returns true if anything was newly
 * credited, so the caller can refresh the balance.
 */
export async function reconcilePendingTopups(): Promise<boolean> {
  const list = await readPending();
  if (list.length === 0) return false;
  if (!auth.currentUser) return false;

  let headers: Record<string, string>;
  try {
    headers = await authHeader();
  } catch {
    return false;
  }

  let creditedAny = false;
  const remaining: Pending[] = [];
  for (const p of list) {
    try {
      const res = await fetch(`${API_BASE}/verify/${encodeURIComponent(p.ref)}`, { headers });
      const body = await res.json();
      if (res.ok && body.status && body.paid) {
        creditedAny = true; // wallet credited server-side
        continue; // resolved → drop
      }
    } catch {
      // network hiccup — keep it for a later retry (unless it's stale below)
    }
    if (Date.now() - p.ts < PENDING_TTL_MS) remaining.push(p);
  }
  await writePending(remaining);
  return creditedAny;
}
