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
import { Svg, Rect, Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

const ROUTE_STOPS = [
  { label: 'Accra Mall', sub: 'East Legon, Accra', isStart: true },
  { label: 'Osu Oxford St', sub: 'Osu, Accra', isEnd: true },
];

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [mapMode, setMapMode] = useState<'route' | 'nearby'>('route');
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);
  const tabBarH = isWeb ? 100 : Math.max(insets.bottom, 8) + 80;
  const mapH = height - topPad - tabBarH - 60;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Floating Header */}
      <View style={[styles.header, { top: topPad + 12 }]}>
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

      {/* Full Screen Map */}
      <View style={[styles.mapArea, { marginTop: topPad + 76, height: mapH }]}>
        <FullMap width={width} height={mapH} mode={mapMode} />
      </View>

      {/* Bottom Info Card */}
      <View style={[styles.bottomCard, { paddingBottom: tabBarH + 12 }]}>
        {mapMode === 'route' ? (
          <RouteInfo />
        ) : (
          <NearbyInfo />
        )}
      </View>
    </View>
  );
}

function FullMap({ width, height, mode }: { width: number; height: number; mode: string }) {
  const blockW = width / 5;
  const blockH = height / 6;
  const roadW = 14;

  return (
    <Svg width={width} height={height}>
      {/* Background */}
      <Rect fill="#0C0D10" width={width} height={height} />

      {/* City grid blocks */}
      {[0, 1, 2, 3, 4].map((col) =>
        [0, 1, 2, 3, 4, 5].map((row) => (
          <Rect
            key={`b-${col}-${row}`}
            x={col * blockW + roadW / 2}
            y={row * blockH + roadW / 2}
            width={blockW - roadW}
            height={blockH - roadW}
            fill="#14141A"
            rx={4}
          />
        ))
      )}

      {/* Roads (horizontal) */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <Rect key={`hr-${i}`} x={0} y={i * blockH - roadW / 2} width={width} height={roadW} fill="#1A1B22" />
      ))}

      {/* Roads (vertical) */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Rect key={`vr-${i}`} x={i * blockW - roadW / 2} y={0} width={roadW} height={height} fill="#1A1B22" />
      ))}

      {/* Major road highlight */}
      <Rect x={blockW * 2 - roadW / 2} y={0} width={roadW * 1.8} height={height} fill="#21222C" />
      <Rect x={0} y={blockH * 3 - roadW / 2} width={width} height={roadW * 1.8} fill="#21222C" />

      {mode === 'route' ? (
        <>
          {/* Route path */}
          <Path
            d={`M ${blockW * 0.7} ${blockH * 4.5} 
                L ${blockW * 2} ${blockH * 4.5} 
                L ${blockW * 2} ${blockH * 2} 
                L ${blockW * 3.8} ${blockH * 2}`}
            stroke="#4DB8FF"
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Route glow */}
          <Path
            d={`M ${blockW * 0.7} ${blockH * 4.5} 
                L ${blockW * 2} ${blockH * 4.5} 
                L ${blockW * 2} ${blockH * 2} 
                L ${blockW * 3.8} ${blockH * 2}`}
            stroke="#4DB8FF"
            strokeWidth={14}
            strokeOpacity={0.15}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Start marker (yellow) */}
          <Circle cx={blockW * 0.7} cy={blockH * 4.5} r={10} fill="#FFD000" />
          <Circle cx={blockW * 0.7} cy={blockH * 4.5} r={5} fill="#000" />
          {/* End marker (red) */}
          <Circle cx={blockW * 3.8} cy={blockH * 2} r={14} fill="#EF4444" opacity={0.25} />
          <Circle cx={blockW * 3.8} cy={blockH * 2} r={10} fill="#EF4444" />
          <Circle cx={blockW * 3.8} cy={blockH * 2} r={4} fill="#FFF" />
          {/* Driver icon */}
          <Circle cx={blockW * 2} cy={blockH * 3.5} r={18} fill="#FFD000" />
          <Circle cx={blockW * 2} cy={blockH * 3.5} r={14} fill="#09090B" />
        </>
      ) : (
        <>
          {/* Nearby riders (dots) */}
          {[
            { cx: blockW * 1.2, cy: blockH * 1.5 },
            { cx: blockW * 2.8, cy: blockH * 2.2 },
            { cx: blockW * 0.8, cy: blockH * 3.0 },
            { cx: blockW * 3.5, cy: blockH * 3.8 },
            { cx: blockW * 1.8, cy: blockH * 4.8 },
          ].map((pos, i) => (
            <React.Fragment key={i}>
              <Circle cx={pos.cx} cy={pos.cy} r={20} fill="#FFD000" opacity={0.15} />
              <Circle cx={pos.cx} cy={pos.cy} r={12} fill="#FFD000" opacity={0.5} />
              <Circle cx={pos.cx} cy={pos.cy} r={7} fill="#FFD000" />
            </React.Fragment>
          ))}
          {/* Current location */}
          <Circle cx={width / 2} cy={height / 2} r={30} fill="#4DB8FF" opacity={0.15} />
          <Circle cx={width / 2} cy={height / 2} r={16} fill="#4DB8FF" opacity={0.4} />
          <Circle cx={width / 2} cy={height / 2} r={8} fill="#4DB8FF" />
        </>
      )}
    </Svg>
  );
}

function RouteInfo() {
  return (
    <View style={styles.routeInfoCard}>
      <View style={styles.routeStops}>
        {ROUTE_STOPS.map((stop, i) => (
          <View key={i} style={styles.stopRow}>
            <View style={[styles.stopDot, stop.isEnd && styles.stopDotEnd]} />
            <View style={styles.stopText}>
              <Text style={styles.stopLabel}>{stop.label}</Text>
              <Text style={styles.stopSub}>{stop.sub}</Text>
            </View>
            {i === 0 && <View style={styles.stopConnectorLine} />}
          </View>
        ))}
      </View>

      <View style={styles.routeStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>8 km</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>20 min</Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#FFD000' }]}>₵42</Text>
          <Text style={styles.statLabel}>Est. Fare</Text>
        </View>
      </View>
    </View>
  );
}

function NearbyInfo() {
  return (
    <View style={styles.routeInfoCard}>
      <Text style={styles.nearbyTitle}>5 riders nearby</Text>
      <Text style={styles.nearbySub}>Closest rider is 3 min away</Text>
      <View style={styles.nearbyStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>3 min</Text>
          <Text style={styles.statLabel}>Nearest</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>5</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#22C55E' }]}>Active</Text>
          <Text style={styles.statLabel}>Area Status</Text>
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
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#131316',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  routeInfoCard: {
    gap: 16,
  },
  routeStops: {
    gap: 0,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    position: 'relative',
  },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFD000',
    marginTop: 4,
  },
  stopDotEnd: {
    backgroundColor: '#EF4444',
  },
  stopConnectorLine: {
    position: 'absolute',
    left: 5,
    top: 20,
    bottom: -8,
    width: 2,
    backgroundColor: '#3F3F46',
  },
  stopText: {
    flex: 1,
    gap: 2,
  },
  stopLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stopSub: {
    fontSize: 12,
    color: '#71717A',
  },
  routeStats: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1F',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#27272A',
    alignSelf: 'stretch',
  },
  nearbyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nearbySub: {
    fontSize: 13,
    color: '#71717A',
    marginTop: -8,
  },
  nearbyStats: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1F',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
});
