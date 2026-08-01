import * as Location from 'expo-location';

export type LngLat = [number, number]; // [longitude, latitude] — MapLibre order

// Accra fallbacks so the map always has sensible coordinates even when
// geocoding fails (e.g. no permission / offline / simulator).
export const ACCRA_FALLBACK: LngLat = [-0.187, 5.6037];

/**
 * Turns a typed address ("Osu Oxford Street") into real map coordinates so the
 * pickup/destination markers and driver navigation reflect the actual trip.
 * Returns null on failure — callers fall back to a default.
 */
// Great-circle distance in km between two [lng, lat] points (haversine).
export function distanceKm(a: LngLat, b: LngLat): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Rough ETA in minutes for a city motorbike at ~22 km/h average.
export function etaMinutes(km: number): number {
  return Math.max(1, Math.round((km / 22) * 60));
}

export async function geocode(address: string): Promise<LngLat | null> {
  const q = address?.trim();
  if (!q) return null;
  try {
    // Bias results to Ghana for short local names.
    const results = await Location.geocodeAsync(q.includes(',') ? q : `${q}, Accra, Ghana`);
    if (results && results.length > 0) {
      return [results[0].longitude, results[0].latitude];
    }
  } catch {
    // fall through
  }
  return null;
}
