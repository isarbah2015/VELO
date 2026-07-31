import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/config/firebase';

// Foreground behaviour: still show an alert + play the sound so a driver
// notices an incoming request even with the app open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android needs an explicit high-importance channel to make sound + heads-up.
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('rides', {
    name: 'Ride updates',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FFD000',
    sound: 'default',
  });
}

// Ask permission, get the Expo push token, and persist it on the user doc so
// the other side of a ride can be pushed to. Safe to call on every login —
// tokens are de-duped with arrayUnion. Returns the token, or null when the
// device/permission/environment can't provide one (simulator, web, denied).
export async function registerForPushNotifications(uid: string): Promise<string | null> {
  try {
    await ensureAndroidChannel();
    if (!Device.isDevice) return null; // push tokens need a physical device

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;

    await updateDoc(doc(db, 'users', uid), { pushTokens: arrayUnion(token) });
    return token;
  } catch {
    // Never let notification setup break sign-in.
    return null;
  }
}

// Fire a notification on THIS device immediately (foreground events like a
// driver seeing a new request while the app is open).
export async function notifyLocal(title: string, body: string, data: Record<string, unknown> = {}) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: 'default' },
      trigger: null,
    });
  } catch {
    // ignore — notifications are best-effort
  }
}

// Push to another user across devices via Expo's push service. Reads the
// recipient's stored tokens and posts to the Expo endpoint. This is a
// client-side convenience for a two-phone demo; a production app would send
// this from a trusted backend / Cloud Function instead.
export async function pushToUser(
  uid: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const tokens: string[] = snap.data()?.pushTokens ?? [];
    if (!tokens.length) return;
    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data,
      channelId: 'rides',
      priority: 'high',
    }));
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch {
    // best-effort
  }
}
