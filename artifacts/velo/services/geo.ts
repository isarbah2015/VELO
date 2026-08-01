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
