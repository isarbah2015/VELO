import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// Reliability layer for an in-progress driver trip. Two jobs, both dependency-
// free (AsyncStorage + expo-notifications, already in the app):
//
//   1. App-kill recovery — the active ride's params are mirrored to
//      AsyncStorage the moment a trip screen mounts, so if the OS kills the app
//      (backgrounded, low memory, crash) the driver can relaunch and resume the
//      exact same live trip instead of silently dropping the passenger.
//   2. Persistent "trip in progress" notification — an ongoing, low-priority
//      notification that keeps the trip visible in the shade while the driver
//      navigates, and clears the instant the trip ends.

const ACTIVE_TRIP_KEY = 'velo_active_trip';
const ONGOING_NOTIF_KEY = 'velo_ongoing_notif_id';

// The full param set driver-trip needs to rehydrate a live trip. Mirrors the
// params passed by the driver home when a request is accepted.
export type ActiveTrip = {
  rideId: string;
  riderName?: string;
  riderPhone?: string;
  from?: string;
  to?: string;
  price?: string;
  fromLat?: string;
  fromLng?: string;
  toLat?: string;
  toLng?: string;
  phase?: string; // last known lifecycle phase, for an accurate resume
  savedAt: number;
};

// A stale record (e.g. a trip that ended while the app was dead and never got
// cleared) shouldn't resurrect hours later — ignore anything older than this.
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6h

export async function saveActiveTrip(trip: Omit<ActiveTrip, 'savedAt'>): Promise<void> {
  try {
    if (!trip.rideId) return;
    const payload: ActiveTrip = { ...trip, savedAt: Date.now() };
    await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(payload));
  } catch {
    // best-effort — recovery is a safety net, never block the trip on it
  }
}

// Update just the phase on the persisted record (cheap, called on each stage
// transition) so a resume lands the driver on the right stage.
export async function updateActiveTripPhase(rideId: string, phase: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
    if (!raw) return;
    const cur = JSON.parse(raw) as ActiveTrip;
    if (cur.rideId !== rideId) return;
    cur.phase = phase;
    cur.savedAt = Date.now();
    await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(cur));
  } catch {
    // best-effort
  }
}

export async function loadActiveTrip(): Promise<ActiveTrip | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
    if (!raw) return null;
    const trip = JSON.parse(raw) as ActiveTrip;
    if (!trip?.rideId) return null;
    if (Date.now() - (trip.savedAt ?? 0) > MAX_AGE_MS) {
      await clearActiveTrip();
      return null;
    }
    return trip;
  } catch {
    return null;
  }
}

export async function clearActiveTrip(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
  } catch {
    // ignore
  }
  await clearOngoingNotification();
}

// Show (or refresh) a single ongoing trip notification. Reuses the stored id so
// stage changes update in place instead of stacking. `sticky`/ongoing keeps it
// pinned on Android; iOS just shows it in the shade.
export async function showOngoingNotification(title: string, body: string): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(ONGOING_NOTIF_KEY);
    if (existing) {
      // Cancel the previous copy so we don't pile up one per stage.
      await Notifications.dismissNotificationAsync(existing).catch(() => {});
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sticky: true, // Android: ongoing / non-dismissable while the trip runs
        priority: Notifications.AndroidNotificationPriority.LOW,
        data: { kind: 'ongoing-trip' },
      },
      trigger: null,
    });
    await AsyncStorage.setItem(ONGOING_NOTIF_KEY, id);
  } catch {
    // notifications are best-effort — never break the trip
  }
}

export async function clearOngoingNotification(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(ONGOING_NOTIF_KEY);
    if (id) {
      await Notifications.dismissNotificationAsync(id).catch(() => {});
      await AsyncStorage.removeItem(ONGOING_NOTIF_KEY);
    }
  } catch {
    // ignore
  }
}
