import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
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

// Real Google Maps on native — requires GOOGLE_MAPS_API_KEY set in app.json
// (ios.config.googleMapsApiKey / android.config.googleMaps.apiKey) and a
// dev-client rebuild, since react-native-maps is a native module Expo Go
// can't load. Falls back to Accra's coordinates until location permission
// is granted.
export default function LiveMap({ width, height, mode }: { width: number; height: number; mode: 'route' | 'nearby' }) {
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
  }, []);

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
        provider={PROVIDER_GOOGLE}
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
