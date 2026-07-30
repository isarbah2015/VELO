import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Svg, Rect, Circle, Path } from 'react-native-svg';
import * as Location from 'expo-location';

const ACCRA = { latitude: 5.6037, longitude: -0.187 };
const PICKUP = { latitude: 5.6321, longitude: -0.1499 }; // Accra Mall, East Legon
const DEST = { latitude: 5.5558, longitude: -0.1825 }; // Osu Oxford St

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0f0f14' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f0f14' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#71717A' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c1c1f' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0f14' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

// react-native-maps is a native module that Expo Go can't load, so only
// require it outside Expo Go (a dev-client/standalone build). In Expo Go we
// render an SVG street-grid fallback so the app still runs and previews.
const IS_EXPO_GO = Constants.appOwnership === 'expo';
let RNMaps: typeof import('react-native-maps') | null = null;
if (!IS_EXPO_GO) {
  try {
    RNMaps = require('react-native-maps');
  } catch {
    RNMaps = null;
  }
}

function FallbackMap({ width, height, mode }: { width: number; height: number; mode: 'route' | 'nearby' }) {
  const bw = width / 5;
  const bh = height / 8;
  const rw = 12;
  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: '#0C0D10' }}>
      <Svg width={width} height={height}>
        <Rect fill="#0C0D10" width={width} height={height} />
        {Array.from({ length: 5 }).map((_, col) =>
          Array.from({ length: 8 }).map((_, row) => (
            <Rect
              key={`b-${col}-${row}`}
              x={col * bw + rw / 2}
              y={row * bh + rw / 2}
              width={bw - rw}
              height={bh - rw}
              fill="#14141A"
              rx={4}
            />
          ))
        )}
        {Array.from({ length: 9 }).map((_, i) => (
          <Rect key={`hr-${i}`} x={0} y={i * bh - rw / 2} width={width} height={rw} fill="#1A1B22" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <Rect key={`vr-${i}`} x={i * bw - rw / 2} y={0} width={rw} height={height} fill="#1A1B22" />
        ))}
        {mode === 'route' ? (
          <>
            <Path
              d={`M ${width * 0.25} ${height * 0.68} L ${width * 0.5} ${height * 0.68} L ${width * 0.5} ${height * 0.34} L ${width * 0.75} ${height * 0.34}`}
              stroke="#4DB8FF"
              strokeWidth={4}
              strokeDasharray="2 8"
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={width * 0.25} cy={height * 0.68} r={8} fill="#FFD000" />
            <Circle cx={width * 0.75} cy={height * 0.34} r={9} fill="#EF4444" />
            <Circle cx={width * 0.75} cy={height * 0.34} r={4} fill="#FFF" />
          </>
        ) : (
          [[0.3, 0.35], [0.7, 0.45], [0.25, 0.62], [0.72, 0.7], [0.5, 0.8]].map(([fx, fy], i) => (
            <React.Fragment key={i}>
              <Circle cx={width * fx} cy={height * fy} r={16} fill="#FFD000" opacity={0.15} />
              <Circle cx={width * fx} cy={height * fy} r={7} fill="#FFD000" />
            </React.Fragment>
          ))
        )}
        <Circle cx={width * 0.5} cy={height * 0.5} r={22} fill="#4DB8FF" opacity={0.15} />
        <Circle cx={width * 0.5} cy={height * 0.5} r={8} fill="#4DB8FF" />
      </Svg>
    </View>
  );
}

// Real Google Maps on native — requires the Google Maps API key in app.json
// and a dev-client / standalone build (react-native-maps native module).
export default function LiveMap({ width, height, mode }: { width: number; height: number; mode: 'route' | 'nearby' }) {
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (IS_EXPO_GO || !RNMaps) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {
        // location unavailable — keep the Accra default
      }
    })();
  }, []);

  // Expo Go (or any build without the native module): SVG fallback.
  if (IS_EXPO_GO || !RNMaps) {
    return <FallbackMap width={width} height={height} mode={mode} />;
  }

  const MapView = RNMaps.default;
  const { Marker, Polyline, PROVIDER_GOOGLE } = RNMaps;
  const center = userLoc ?? ACCRA;
  const nearby = [
    { latitude: 5.615, longitude: -0.17 },
    { latitude: 5.598, longitude: -0.155 },
    { latitude: 5.59, longitude: -0.2 },
    { latitude: 5.61, longitude: -0.21 },
    { latitude: 5.605, longitude: -0.19 },
  ];

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFill}
        customMapStyle={DARK_MAP_STYLE}
        initialRegion={{ ...center, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {mode === 'route' ? (
          <>
            <Marker coordinate={PICKUP} pinColor="#FFD000" />
            <Marker coordinate={DEST} pinColor="#EF4444" />
            <Polyline coordinates={[PICKUP, center, DEST]} strokeColor="#4DB8FF" strokeWidth={4} />
          </>
        ) : (
          nearby.map((p, i) => <Marker key={i} coordinate={p} pinColor="#FFD000" />)
        )}
      </MapView>
    </View>
  );
}
