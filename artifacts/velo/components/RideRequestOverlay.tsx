import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { Ride } from '@/context/AppContext';
import { distanceKm, etaMinutes } from '@/services/geo';

const REQUEST_TIMEOUT = 60; // seconds

// STAGE 1 — full-screen ride request over a blurred map. Shows rider, fare,
// pickup/drop-off, ETA + distance away, and a 60s countdown that auto-declines.
export default function RideRequestOverlay({
  ride,
  onAccept,
  onDecline,
}: {
  ride: Ride;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [remaining, setRemaining] = useState(REQUEST_TIMEOUT);
  const [awayKm, setAwayKm] = useState<number | null>(null);
  const bar = useRef(new Animated.Value(1)).current;
  const enter = useRef(new Animated.Value(0)).current;

  // Distance from the driver to the pickup (for "X km away" + ETA).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' || !ride.fromCoord) return;
        const pos = await Location.getCurrentPositionAsync({});
        if (!alive) return;
        const km = distanceKm([pos.coords.longitude, pos.coords.latitude], [ride.fromCoord.lng, ride.fromCoord.lat]);
        setAwayKm(km < 40 ? km : 2.4); // ignore an implausibly-far sim fix
      } catch {
        setAwayKm(2.4);
      }
    })();
    return () => { alive = false; };
  }, [ride.id]);

  // 60s countdown → auto-decline; depleting bar + haptic ping.
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, friction: 8, tension: 60 }).start();
    Animated.timing(bar, { toValue: 0, duration: REQUEST_TIMEOUT * 1000, useNativeDriver: false }).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(t); onDecline(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride.id]);

  const away = awayKm != null ? `${awayKm.toFixed(1)} km away` : '…';
  const etaPickup = awayKm != null ? `${etaMinutes(awayKm)} min` : '—';

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.scrim} />

      <Animated.View
        style={[
          styles.card,
          { paddingBottom: insets.bottom + 20, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
        ]}
      >
        {/* depleting timer bar */}
        <View style={styles.timerTrack}>
          <Animated.View style={[styles.timerFill, { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
        <Text style={styles.autoDecline}>Auto-declines in {remaining}s</Text>

        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(ride.riderName ?? 'R').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{ride.riderName ?? 'Rider'}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="star" size={13} color="#FFD000" />
              <Text style={styles.meta}>4.9</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.meta}>{away}</Text>
            </View>
          </View>
          <View style={styles.fareBox}>
            <Text style={styles.fare}>₵{ride.price.toFixed(2)}</Text>
            <Text style={styles.fareType}>{ride.type}</Text>
          </View>
        </View>

        <View style={styles.route}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: '#FFD000' }]} />
            <Text style={styles.routeText} numberOfLines={1}>{ride.from}</Text>
            <Text style={styles.etaTag}>{etaPickup}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.routeText} numberOfLines={1}>{ride.to}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.decline} onPress={onDecline} activeOpacity={0.85}>
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 2 }} onPress={onAccept} activeOpacity={0.9}>
            <LinearGradient colors={['#FFDE5C', '#FFB800']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.accept}>
              <Ionicons name="checkmark" size={20} color="#000" />
              <Text style={styles.acceptText}>Accept · ₵{ride.price.toFixed(2)}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9,9,11,0.55)' },
  card: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#131316', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    borderTopWidth: 1, borderColor: '#27272A', paddingHorizontal: 20, paddingTop: 16, gap: 16,
  },
  timerTrack: { height: 5, borderRadius: 3, backgroundColor: '#27272A', overflow: 'hidden' },
  timerFill: { height: '100%', backgroundColor: '#FFD000', borderRadius: 3 },
  autoDecline: { color: '#71717A', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: -8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFD000', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#000' },
  name: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  metaDot: { color: '#52525B', fontSize: 13 },
  fareBox: { alignItems: 'flex-end' },
  fare: { color: '#FFD000', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  fareType: { color: '#71717A', fontSize: 12, fontWeight: '600' },
  route: { backgroundColor: '#1C1C1F', borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: '#27272A' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeText: { flex: 1, color: '#E4E4E7', fontSize: 14, fontWeight: '600' },
  etaTag: { color: '#FFD000', fontSize: 12, fontWeight: '700' },
  routeLine: { width: 1, height: 14, backgroundColor: '#3F3F46', marginLeft: 4 },
  actions: { flexDirection: 'row', gap: 12 },
  decline: {
    flex: 1, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#EF4444',
  },
  declineText: { color: '#EF4444', fontSize: 16, fontWeight: '800' },
  accept: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 16 },
  acceptText: { color: '#000', fontSize: 16, fontWeight: '800' },
});
