import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle as SvgCircle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Camera, Map, Marker, UserLocation, GeoJSONSource, Layer, Images, type CameraRef, type LngLatBounds, type MapRef } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { NAV_ICONS, type NavMarker, navIcon, DEFAULT_NAV_MARKER } from '@/services/navMarker';

// Register every nav icon with MapLibre so a SymbolLayer can stamp it onto the
// map. Keyed by NavIconId ('arrow' | 'sport' | 'okada').
const NAV_IMAGES: Record<string, number> = Object.fromEntries(NAV_ICONS.map((n) => [n.id, n.source]));

// The moving vehicle drawn as a SymbolLayer instead of a Marker. A Marker is a
// billboard — it always faces the screen, so on a tilted (pitch 55) nav camera
// it stands upright and floats. A symbol with icon-pitch-alignment:'map' lies
// flat on the tarmac and icon-rotation-alignment:'map' turns it with the map,
// so it points down the road like Google/Yandex navigation.
function VehicleSymbol({ id, coord, iconId, heading }: { id: string; coord: [number, number]; iconId: string; heading?: number }) {
  return (
    <GeoJSONSource id={`${id}Src`} data={{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: coord } }}>
      <Layer
        id={`${id}Sym`}
        type="symbol"
        layout={{
          'icon-image': iconId,
          // 360px source → keep the puck ~44pt on screen (Google-nav sized).
          'icon-size': 0.12,
          'icon-rotate': heading ?? 0,
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map',
          'icon-anchor': 'center',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        }}
      />
    </GeoJSONSource>
  );
}

// Coordinates are [longitude, latitude] for MapLibre.
const ACCRA: [number, number] = [-0.187, 5.6037];
const PICKUP: [number, number] = [-0.1499, 5.6321]; // Accra Mall, East Legon
const DEST: [number, number] = [-0.1825, 5.5558]; // Osu Oxford St
const NEARBY: [number, number][] = [
  [-0.17, 5.615],
  [-0.155, 5.598],
  [-0.2, 5.59],
  [-0.21, 5.61],
  [-0.19, 5.605],
];

// The app's branded MapTiler dark vector style — shared by the rider home,
// the Live Map tab and the driver dashboard so every map looks identical.
const MAP_STYLE =
  'https://api.maptiler.com/maps/019fb72b-da2a-7737-bf82-300a0176ecaa/style.json?key=dac69jMnq2JsIOwiXh9p';

// A distraction-free variant of the branded style with POI labels/icons hidden
// (shops, landmarks, etc.) for the in-trip driver view — like Uber/Yandex nav.
// The style JSON is fetched once and cached; road and place names are kept so
// the driver still has orientation. Falls back to the plain URL on any failure.
let poiFreeStyle: string | null = null;
let poiFreePromise: Promise<string | null> | null = null;
function loadPoiFreeStyle(): Promise<string | null> {
  if (poiFreeStyle) return Promise.resolve(poiFreeStyle);
  if (poiFreePromise) return poiFreePromise;
  poiFreePromise = fetch(MAP_STYLE)
    .then((r) => r.json())
    .then((style: any) => {
      if (!Array.isArray(style?.layers)) return null;
      for (const layer of style.layers) {
        const id = String(layer.id ?? '');
        const src = String(layer['source-layer'] ?? '');
        if (layer.type === 'symbol' && (/poi/i.test(id) || /poi/i.test(src))) {
          layer.layout = { ...(layer.layout ?? {}), visibility: 'none' };
        }
      }
      poiFreeStyle = JSON.stringify(style);
      return poiFreeStyle;
    })
    .catch(() => null);
  return poiFreePromise;
}

// Demand hot-zones around Accra ([lng, lat, intensity 0..1]) — where riders are
// requesting most, à la Yandex Pro's surge heatmap. Higher intensity = larger,
// hotter (purple→red) blob.
const DEMAND: [number, number, number][] = [
  [-0.1969, 5.6045, 1.0], // Circle / Kwame Nkrumah
  [-0.1727, 5.5605, 0.85], // Osu
  [-0.1499, 5.6321, 0.7], // East Legon
  [-0.2266, 5.5556, 0.6], // Dansoman
  [-0.1668, 5.6516, 0.75], // Madina
  [-0.2055, 5.5738, 0.5], // Kaneshie
  [-0.1312, 5.6155, 0.55], // Adjiringanor
];

