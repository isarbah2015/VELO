import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle as SvgCircle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Camera, Map, Marker, UserLocation, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { type NavMarker, navIcon } from '@/services/navMarker';

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

// The driver's own follow puck — their chosen icon + colour, in a rounded chip
// with a subtle heading notch, sitting on the live GPS position.
function NavPuck({ marker }: { marker: NavMarker }) {
  const ic = navIcon(marker.icon);
  const Family = ic.family === 'mci' ? MaterialCommunityIcons : Ionicons;
  const dark = marker.color === '#FFFFFF' || marker.color === '#FFD000';
  return (
    <View style={styles.puckWrap} pointerEvents="none">
      <View style={[styles.puckHalo, { backgroundColor: marker.color }]} />
      <View style={[styles.puck, { backgroundColor: marker.color }]}>
        <Family name={ic.name as any} size={20} color={dark ? '#000' : '#FFFFFF'} />
      </View>
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

export default function LiveMap({
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
}: {
  width: number;
  height: number;
  mode: 'route' | 'nearby';
  // Optional real coordinates ([lng, lat]); default to the Accra demo route.
  pickup?: [number, number];
  dest?: [number, number];
  driver?: [number, number] | null; // live driver position (bike marker)
  rider?: [number, number] | null; // live rider position at pickup
  routeLine?: [number, number][] | null; // road-following navigation polyline
  showDemand?: boolean; // overlay the rider-demand heatmap (driver view)
  follow?: boolean; // turn-by-turn camera that follows the driver with heading
  navMarker?: NavMarker; // driver's chosen follow-puck icon/colour
}) {
  const p = pickup ?? PICKUP;
  const d = dest ?? DEST;
  const center: [number, number] =
    mode === 'route' ? (driver ?? [(p[0] + d[0]) / 2, (p[1] + d[1]) / 2]) : ACCRA;

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE} logo={false} attribution={true}>
        {follow ? (
          // Turn-by-turn: recenter on the driver and rotate the map to heading,
          // tilted for a 3D nav view (like Uber/Yandex).
          <Camera trackUserLocation="course" zoom={15.5} pitch={55} />
        ) : (
          <Camera initialViewState={{ center, zoom: mode === 'route' ? 12.5 : 12.5 }} />
        )}
        <UserLocation>{navMarker ? <NavPuck marker={navMarker} /> : null}</UserLocation>

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
            {/* The driver's own position is the UserLocation follow-puck above. */}
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
}

const styles = StyleSheet.create({
  puckWrap: { alignItems: 'center', justifyContent: 'center', width: 60, height: 60 },
  puckHalo: { position: 'absolute', width: 56, height: 56, borderRadius: 28, opacity: 0.22 },
  puck: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 6,
  },
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
