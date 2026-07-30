import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import CityMap from './CityMap';

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

  // Expo Go (or any build without the native module): stylized CityMap
  // mockup — same look the rider home uses, so both stay consistent.
  if (IS_EXPO_GO || !RNMaps) {
    return <CityMap width={width} height={height} showRoute={mode === 'route'} />;
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