// A soft radial-gradient "heat" blob. Fixed screen size (like a surge overlay);
// purple core fading through orange to transparent for high-demand zones.
function HeatBlob({ intensity, index }: { intensity: number; index: number }) {
  const size = 150 + intensity * 170; // hotter = bigger
  const id = `heat-${index}`;
  const core = intensity > 0.8 ? '#B026FF' : intensity > 0.6 ? '#8B3DFF' : '#6D5DF6';
  const mid = intensity > 0.75 ? '#FF4D3D' : '#FF7A3D';
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={core} stopOpacity={0.5} />
          <Stop offset="45%" stopColor={mid} stopOpacity={0.28} />
          <Stop offset="100%" stopColor={mid} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <SvgCircle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

// The driver's own follow puck — a premium top-down PNG marker (pro arrow or a
// motorbike) that rotates to the heading (direction of travel).
function NavPuck({ marker, heading }: { marker?: NavMarker; heading?: number }) {
  const source = navIcon(marker?.icon ?? DEFAULT_NAV_MARKER.icon).source;
  return (
    <View style={styles.puckWrap} pointerEvents="none">
      <Image
        source={source}
        style={[styles.navArrow, heading != null ? { transform: [{ rotate: `${heading}deg` }] } : null]}
        resizeMode="contain"
      />
    </View>
  );
}

function Pin({ color, bike }: { color: string; bike?: boolean }) {
  return (
    <View style={styles.pinWrap}>
      <View style={[styles.pin, { backgroundColor: color }]} />
      {bike ? <View style={[styles.pinPulse, { borderColor: color }]} /> : null}
    </View>
  );
}

export interface LiveMapHandle {
  recenter: () => void; // re-frame the map on the user / trip after the user pans
  zoomIn: () => void;
  zoomOut: () => void;
}

interface LiveMapProps {
  width: number;
  height: number;
  mode: 'route' | 'nearby';
  centerOnUser?: boolean; // on the home maps: recenter on and mark the user's GPS location
  // Optional real coordinates ([lng, lat]); default to the Accra demo route.
  pickup?: [number, number];
  dest?: [number, number];
  driver?: [number, number] | null; // live driver position (bike marker)
  rider?: [number, number] | null; // live rider position at pickup
  routeLine?: [number, number][] | null; // road-following navigation polyline
  showDemand?: boolean; // overlay the rider-demand heatmap (driver view)
  follow?: boolean; // turn-by-turn camera that follows the driver with heading
  navMarker?: NavMarker; // driver's chosen follow-puck icon/colour
  hidePoi?: boolean; // strip POI labels for a distraction-free in-trip view
  heading?: number; // driver's course (deg) to orient the vehicle marker
  onMapTap?: () => void; // a tap on the map (used to reveal the zoom controls)
}

const LiveMap = React.forwardRef<LiveMapHandle, LiveMapProps>(function LiveMap({
  width,
  height,
  mode,
  pickup,
  dest,
  driver,
  rider,
  routeLine,
  showDemand,
  follow,
  navMarker,
  hidePoi,
  heading,
  centerOnUser,
  onMapTap,
}, ref) {
  const p = pickup ?? PICKUP;
  const d = dest ?? DEST;
  const center: [number, number] =
    mode === 'route' ? (driver ?? [(p[0] + d[0]) / 2, (p[1] + d[1]) / 2]) : ACCRA;

  const camRef = React.useRef<CameraRef>(null);
  const mapViewRef = React.useRef<MapRef>(null); // for reading the current zoom
  const userLocRef = React.useRef<[number, number] | null>(null); // latest GPS for recenter

  // Step the zoom relative to the map's current level (for the +/− controls).
  const zoomBy = async (delta: number) => {
    let z = 14;
    try { z = (await mapViewRef.current?.getZoom()) ?? 14; } catch { /* keep default */ }
    camRef.current?.zoomTo(Math.max(3, Math.min(19, z + delta)), { duration: 250 });
  };

  // Bounds framing pickup + destination (+ driver) so the whole trip is visible.
  const tripBounds = React.useCallback((): LngLatBounds | null => {
    if (!pickup || !dest) return null;
    const pts = driver ? [pickup, dest, driver] : [pickup, dest];
    const lngs = pts.map((x) => x[0]);
    const lats = pts.map((x) => x[1]);
    return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
  }, [pickup, dest, driver]);

  // Recenter control: re-fit the trip if one's in view, otherwise fly back to
  // the user's location (used by the floating "locate" button after a pan).
  React.useImperativeHandle(ref, () => ({
    recenter: () => {
      const b = !follow && !centerOnUser ? tripBounds() : null;
      if (b) { camRef.current?.fitBounds(b, { duration: 500 }); return; }
      camRef.current?.flyTo({ center: userLocRef.current ?? driver ?? center, zoom: 15, duration: 500 });
    },
    zoomIn: () => zoomBy(1),
    zoomOut: () => zoomBy(-1),
  }));

  // When asked to hide POIs, swap in the fetched POI-free style once it resolves
  // (until then, the plain style renders so the map never blanks out).
  const [mapStyle, setMapStyle] = React.useState<string>(MAP_STYLE);
  React.useEffect(() => {
    if (!hidePoi) { setMapStyle(MAP_STYLE); return; }
    let alive = true;
    loadPoiFreeStyle().then((s) => { if (alive && s) setMapStyle(s); });
    return () => { alive = false; };
  }, [hidePoi]);

  // Home maps: fetch the user's GPS position once so the camera opens centred on
  // where they actually are (with the nav puck on it), not the Accra demo view.
  const [userLoc, setUserLoc] = React.useState<[number, number] | null>(null);
  React.useEffect(() => {
    if (!centerOnUser) return;
    let alive = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const ll: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        userLocRef.current = ll;
        if (alive) setUserLoc(ll);
      } catch {
        /* permission denied or location off — fall back to the default view */
      }
    })();
    return () => { alive = false; };
  }, [centerOnUser]);

  // Auto-fit the whole trip once pickup + destination are known and we're not
  // following/centred (i.e. just after a match) — like Uber framing the route.
  // Fits once (not on every driver GPS tick) so it doesn't fight panning.
  React.useEffect(() => {
    if (follow || centerOnUser || !pickup || !dest) return;
    const b = tripBounds();
    if (!b) return;
    const t = setTimeout(() => camRef.current?.fitBounds(b, { duration: 700 }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, centerOnUser, pickup?.[0], pickup?.[1], dest?.[0], dest?.[1]]);

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Map ref={mapViewRef} style={StyleSheet.absoluteFill} mapStyle={mapStyle} logo={false} attribution={true} onPress={onMapTap}>
        <Images images={NAV_IMAGES} />
        {follow && driver ? (
          // Turn-by-turn: keep the driver's vehicle centred, rotate the map to
          // their heading, tilted for a 3D nav view (like Uber/Google Maps).
          <Camera
            ref={camRef}
            center={driver}
            bearing={heading ?? 0}
            pitch={55}
            zoom={16}
            easing="ease"
            duration={700}
          />
        ) : follow ? (
          <Camera ref={camRef} trackUserLocation="course" zoom={15.5} pitch={55} />
        ) : centerOnUser ? (
          // Home: lock the camera onto the user's live GPS so the nav puck sits
          // centred (north-up), flying to a fallback view until a fix arrives.
          <Camera
            ref={camRef}
            center={userLoc ?? center}
            zoom={userLoc ? 15 : 12.5}
            easing="ease"
            duration={800}
          />
        ) : (
          <Camera ref={camRef} initialViewState={{ center, zoom: mode === 'route' ? 12.5 : 12.5 }} />
        )}
        {/* Follow/nav modes: puck rides the native UserLocation. On the home maps
            UserLocation doesn't anchor a custom child reliably, so we draw the
            puck as a positioned Marker at the fetched coordinate instead. */}
        <UserLocation>
          {navMarker && !driver && !centerOnUser
            ? <NavPuck marker={navMarker} heading={heading} />
            : null}
        </UserLocation>
        {centerOnUser && userLoc ? (
          <VehicleSymbol id="me" coord={userLoc} iconId={(navMarker ?? DEFAULT_NAV_MARKER).icon} heading={heading} />
        ) : null}

        {showDemand
          ? DEMAND.map(([lng, lat, intensity], i) => (
              <Marker key={`heat${i}`} id={`heat${i}`} lngLat={[lng, lat]}>
                <HeatBlob intensity={intensity} index={i} />
              </Marker>
            ))
          : null}

        {mode === 'route' ? (
          <>
            {routeLine && routeLine.length > 1 ? (
              <GeoJSONSource
                id="navRoute"
                data={{
                  type: 'Feature',
                  properties: {},
                  geometry: { type: 'LineString', coordinates: routeLine },
                }}
              >
                {/* wide translucent casing + bright core line = premium nav look */}
                <Layer
                  id="navRouteCasing"
                  type="line"
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{ 'line-color': '#1E63FF', 'line-width': 10, 'line-opacity': 0.35 }}
                />
                <Layer
                  id="navRouteLine"
                  type="line"
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                  paint={{ 'line-color': '#4DA6FF', 'line-width': 5 }}
                />
              </GeoJSONSource>
            ) : null}
            <Marker id="pickup" lngLat={p}>
              <Pin color="#FFD000" />
            </Marker>
            <Marker id="dest" lngLat={d}>
              <Pin color="#EF4444" />
            </Marker>
            {rider ? (
              <Marker id="rider" lngLat={rider}>
                <Pin color="#4DB8FF" />
              </Marker>
            ) : null}
            {/* The driver's vehicle — their chosen icon, rotated to heading and
                sitting on the road, exactly where the nav camera is centred. */}
            {driver ? (
              <VehicleSymbol id="driver" coord={driver} iconId={(navMarker ?? DEFAULT_NAV_MARKER).icon} heading={heading} />
            ) : null}
          </>
        ) : (
          NEARBY.map((c, i) => (
            <Marker key={`n${i}`} id={`n${i}`} lngLat={c}>
              <Pin color="#FFD000" bike />
            </Marker>
          ))
        )}
      </Map>
    </View>
  );
});

export default LiveMap;

const styles = StyleSheet.create({
  puckWrap: { alignItems: 'center', justifyContent: 'center', width: 48, height: 48 },
  navArrow: { width: 44, height: 44 },
  pinWrap: { alignItems: 'center', justifyContent: 'center' },
  pin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#09090B',
    zIndex: 2,
  },
  pinPulse: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    opacity: 0.5,
  },
});
