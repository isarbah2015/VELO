import React, { useState } from 'react';
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import LiveMap from '@/components/LiveMap';

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [mapMode, setMapMode] = useState<'route' | 'nearby'>('route');
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);
  const tabBarH = isWeb ? 120 : Math.max(insets.bottom, 8) + 96;
  // The info card below is now a compact floating pill (~104px) instead of
  // a tall bottom sheet, so the map only needs to give up a sliver at the
  // bottom rather than nearly a third of the screen.
  const cardFootprint = 104;
  const mapH = height - topPad - tabBarH - cardFootprint;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Floating Header */}
      <View style={[styles.header, { top: topPad + 8 }]}>
        <View style={styles.headerCard}>
          <View style={styles.headerLeft}>
            <Ionicons name="map" size={18} color="#FFD000" />
            <Text style={styles.headerTitle}>Live Map</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.modeBtn, mapMode === 'route' && styles.modeBtnActive]}
              onPress={() => {
                setMapMode('route');
                Haptics.selectionAsync();
              }}
            >
              <Text style={[styles.modeBtnText, mapMode === 'route' && styles.modeBtnTextActive]}>
                Route
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mapMode === 'nearby' && styles.modeBtnActive]}
              onPress={() => {
                setMapMode('nearby');
                Haptics.selectionAsync();
              }}
            >
              <Text style={[styles.modeBtnText, mapMode === 'nearby' && styles.modeBtnTextActive]}>
                Nearby
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Full Screen Map — now gets the bulk of the viewport */}
      <View style={[styles.mapArea, { marginTop: topPad + 64, height: mapH }]}>
        <LiveMap width={width} height={mapH} mode={mapMode} />
      </View>

      {/* Compact premium info card, floating above the tab bar */}
      <View style={[styles.cardWrap, { bottom: tabBarH - 8 }]}>
        {mapMode === 'route' ? <RouteInfo /> : <NearbyInfo />}
      </View>
    </View>
  );
}

function RouteInfo() {
  return (
    <View style={styles.premiumCard}>
      <LinearGradient
        colors={['rgba(255,208,0,0.10)', 'rgba(19,19,22,0)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.routeCompactRow}>
        <View style={styles.routeCompactCol}>
          <View style={styles.routeCompactStop}>
            <View style={styles.dotYellow} />
            <Text style={styles.routeCompactText} numberOfLines={1}>Accra Mall</Text>
          </View>
          <View style={styles.routeCompactStop}>
            <View style={styles.dotRed} />
            <Text style={styles.routeCompactText} numberOfLines={1}>Osu Oxford St</Text>
          </View>
        </View>
        <View style={styles.vDivider} />
        <View style={styles.statCompact}>
          <Text style={styles.statCompactValue}>8 km</Text>
          <Text style={styles.statCompactLabel}>Distance</Text>
        </View>
        <View style={styles.statCompact}>
          <Text style={styles.statCompactValue}>20 min</Text>
          <Text style={styles.statCompactLabel}>Duration</Text>
        </View>
        <View style={styles.statCompact}>
          <Text style={[styles.statCompactValue, { color: '#FFD000' }]}>₵42</Text>
          <Text style={styles.statCompactLabel}>Fare</Text>
        </View>
      </View>
    </View>
  );
}

function NearbyInfo() {
  return (
    <View style={styles.premiumCard}>
      <LinearGradient
        colors={['rgba(77,184,255,0.10)', 'rgba(19,19,22,0)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.routeCompactRow}>
        <View style={styles.nearbyIconWrap}>
          <Ionicons name="navigate" size={18} color="#4DB8FF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nearbyTitle}>5 riders nearby</Text>
          <Text style={styles.nearbySub}>Closest is 3 min away</Text>
        </View>
        <View style={styles.vDivider} />
        <View style={styles.statCompact}>
          <Text style={[styles.statCompactValue, { color: '#22C55E' }]}>Active</Text>
          <Text style={styles.statCompactLabel}>Area</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
  },
  headerCard: {
    backgroundColor: 'rgba(19,19,22,0.95)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#1C1C1F',
    borderRadius: 20,
    padding: 4,
  },
  modeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modeBtnActive: {
    backgroundColor: '#FFD000',
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717A',
  },
  modeBtnTextActive: {
    color: '#000000',
  },
  mapArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  cardWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
  },
  premiumCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'rgba(19,19,22,0.92)',
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  routeCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeCompactCol: {
    gap: 6,
  },
  routeCompactStop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeCompactText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    maxWidth: 92,
  },
  dotYellow: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFD000' },
  dotRed: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444' },
  vDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#27272A',
  },
  statCompact: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statCompactValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statCompactLabel: {
    fontSize: 10,
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  nearbyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(77,184,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nearbySub: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 1,
  },
});
