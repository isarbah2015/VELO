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

// Shortest distance (km) from a point to a polyline — used to detect when a
// driver has strayed off the drawn route so we can recompute it. Projects onto
// each segment with a local equirectangular approximation (accurate at city
// scale, and cheap enough to run on every GPS tick).
export function distanceToPathKm(point: LngLat, path: LngLat[]): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return distanceKm(point, path[0]);
  const R = 6371;
  const latRad = (point[1] * Math.PI) / 180;
  const kx = ((Math.PI / 180) * R) * Math.cos(latRad); // km per ° lng at this lat
  const ky = (Math.PI / 180) * R; // km per ° lat
  const px = point[0] * kx;
  const py = point[1] * ky;
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const ax = path[i][0] * kx, ay = path[i][1] * ky;
    const bx = path[i + 1][0] * kx, by = path[i + 1][1] * ky;
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0;
    const cx = ax + t * dx, cy = ay + t * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d < min) min = d;
  }
  return min;
}

// Compass bearing (0–360°, 0 = north) from point a to point b — used to orient
// the driver's vehicle marker along its direction of travel during navigation.
export function bearing(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x =
    Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

// Rough ETA in minutes for a city motorbike at ~22 km/h average.
export function etaMinutes(km: number): number {
  return Math.max(1, Math.round((km / 22) * 60));
}

// A single turn-by-turn maneuver parsed from OSRM's step data — enough to voice
// "In 200 m, turn left onto Ring Road East" and know where it happens.
export interface RouteStep {
  location: LngLat; // where the maneuver occurs ([lng, lat])
  type: string; // OSRM maneuver type: 'turn' | 'depart' | 'arrive' | 'roundabout' | …
  modifier?: string; // 'left' | 'right' | 'slight left' | 'straight' | …
  name: string; // road name for the step ('' if unnamed)
  distanceM: number; // length of the step in metres
}

export interface RouteResult {
  coords: LngLat[]; // polyline following roads (or a straight line on fallback)
  distanceKm: number;
  durationMin: number;
  steps: RouteStep[]; // turn-by-turn maneuvers (empty on straight-line fallback)
}

/**
 * Road-following route between two points via the public OSRM server, so the
 * driver map draws a real navigation line (like Yandex/Google) and can voice
 * turn-by-turn directions. Falls back to a straight line + haversine estimate
 * if the network/route lookup fails.
 */
export async function getRoute(from: LngLat, to: LngLat): Promise<RouteResult> {
  const km = distanceKm(from, to);
  const fallback: RouteResult = { coords: [from, to], distanceKm: km, durationMin: etaMinutes(km), steps: [] };
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    const json = await res.json();
    const route = json?.routes?.[0];
    const coords: LngLat[] | undefined = route?.geometry?.coordinates;
    if (coords && coords.length > 1) {
      const steps: RouteStep[] = [];
      for (const leg of route.legs ?? []) {
        for (const s of leg.steps ?? []) {
          const loc = s?.maneuver?.location;
          if (!Array.isArray(loc)) continue;
          steps.push({
            location: [loc[0], loc[1]],
            type: String(s.maneuver.type ?? 'turn'),
            modifier: s.maneuver.modifier ? String(s.maneuver.modifier) : undefined,
            name: String(s.name ?? ''),
            distanceM: Number(s.distance ?? 0),
          });
        }
      }
      return {
        coords,
        distanceKm: (route.distance ?? km * 1000) / 1000,
        durationMin: Math.max(1, Math.round((route.duration ?? 0) / 60)) || etaMinutes(km),
        steps,
      };
    }
  } catch {
    // offline / server down — straight-line fallback
  }
  return fallback;
}

// Turn a parsed maneuver into a spoken instruction, e.g.
// "In 200 meters, turn left onto Ring Road East." The distance prefix is
// optional so we can also announce the maneuver itself at the turn.
export function maneuverText(step: RouteStep, withDistance?: number): string {
  const road = step.name ? ` onto ${step.name}` : '';
  let action: string;
  switch (step.type) {
    case 'depart': action = step.name ? `Head onto ${step.name}` : 'Start driving'; break;
    case 'arrive': return 'You have reached your destination.';
    case 'roundabout':
    case 'rotary': action = `At the roundabout, take the exit${road}`; break;
    case 'merge': action = `Merge${road}`; break;
    case 'fork': action = `Keep ${step.modifier ?? 'straight'}${road}`; break;
    case 'end of road': action = `Turn ${step.modifier ?? 'ahead'}${road}`; break;
    case 'continue': action = `Continue ${step.modifier ?? 'straight'}${road}`; break;
    default:
      action = step.modifier ? `Turn ${step.modifier}${road}` : `Continue${road}`;
  }
  if (withDistance && withDistance >= 30) {
    const m = Math.round(withDistance / 10) * 10;
    const dist = m >= 1000 ? `${(m / 1000).toFixed(1)} kilometers` : `${m} meters`;
    return `In ${dist}, ${action.charAt(0).toLowerCase()}${action.slice(1)}.`;
  }
  return `${action}.`;
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
