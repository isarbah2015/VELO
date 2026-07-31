import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LiveMap from '@/components/LiveMap';
import { useApp } from '@/context/AppContext';
import { updateDriverLocation, updateRideStatus } from '@/services/rides';
import { recordCompletedRide } from '@/services/driver';
import { triggerSOS, callEmergency, shareViaSMS, EMERGENCY_NUMBER } from '@/services/safety';
import { Alert } from 'react-native';

const { width, height } = Dimensions.get('window');

// Driver-side live trip: streams the driver's real GPS to Firestore (so the
// rider follows the bike on their map) and steps the ride through its
// lifecycle — accepted → arrived → in_progress → completed. The fare is only
// booked into earnings when the trip actually completes here.
type Phase = 'toPickup' | 'arrived' | 'inProgress';

export default function DriverTripScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshDriverStatus } = useApp();
  const params = useLocalSearchParams<{
    rideId: string; riderName?: string; from?: string; to?: string; price?: string;
  }>();

  const rideId = params.rideId;
  const riderName = params.riderName ?? 'Your rider';
  const from = params.from ?? 'Pickup';
  const to = params.to ?? 'Destination';
  const price = parseFloat(params.price ?? '0');

  const [phase, setPhase] = useState<Phase>('toPickup');
  const startRef = useRef(Date.now());
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 12);

  // Stream real GPS to the ride doc for as long as this screen is mounted.
  useEffect(() => {
    if (!rideId) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 4000 },
          (loc) => updateDriverLocation(rideId, loc.coords.latitude, loc.coords.longitude)
        );
      } catch {
        // No GPS (simulator/web) — the rider still sees status updates.
      }
    })();
    return () => {
      cancelled = true;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [rideId]);

  const arrivedAtPickup = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('arrived');
    if (rideId) await updateRideStatus(rideId, 'arrived');
  };

  const startTrip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('inProgress');
    startRef.current = Date.now();
    if (rideId) await updateRideStatus(rideId, 'in_progress');
  };

  const completeTrip = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const durationMin = Math.max(1, Math.round((Date.now() - startRef.current) / 60000));
    watchRef.current?.remove();
    if (rideId) await updateRideStatus(rideId, 'completed', { durationMin });
    if (user) {
      await recordCompletedRide(user.uid, price);
      await refreshDriverStatus();
    }
    router.replace('/(driver-tabs)');
  };

  const handleSOS = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const { message } = await triggerSOS({
      rideId, userId: user?.uid ?? '', userName: user?.name ?? 'Driver', role: 'driver', from, to,
    });
    Alert.alert(
      'Emergency SOS',
      'Your location and trip details have been logged. What next?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share location', onPress: () => shareViaSMS(message) },
        { text: `Call ${EMERGENCY_NUMBER}`, style: 'destructive', onPress: callEmergency },
      ]
    );
  };

  const primary =
    phase === 'toPickup'
      ? { label: 'Arrived at pickup', onPress: arrivedAtPickup, icon: 'flag-outline' as const }
      : phase === 'arrived'
      ? { label: 'Start trip', onPress: startTrip, icon: 'play' as const }
      : { label: 'Complete trip', onPress: completeTrip, icon: 'checkmark-done' as const };

  const statusLine =
    phase === 'toPickup' ? 'Head to pickup' : phase === 'arrived' ? 'Waiting for rider' : 'Trip in progress';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Full-screen live map */}
      <View style={StyleSheet.absoluteFill}>
        <LiveMap width={width} height={height} mode="route" />
      </View>
      <View style={styles.mapDim} pointerEvents="none" />

      {/* Header pill + SOS */}
      <View style={[styles.header, { top: topPad }]}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{statusLine}</Text>
        </View>
        <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
          <Ionicons name="alert-circle" size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Bottom trip card */}
      <View style={[styles.card, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.riderRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{riderName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName} numberOfLines={1}>{riderName}</Text>
            <Text style={styles.fare}>₵{price.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => router.push({ pathname: '/chat', params: { rideId, otherName: riderName } })}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color="#FFD000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.callBtn}>
            <Ionicons name="call" size={18} color="#000" />
          </TouchableOpacity>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: '#FFD000' }]} />
            <Text style={styles.routeText} numberOfLines={1}>{from}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.routeText} numberOfLines={1}>{to}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={primary.onPress} activeOpacity={0.85}>
          <Ionicons name={primary.icon} size={20} color="#000" />
          <Text style={styles.primaryText}>{primary.label}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  mapDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9,9,11,0.25)' },
  header: {
    position: 'absolute', left: 16, right: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  sosBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#131316',
    borderWidth: 1, borderColor: '#3F1F22', alignItems: 'center', justifyContent: 'center',
  },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#131316', borderWidth: 1, borderColor: '#27272A',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  liveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  card: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#131316', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 22, paddingTop: 18, gap: 16,
    borderTopWidth: 1, borderColor: '#27272A',
  },
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFD000',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#000' },
  riderName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  fare: { fontSize: 14, fontWeight: '600', color: '#FFD000', marginTop: 2 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFD000',
    alignItems: 'center', justifyContent: 'center',
  },
  chatBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#1C1C1F',
    borderWidth: 1, borderColor: '#3F3F46', alignItems: 'center', justifyContent: 'center',
  },
  routeBox: { backgroundColor: '#1C1C1F', borderRadius: 16, padding: 14, gap: 6 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 1, height: 14, backgroundColor: '#3F3F46', marginLeft: 4 },
  routeText: { flex: 1, fontSize: 14, color: '#E4E4E7' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFD000', borderRadius: 16, height: 56,
  },
  primaryText: { fontSize: 17, fontWeight: '800', color: '#000' },
});
