import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

// Ghana national emergency number.
export const EMERGENCY_NUMBER = '112';

export interface SosContext {
  rideId?: string;
  userId: string;
  userName: string;
  role: 'rider' | 'driver';
  from?: string;
  to?: string;
}

// Raise an SOS: capture the current GPS fix, log the alert to Firestore so it
// is auditable / actionable by an operations team, and hand back a ready-to-
// send emergency message plus a maps link. Best-effort on location — an SOS
// must never fail just because a fix isn't available.
export async function triggerSOS(ctx: SosContext): Promise<{ message: string; mapUrl?: string }> {
  let coords: { latitude: number; longitude: number } | null = null;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    }
  } catch {
    // no fix — continue with trip details only
  }

  const mapUrl = coords
    ? `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`
    : undefined;

  const parts = [
    `🚨 VELO SOS from ${ctx.userName} (${ctx.role}).`,
    ctx.from && ctx.to ? `Trip: ${ctx.from} → ${ctx.to}.` : null,
    mapUrl ? `Live location: ${mapUrl}` : 'Location unavailable.',
    'Please send help.',
  ].filter(Boolean);
  const message = parts.join(' ');

  try {
    await addDoc(collection(db, 'sos'), {
      rideId: ctx.rideId ?? null,
      userId: ctx.userId,
      userName: ctx.userName,
      role: ctx.role,
      coords,
      message,
      createdAt: serverTimestamp(),
      clientAt: Date.now(),
    });
  } catch {
    // logging failed — still return the message so the user can call/share
  }

  return { message, mapUrl };
}

// Open the phone dialer on the emergency number.
export function callEmergency() {
  const scheme = Platform.OS === 'ios' ? 'telprompt:' : 'tel:';
  Linking.openURL(`${scheme}${EMERGENCY_NUMBER}`).catch(() => {});
}

// Open the SMS composer pre-filled with the SOS message.
export function shareViaSMS(message: string) {
  const sep = Platform.OS === 'ios' ? '&' : '?';
  Linking.openURL(`sms:${sep}body=${encodeURIComponent(message)}`).catch(() => {});
}
