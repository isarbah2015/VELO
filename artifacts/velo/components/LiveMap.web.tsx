import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Accra, Ghana — same fixed reference point used across the app's mock
// ride data (Accra Mall / Osu Oxford St).
const ACCRA = { lat: 5.6037, lng: -0.187 };
const PICKUP = { lat: 5.6321, lng: -0.1499 }; // Accra Mall, East Legon
const DEST = { lat: 5.5558, lng: -0.1825 }; // Osu Oxford St

function markerIcon(color: string, size = 14) {
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 4px ${color}33"></div>`,
    className: '',
    iconSize: [size, size],
  });
}

function Recenter({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng]);
  }, [center.lat, center.lng]);
  return null;
}

// react-native-maps has no web target at all, so the web build renders a
// real interactive Leaflet map (free OSM/CARTO tiles, no API key) instead
// of the old abstract SVG city grid — same approach used for VELO's
// sibling ride-hailing app earlier this session.
export default function LiveMap({ width, height, mode }: { width: number; height: number; mode: 'route' | 'nearby' }) {
  const nearby = [
    { lat: 5.615, lng: -0.17 },
    { lat: 5.598, lng: -0.155 },
    { lat: 5.59, lng: -0.2 },
    { lat: 5.61, lng: -0.21 },
    { lat: 5.605, lng: -0.19 },
  ];

  return (
    <View style={[styles.wrap, { width, height }]}>
      <MapContainer center={[ACCRA.lat, ACCRA.lng]} zoom={13} zoomControl={false} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <Recenter center={mode === 'route' ? ACCRA : ACCRA} />

        {mode === 'route' ? (
          <>
            <Marker position={[PICKUP.lat, PICKUP.lng]} icon={markerIcon('#FFD000', 16)} />
            <Marker position={[DEST.lat, DEST.lng]} icon={markerIcon('#EF4444', 16)} />
            <Polyline
              positions={[[PICKUP.lat, PICKUP.lng], [ACCRA.lat, ACCRA.lng], [DEST.lat, DEST.lng]]}
              pathOptions={{ color: '#4DB8FF', weight: 4, dashArray: '2 8' }}
            />
          </>
        ) : (
          <>
            <Marker position={[ACCRA.lat, ACCRA.lng]} icon={markerIcon('#4DB8FF', 18)} />
            {nearby.map((p, i) => (
              <Marker key={i} position={[p.lat, p.lng]} icon={markerIcon('#FFD000', 12)} />
            ))}
          </>
        )}
      </MapContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#0C0D10' },
});
