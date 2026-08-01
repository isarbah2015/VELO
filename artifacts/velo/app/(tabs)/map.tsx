import React from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import LiveMap from '@/components/LiveMap';

const { width, height } = Dimensions.get('window');

const COLORS = {
  bg: '#09090B',
  surface: '#18181B',
  primary: '#FFD000',
  text: '#FFFFFF',
  textMuted: '#A1A1AA',
  border: '#27272A',
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();

  const nearbyDrivers = [
    { id: 'd1', name: 'Kwame' },
    { id: 'd2', name: 'Ama' },
    { id: 'd3', name: 'Kofi' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Full-screen map — same LiveMap component the home + driver screens use */}
      <View style={StyleSheet.absoluteFill}>
        <LiveMap width={width} height={height} mode="nearby" />
      </View>

      {/* Floating header over the map */}
      <View style={[styles.header, { top: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Live Map</Text>
        <View style={styles.headerBtn}>
          <Ionicons name="bicycle" size={18} color={COLORS.primary} />
        </View>
      </View>

      {/* Floating bottom sheet over the map (clears the tab bar) */}
      <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, 8) + 78 }]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Nearby Riders</Text>
        <Text style={styles.sheetSubtitle}>{nearbyDrivers.length} drivers available</Text>
        <View style={styles.driverList}>
          {nearbyDrivers.map((d) => (
            <View key={d.id} style={styles.driverChip}>
              <View style={styles.driverAvatar}>
                <Ionicons name="person" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.driverName}>{d.name}</Text>
              <View style={styles.driverStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Online</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    position: 'absolute', left: 16, right: 16, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20, fontWeight: '700', color: COLORS.text, letterSpacing: -0.5,
    backgroundColor: 'rgba(9,9,11,0.6)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, overflow: 'hidden',
  },
  headerBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(24,24,27,0.9)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  map: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  loadingText: { marginTop: 12, color: COLORS.textMuted, fontSize: 14 },
  markerContainer: { alignItems: 'center', justifyContent: 'center' },
  markerDot: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
    borderWidth: 3, borderColor: COLORS.bg,
  },
  markerPulse: {
    position: 'absolute', width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255, 208, 0, 0.3)', zIndex: 1,
  },
  bottomSheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10,
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  sheetSubtitle: { fontSize: 14, color: COLORS.textMuted, marginBottom: 16 },
  driverList: { flexDirection: 'row', gap: 10 },
  driverChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  driverAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  driverName: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  driverStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  statusText: { color: '#22C55E', fontSize: 12, fontWeight: '500' },
});
