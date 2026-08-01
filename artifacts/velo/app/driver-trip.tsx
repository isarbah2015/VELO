import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LiveMap from '@/components/LiveMap';
import { useApp } from '@/context/AppContext';
import { updateDriverLocation, updateRideStatus, watchRide } from '@/services/rides';
import { recordCompletedRide } from '@/services/driver';
import { distanceKm, etaMinutes, getRoute, type RouteResult } from '@/services/geo';
import { triggerSOS, callEmergency, shareViaSMS, EMERGENCY_NUMBER } from '@/services/safety';
import { Alert } from 'react-native';

type LngLat = [number, number];

const { width, height } = Dimensions.get('window');

// Driver-side live trip: streams the driver's real GPS to Firestore (so the
// rider follows the bike on their map) and steps the ride through its
// lifecycle — accepted → arrived → in_progress → completed. The fare is only
// booked into earnings when the trip actually completes here.
type Phase = 'toPickup' | 'arrived' | 'inProgress';

export default function DriverTripScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshDriverStatus, navMarker } = useApp();
  const params = useLocalSearchParams<{
    rideId: string; riderName?: string; riderPhone?: string; from?: string; to?: string; price?: string;
    fromLat?: string; fromLng?: string; toLat?: string; toLng?: string;
  }>();

  const rideId = params.rideId;
  const riderName = params.riderName ?? 'Your rider';
  const riderPhone = params.riderPhone ?? '';
  const from = params.from ?? 'Pickup';
  const to = params.to ?? 'Destination';
  const price = parseFloat(params.price ?? '0');

  const toLL = (lat?: string, lng?: string): LngLat | undefined => {
    const a = parseFloat(lat ?? ''); const o = parseFloat(lng ?? '');
    return Number.isFinite(a) && Number.isFinite(o) ? [o, a] : undefined;
  };
  const pickupLL = toLL(params.fromLat, params.fromLng);
  const destLL = toLL(params.toLat, params.toLng);

  const [phase, setPhase] = useState<Phase>('toPickup');
  const [driverPos, setDriverPos] = useState<LngLat | null>(null);
  const [riderPos, setRiderPos] = useState<LngLat | null>(null);
  const startRef = useRef(Date.now());
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  // Follow the rider's live position (streamed from their tracking screen).
  useEffect(() => {
    if (!rideId) return;
    return watchRide(rideId, (ride) => {
      if (ride?.riderLoc) setRiderPos([ride.riderLoc.lng, ride.riderLoc.lat]);
    });
  }, [rideId]);

  const handleCall = () => {
    const num = riderPhone.replace(/\s/g, '');
    if (!num) { Alert.alert('No number', "The rider's phone number isn't available."); return; }
    Linking.openURL(`tel:${num}`).catch(() => Alert.alert('Cannot call', 'Calling is unavailable on this device.'));
  };

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
          (loc) => {
            setDriverPos([loc.coords.longitude, loc.coords.latitude]);
            updateDriverLocation(rideId, loc.coords.latitude, loc.coords.longitude);
          }
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

  // Navigation target: the rider's pickup while heading there, then the
  // destination once the trip starts.
  const target: LngLat | null =
    phase === 'inProgress' ? destLL ?? null : riderPos ?? pickupLL ?? null;
  // Seed an origin a few km from pickup so the route/ETA read believably when
  // the simulator/device isn't giving a nearby GPS fix; prefer real GPS.
  const seeded: LngLat | null = pickupLL ? [pickupLL[0] + 0.03, pickupLL[1] + 0.028] : null;
  // Prefer real GPS only when it's a plausibly-nearby fix (< 35 km from the
  // target); otherwise fall back to pickup (in-trip) or the seeded point (to
  // pickup) so the simulator's far-away default location can't blow up the ETA.
  const fallbackOrigin: LngLat | null = phase === 'inProgress' ? (pickupLL ?? seeded) : seeded;
  const origin: LngLat | null =
    driverPos && target && distanceKm(driverPos, target) < 35 ? driverPos : fallbackOrigin;

  // Fetch a road-following route for the current leg. Re-runs when the phase or
  // the endpoints change (not on every GPS tick, to avoid hammering the router).
  const [route, setRoute] = useState<RouteResult | null>(null);
  const legKey = `${phase}|${pickupLL?.join()}|${destLL?.join()}|${riderPos?.join()}`;
  useEffect(() => {
    if (!origin || !target) { setRoute(null); return; }
    let alive = true;
    getRoute(origin, target).then((r) => { if (alive) setRoute(r); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legKey]);

  // Live countdown: recompute distance from the driver's *current* position
  // straight to the target on every GPS tick (cheap, no routing API) — the
  // drawn route line stays the road geometry, but the number ticks down as the
  // driver moves. ×1.3 approximates road vs straight-line distance.
  const ROAD_FACTOR = 1.3;
  const liveKm =
    driverPos && target && distanceKm(driverPos, target) < 35
      ? distanceKm(driverPos, target) * ROAD_FACTOR
      : route?.distanceKm ?? (origin && target ? distanceKm(origin, target) * ROAD_FACTOR : null);
  const distKm = liveKm;
  const etaMin = distKm != null ? etaMinutes(distKm) : null;
  const targetLabel = phase === 'inProgress' ? 'to destination' : `to ${riderName.split(' ')[0]}`;

  // Premium touches: a soft entrance + a pulsing "live" dot on the ETA card.
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, [enter, pulse]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Full-screen live map — real pickup/destination + live driver & rider */}
      <View style={StyleSheet.absoluteFill}>
        <LiveMap
          width={width}
          height={height}
          mode="route"
          pickup={pickupLL}
          dest={destLL}
          driver={driverPos}
          rider={riderPos}
          routeLine={route?.coords ?? null}
          follow={phase === 'inProgress'}
          navMarker={navMarker}
        />
      </View>
      {/* Only dim the map when a big card is shown; the in-trip view stays clean. */}
      {phase !== 'inProgress' && <View style={styles.mapDim} pointerEvents="none" />}

      {/* Header: compact live ETA card + SOS */}
      <View style={[styles.header, { top: topPad }]}>
        {etaMin != null && distKm != null ? (
          <Animated.View
            style={[
              styles.etaCard,
              { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }] },
            ]}
          >
            <LinearGradient
              colors={phase === 'inProgress' ? ['#22C55E', '#16A34A'] : ['#FFD000', '#FFA800']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.etaIcon}
            >
              <Ionicons name={phase === 'inProgress' ? 'flag' : 'navigate'} size={15} color="#000" />
            </LinearGradient>
            <View>
              <Text style={styles.etaBig}>
                {etaMin} min <Text style={styles.etaKm}>· {distKm.toFixed(1)} km</Text>
              </Text>
              <View style={styles.etaSubRow}>
                <Animated.View style={[styles.livePulse, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }]} />
                <Text style={styles.etaSub} numberOfLines={1}>{statusLine} · {targetLabel}</Text>
              </View>
            </View>
          </Animated.View>
        ) : (
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{statusLine}</Text>
          </View>
        )}
        <View style={styles.headerRight}>
          {phase === 'inProgress' && (
            <TouchableOpacity
              style={styles.riderChipTop}
              onPress={() => router.push({ pathname: '/chat', params: { rideId, otherName: riderName } })}
              activeOpacity={0.85}
            >
              <Text style={styles.riderChipInitial}>{riderName.charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.sosBtn} onPress={handleSOS}>
            <Ionicons name="alert-circle" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {phase === 'inProgress' ? (
        /* In-trip: distraction-free premium drop-off sheet (full-width, flush
           to the bottom edge — no floating gap). */
        <LinearGradient
          colors={['#1B1B1F', '#131316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.miniBar, { paddingBottom: insets.bottom + 14 }]}
        >
          <View style={styles.miniPin}>
            <Ionicons name="location" size={17} color="#EF4444" />
          </View>
          <View style={styles.miniTextWrap}>
            <Text style={styles.miniLabel} numberOfLines={1}>DROPPING OFF</Text>
            <Text style={styles.miniTo} numberOfLines={1}>{to}</Text>
          </View>
          <TouchableOpacity style={styles.miniCall} onPress={handleCall} activeOpacity={0.85}>
            <Ionicons name="call" size={18} color="#FFD000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={completeTrip} activeOpacity={0.9}>
            <LinearGradient
              colors={['#FFDE5C', '#FFB800']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.miniComplete}
            >
              <Ionicons name="checkmark-done" size={18} color="#000" />
              <Text style={styles.miniCompleteText}>Complete</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      ) : (
        /* Heading to / at pickup: full rider card so the driver can identify +
           contact the rider and confirm arrival. */
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
            <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.85}>
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
      )}
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sosBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#131316',
    borderWidth: 1, borderColor: '#3F1F22', alignItems: 'center', justifyContent: 'center',
  },
  riderChipTop: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFD000',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  riderChipInitial: { fontSize: 20, fontWeight: '800', color: '#000' },
  miniBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: '#2A2A2D',
    paddingHorizontal: 16, paddingTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 24,
  },
  miniPin: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  miniTextWrap: { flex: 1, justifyContent: 'center' },
  miniLabel: { color: '#8A8A93', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  miniTo: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginTop: 2, letterSpacing: -0.3 },
  miniCall: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#1C1C1F',
    borderWidth: 1, borderColor: '#3F3F46', alignItems: 'center', justifyContent: 'center',
  },
  miniComplete: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 14, height: 44, paddingHorizontal: 13,
  },
  miniCompleteText: { fontSize: 15, fontWeight: '800', color: '#000' },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#131316', borderWidth: 1, borderColor: '#27272A',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  liveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  // Compact premium ETA card
  etaCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(19,19,22,0.94)', borderWidth: 1, borderColor: '#2A2A2D',
    paddingLeft: 8, paddingRight: 16, paddingVertical: 8, borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  etaIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  etaBig: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  etaKm: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  etaSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  etaSub: { color: '#71717A', fontSize: 11, fontWeight: '600' },
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
