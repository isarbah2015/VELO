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
// Yandex-Pro style stages: nav to pickup → arrived (wait) → nav to drop-off →
// completed summary (fare + rate rider).
type Phase = 'toPickup' | 'arrived' | 'inProgress' | 'summary';

const FREE_WAIT_MIN = 5; // free wait once arrived at pickup
const ARRIVE_RADIUS_KM = 0.05; // END RIDE unlocks within 50 m of drop-off

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
  const [rating, setRating] = useState(5);
  const [now, setNow] = useState(Date.now()); // 1s ticker for wait/elapsed timers
  const startRef = useRef(0); // trip start (inProgress)
  const arrivedRef = useRef(0); // arrived-at-pickup time
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  // 1s ticker drives the wait timer (Stage 3) and elapsed time (Stage 4).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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
    arrivedRef.current = Date.now();
    setPhase('arrived');
    if (rideId) await updateRideStatus(rideId, 'arrived');
  };

  const startTrip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('inProgress');
    startRef.current = Date.now();
    if (rideId) await updateRideStatus(rideId, 'in_progress');
  };

  // Stage 4 → 5: end ride at the drop-off. Books the fare + shows the summary.
  const endRide = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const durationMin = Math.max(1, Math.round((Date.now() - startRef.current) / 60000));
    watchRef.current?.remove();
    if (rideId) await updateRideStatus(rideId, 'completed', { durationMin });
    if (user) {
      await recordCompletedRide(user.uid, price);
      await refreshDriverStatus();
    }
    setPhase('summary');
  };

  // Stage 5 → IDLE: save the driver's rating of the rider and return.
  const finalizeRide = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (rideId) await updateRideStatus(rideId, 'completed', { riderRating: rating });
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

  // Stage 3 wait timer, Stage 4 elapsed timer, and the drop-off geo-gate.
  const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const waitSec = phase === 'arrived' && arrivedRef.current ? Math.max(0, (now - arrivedRef.current) / 1000) : 0;
  const overFreeWait = waitSec > FREE_WAIT_MIN * 60;
  const elapsedMin = phase === 'inProgress' && startRef.current ? Math.floor((now - startRef.current) / 60000) : 0;
  const atDropoff = !!driverPos && !!destLL && distanceKm(driverPos, destLL) < ARRIVE_RADIUS_KM;
  const canEnd = !driverPos || atDropoff; // no GPS → allow; otherwise require < 50 m
  const statusLine =
    phase === 'toPickup' ? 'to pickup' : phase === 'inProgress' ? 'to destination' : '';
  // Fare breakdown for the Stage-5 summary.
  const baseFare = 5;
  const distanceFare = Math.max(0, price - baseFare);

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
          follow={phase === 'toPickup' || phase === 'inProgress'}
          navMarker={navMarker}
        />
      </View>
      {/* Dim only behind the big cards (arrived / summary); nav views stay clean. */}
      {(phase === 'arrived' || phase === 'summary') && <View style={styles.mapDim} pointerEvents="none" />}

      {/* Corners: SOS (left) + rider avatar (right, after pickup) */}
      <View style={[styles.corners, { top: topPad }]}>
        <TouchableOpacity style={styles.sosBtn} onPress={handleSOS} activeOpacity={0.85}>
          <Ionicons name="alert-circle" size={22} color="#EF4444" />
        </TouchableOpacity>
        {(phase === 'arrived' || phase === 'inProgress') && (
          <TouchableOpacity
            style={styles.riderChipTop}
            onPress={() => router.push({ pathname: '/chat', params: { rideId, otherName: riderName } })}
            activeOpacity={0.85}
          >
            <Text style={styles.riderChipInitial}>{riderName.charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* BIG center-top ETA during navigation (Stages 2 & 4) */}
      {(phase === 'toPickup' || phase === 'inProgress') && etaMin != null && distKm != null && (
        <Animated.View
          style={[
            styles.bigEta,
            { top: topPad, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] },
          ]}
        >
          <Text style={styles.bigEtaMin}>
            {etaMin}<Text style={styles.bigEtaUnit}> min</Text>
          </Text>
          <View style={styles.bigEtaRow}>
            <Animated.View style={[styles.livePulse, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]} />
            <Text style={styles.bigEtaSub}>{distKm.toFixed(1)} km · {statusLine}</Text>
          </View>
        </Animated.View>
      )}

      {/* STAGE 2 — navigating to pickup: minimal bar (address + call + arrived) */}
      {phase === 'toPickup' && (
        <LinearGradient
          colors={['#1B1B1F', '#131316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.miniBar, { paddingBottom: insets.bottom + 14 }]}
        >
          <View style={[styles.miniPin, { borderColor: 'rgba(255,208,0,0.35)', backgroundColor: 'rgba(255,208,0,0.12)' }]}>
            <Ionicons name="navigate" size={16} color="#FFD000" />
          </View>
          <View style={styles.miniTextWrap}>
            <Text style={styles.miniLabel} numberOfLines={1}>PICKUP · {riderName}</Text>
            <Text style={styles.miniTo} numberOfLines={1}>{from}</Text>
          </View>
          <TouchableOpacity style={styles.miniCall} onPress={handleCall} activeOpacity={0.85}>
            <Ionicons name="call" size={18} color="#FFD000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={arrivedAtPickup} activeOpacity={0.9}>
            <LinearGradient colors={['#FFDE5C', '#FFB800']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.miniComplete}>
              <Ionicons name="flag" size={16} color="#000" />
              <Text style={styles.miniCompleteText}>Arrived</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      )}

      {/* STAGE 3 — arrived at pickup: wait timer + call/text + start ride */}
      {phase === 'arrived' && (
        <View style={[styles.card, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.arrivedHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.arrivedTitle}>You've arrived</Text>
              <Text style={styles.arrivedSub} numberOfLines={1}>
                {riderName} · {overFreeWait ? 'paid waiting' : `${FREE_WAIT_MIN} min free wait`}
              </Text>
            </View>
            <View style={[styles.waitBadge, overFreeWait && { borderColor: '#EF4444' }]}>
              <Ionicons name="time-outline" size={15} color={overFreeWait ? '#EF4444' : '#FFD000'} />
              <Text style={[styles.waitText, overFreeWait && { color: '#EF4444' }]}>{clock(waitSec)}</Text>
            </View>
          </View>
          <View style={styles.arrivedActions}>
            <TouchableOpacity style={styles.arrivedAction} onPress={handleCall} activeOpacity={0.85}>
              <Ionicons name="call" size={20} color="#FFD000" />
              <Text style={styles.arrivedActionText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.arrivedAction}
              onPress={() => router.push({ pathname: '/chat', params: { rideId, otherName: riderName } })}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="#FFD000" />
              <Text style={styles.arrivedActionText}>Text</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={startTrip} activeOpacity={0.85}>
            <Ionicons name="play" size={20} color="#000" />
            <Text style={styles.primaryText}>Start ride</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STAGE 4 — in progress: premium drop-off sheet, END RIDE geo-gated */}
      {phase === 'inProgress' && (
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
            <Text style={styles.miniLabel} numberOfLines={1}>DROPPING OFF · {elapsedMin}m</Text>
            <Text style={styles.miniTo} numberOfLines={1}>{to}</Text>
          </View>
          <TouchableOpacity style={styles.miniCall} onPress={handleCall} activeOpacity={0.85}>
            <Ionicons name="call" size={18} color="#FFD000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={endRide} disabled={!canEnd} activeOpacity={0.9}>
            <LinearGradient
              colors={canEnd ? ['#FFDE5C', '#FFB800'] : ['#2A2A2D', '#232326']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.miniComplete}
            >
              <Ionicons name="checkmark-done" size={18} color={canEnd ? '#000' : '#71717A'} />
              <Text style={[styles.miniCompleteText, !canEnd && { color: '#71717A' }]}>{canEnd ? 'End ride' : 'Drive'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      )}

      {/* STAGE 5 — completed: fare summary + rate rider */}
      {phase === 'summary' && (
        <View style={[styles.summaryCard, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.summaryHandle} />
          <View style={styles.summaryCheck}>
            <Ionicons name="checkmark-done" size={28} color="#22C55E" />
          </View>
          <Text style={styles.summaryTitle}>Ride completed</Text>
          <Text style={styles.summarySub} numberOfLines={1}>{from} → {to}</Text>

          <View style={styles.fareBox}>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Base fare</Text>
              <Text style={styles.fareValue}>₵{baseFare.toFixed(2)}</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Distance</Text>
              <Text style={styles.fareValue}>₵{distanceFare.toFixed(2)}</Text>
            </View>
            <View style={styles.fareDivider} />
            <View style={styles.fareRow}>
              <Text style={styles.fareTotalLabel}>Total</Text>
              <Text style={styles.fareTotalValue}>₵{price.toFixed(2)}</Text>
            </View>
          </View>

          <Text style={styles.rateLabel}>Rate {riderName.split(' ')[0]}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => { Haptics.selectionAsync(); setRating(n); }} activeOpacity={0.7}>
                <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={32} color="#FFD000" style={{ marginHorizontal: 4 }} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={finalizeRide} activeOpacity={0.85}>
            <Text style={styles.primaryText}>Complete ride</Text>
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

  // Corners (SOS + rider avatar)
  corners: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  // BIG center-top ETA (Stages 2 & 4)
  bigEta: {
    position: 'absolute', alignSelf: 'center', alignItems: 'center',
    backgroundColor: 'rgba(9,9,11,0.82)', borderRadius: 22,
    borderWidth: 1, borderColor: '#27272A',
    paddingHorizontal: 26, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  bigEtaMin: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', letterSpacing: -1, lineHeight: 38 },
  bigEtaUnit: { color: '#A1A1AA', fontSize: 16, fontWeight: '700' },
  bigEtaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  bigEtaSub: { color: '#D4D4D8', fontSize: 13, fontWeight: '600' },

  // Stage 3 — arrived
  arrivedHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  arrivedTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  arrivedSub: { color: '#A1A1AA', fontSize: 13, fontWeight: '600', marginTop: 2 },
  waitBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#1C1C1F', borderWidth: 1, borderColor: '#3F3F46',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
  },
  waitText: { color: '#FFD000', fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  arrivedActions: { flexDirection: 'row', gap: 12 },
  arrivedAction: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1C1C1F', borderWidth: 1, borderColor: '#3F3F46',
    borderRadius: 14, height: 52,
  },
  arrivedActionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Stage 5 — summary
  summaryCard: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#131316', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: '#27272A',
    paddingHorizontal: 22, paddingTop: 12, alignItems: 'center', gap: 12,
  },
  summaryHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3F3F46' },
  summaryCheck: {
    width: 54, height: 54, borderRadius: 27, marginTop: 4,
    backgroundColor: 'rgba(34,197,94,0.14)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  summaryTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  summarySub: { color: '#A1A1AA', fontSize: 13, fontWeight: '600', maxWidth: '100%' },
  fareBox: {
    width: '100%', backgroundColor: '#1C1C1F', borderRadius: 16, padding: 16, gap: 10,
    borderWidth: 1, borderColor: '#27272A',
  },
  fareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fareLabel: { color: '#A1A1AA', fontSize: 14 },
  fareValue: { color: '#E4E4E7', fontSize: 14, fontWeight: '600' },
  fareDivider: { height: 1, backgroundColor: '#27272A', marginVertical: 2 },
  fareTotalLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  fareTotalValue: { color: '#FFD000', fontSize: 18, fontWeight: '900' },
  rateLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 2 },
  stars: { flexDirection: 'row', marginBottom: 4 },
});
