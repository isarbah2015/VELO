import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import LiveMap from '@/components/LiveMap';
import { useApp, type Ride } from '@/context/AppContext';
import { watchDriverRequests } from '@/services/rides';
import { acceptRide, declineRide, RideUnavailableError } from '@/services/driver';
import { notifyLocal } from '@/services/notifications';
import { loadActiveTrip, clearActiveTrip } from '@/services/tripSession';
import { distanceKm } from '@/services/geo';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { tierProgress, tierCanServe } from '@/services/tiers';
import RideRequestOverlay from '@/components/RideRequestOverlay';

const { width, height } = Dimensions.get('window');

// Driver home = a clean live map to receive rides (Bolt/Uber-Driver style).
// The map is the whole screen; a slim status strip floats at the top and a
// single action panel floats at the bottom. Detailed stats and the weekly
// chart live on the Earnings tab, so nothing is lost by keeping this clean.
export default function DriverHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, driverStatus, setOnline, refreshDriverStatus, navMarker } = useApp();
  const [requests, setRequests] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);
  const tabBarH = isWeb ? 84 : Math.max(insets.bottom, 8) + 66;

  const online = driverStatus?.online ?? false;
  const tp = tierProgress(driverStatus?.totalRides ?? 0, driverStatus?.rating ?? 5);
  const router = useRouter();
  const seenIds = useRef<Set<string>>(new Set());
  // Driver's current position, for nearest-request dispatch ordering.
  const [driverLL, setDriverLL] = useState<[number, number] | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Track the driver's position while online so incoming requests can be
  // ordered nearest-first. Best-effort — no GPS just falls back to newest-first.
  useEffect(() => {
    if (!online) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 10000 },
          (loc) => setDriverLL([loc.coords.longitude, loc.coords.latitude])
        );
      } catch {
        // no GPS — nearest ordering just won't apply
      }
    })();
    return () => { cancelled = true; sub?.remove(); };
  }, [online]);

  // Keep driver stats fresh whenever this screen mounts.
  useEffect(() => { refreshDriverStatus(); }, [refreshDriverStatus]);

  // App-kill recovery: if a live trip was interrupted (app killed mid-ride),
  // offer to jump straight back into it on next launch. Runs once per mount.
  const resumeChecked = useRef(false);
  useEffect(() => {
    if (resumeChecked.current) return;
    resumeChecked.current = true;
    loadActiveTrip().then((trip) => {
      if (!trip) return;
      Alert.alert(
        'Resume active trip?',
        `You have an unfinished trip${trip.to ? ` to ${trip.to}` : ''}. Continue where you left off?`,
        [
          { text: 'Discard', style: 'destructive', onPress: () => clearActiveTrip() },
          {
            text: 'Resume',
            onPress: () =>
              router.push({
                pathname: '/driver-trip',
                params: {
                  rideId: trip.rideId,
                  riderName: trip.riderName ?? '',
                  riderPhone: trip.riderPhone ?? '',
                  from: trip.from ?? '',
                  to: trip.to ?? '',
                  price: trip.price ?? '0',
                  fromLat: trip.fromLat ?? '',
                  fromLng: trip.fromLng ?? '',
                  toLat: trip.toLat ?? '',
                  toLng: trip.toLng ?? '',
                },
              }),
          },
        ]
      );
    });
  }, [router]);

  // Subscribe to the open-request pool in realtime, but only while online —
  // a rider's booking then appears instantly with no manual refresh, and a
  // local notification fires so the driver notices even without watching.
  useEffect(() => {
    if (!online) {
      setRequests([]);
      setLoading(false);
      seenIds.current.clear();
      return;
    }
    setLoading(true);
    let first = true;
    const unsub = watchDriverRequests((reqs) => {
      if (!first) {
        const fresh = reqs.find((r) => !seenIds.current.has(r.id));
        if (fresh) {
          notifyLocal('New ride request', `${fresh.riderName} · ${fresh.from} → ${fresh.to} · ₵${fresh.price.toFixed(2)}`, { rideId: fresh.id });
        }
      }
      reqs.forEach((r) => seenIds.current.add(r.id));
      first = false;
      setRequests(reqs);
      setLoading(false);
    });
    return unsub;
  }, [online]);

  // A driver must clear Ghana Card / vehicle verification before they can go
  // online and receive requests. Read the review state off the driver doc.
  const verifyStatus = driverStatus?.verification?.status ?? 'unverified';
  const isVerified = verifyStatus === 'verified';

  const toggleOnline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Gate: block going online until verified. Toggling offline is always fine.
    if (!online && !isVerified) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        verifyStatus === 'pending' ? 'Verification under review' : 'Verification required',
        verifyStatus === 'pending'
          ? "Your documents are being reviewed. You'll be able to go online once approved."
          : 'Submit your Ghana Card and motorcycle photos to start accepting rides.',
        verifyStatus === 'pending'
          ? [{ text: 'OK' }]
          : [
              { text: 'Not now', style: 'cancel' },
              { text: 'Verify now', onPress: () => router.push('/driver-verify') },
            ]
      );
      return;
    }
    setOnline(!online);
  };

  const respond = async (ride: Ride, accepted: boolean) => {
    if (!user || accepting) return;
    if (!accepted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setRequests((prev) => prev.filter((r) => r.id !== ride.id));
      await declineRide(ride.id);
      return;
    }
    // Accept path: claim the ride first (transaction), and only navigate if we
    // actually won it. If another driver got there first, keep this driver in
    // the pool and tell them, instead of pushing into a trip they don't own.
    setAccepting(true);
    try {
      await acceptRide(ride.id, user.uid, user.name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRequests((prev) => prev.filter((r) => r.id !== ride.id));
      // The rider's "Driver found" push fires server-side from the
      // onRideStatusChange Cloud Function (trusted). Go to the live trip
      // screen — the fare settles there on completion, not on accept.
      router.push({
        pathname: '/driver-trip',
        params: {
          rideId: ride.id,
          riderName: ride.riderName,
          riderPhone: ride.riderPhone ?? '',
          from: ride.from,
          to: ride.to,
          price: String(ride.price),
          fromLat: String(ride.fromCoord?.lat ?? ''),
          fromLng: String(ride.fromCoord?.lng ?? ''),
          toLat: String(ride.toCoord?.lat ?? ''),
          toLng: String(ride.toCoord?.lng ?? ''),
        },
      });
    } catch (e) {
      // Lost the accept race (or the rider cancelled/expired) — drop it from the
      // pool and let the driver pick up the next one.
      setRequests((prev) => prev.filter((r) => r.id !== ride.id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const reason =
        e instanceof RideUnavailableError && e.reason === 'cancelled'
          ? 'The rider cancelled this request.'
          : 'Another driver just took this ride.';
      Alert.alert('Ride unavailable', reason);
    } finally {
      setAccepting(false);
    }
  };

  // Surface only requests this driver's tier can serve (a Standard driver won't
  // get Premium/Bossu rides until promoted), ordered nearest-first when we have
  // the driver's GPS so the closest rider is offered before farther ones.
  const eligible = online && isVerified ? requests.filter((r) => tierCanServe(tp.tier, r.type)) : [];
  const incoming = driverLL
    ? [...eligible].sort((a, b) => {
        const da = a.fromCoord ? distanceKm(driverLL, [a.fromCoord.lng, a.fromCoord.lat]) : Infinity;
        const db = b.fromCoord ? distanceKm(driverLL, [b.fromCoord.lng, b.fromCoord.lat]) : Infinity;
        return da - db;
      })[0]
    : eligible[0];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Full-screen map with the rider-demand heatmap (Yandex-Pro style) */}
      <View style={StyleSheet.absoluteFill}>
        <LiveMap width={width} height={height} mode="nearby" showDemand navMarker={navMarker} centerOnUser />
      </View>
      <View style={styles.mapDim} pointerEvents="none" />

      {/* Top status strip — no boxed card, floats over the map */}
      <View style={[styles.topStrip, { paddingTop: topPad + 8 }]}>
        <View style={styles.greetChip}>
          <View style={[styles.statusDot, { backgroundColor: online ? '#22C55E' : '#71717A' }]} />
          <Text style={styles.greetText} numberOfLines={1}>
            {user?.name?.split(' ')[0] ?? 'Driver'}
          </Text>
        </View>
        <View style={styles.metricsChip}>
          <Ionicons name="wallet-outline" size={14} color="#FFD000" />
          <Text style={styles.metricText}>₵{(driverStatus?.todayEarnings ?? 0).toFixed(0)}</Text>
          <View style={styles.metricDivider} />
          <Ionicons name="star" size={13} color="#FFD000" />
          <Text style={styles.metricText}>{(driverStatus?.rating ?? 5).toFixed(1)}</Text>
        </View>
      </View>

      {/* Bottom action panel */}
      <View style={[styles.bottomWrap, { bottom: tabBarH + 8 }]}>
        {/* Driver tier + promotion progress — sits just above the status panel */}
        {!incoming && (
          <View style={styles.tierPill}>
            <Ionicons name={tp.tier === 'bossu' ? 'flash' : tp.tier === 'premium' ? 'shield-checkmark' : 'speedometer'} size={14} color="#FFD000" />
            <Text style={styles.tierName}>{tp.current.label}</Text>
            {tp.next ? (
              <>
                <View style={styles.tierBarTrack}>
                  <View style={[styles.tierBarFill, { width: `${Math.round(tp.ridesProgress * 100)}%` }]} />
                </View>
                <Text style={styles.tierNext} numberOfLines={1}>
                  {tp.ridesToNext > 0 ? `${tp.ridesToNext} rides` : 'keep rating'}{tp.ratingNeeded ? ` +${tp.ratingNeeded}★` : ''} → {tp.next.label}
                </Text>
              </>
            ) : (
              <Text style={styles.tierNext}>Top tier 🎉</Text>
            )}
          </View>
        )}

        {/* Verification gate banner — an unverified/pending/rejected driver
            can't go online, so surface a clear CTA to finish verification. */}
        {!isVerified && (
          <TouchableOpacity
            style={styles.verifyBanner}
            onPress={() => router.push('/driver-verify')}
            activeOpacity={0.85}
          >
            <Ionicons
              name={verifyStatus === 'pending' ? 'time-outline' : 'shield-outline'}
              size={20}
              color={verifyStatus === 'pending' ? '#FFD000' : '#EF4444'}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyBannerTitle}>
                {verifyStatus === 'pending'
                  ? 'Verification under review'
                  : verifyStatus === 'rejected'
                  ? 'Verification rejected — resubmit'
                  : 'Get verified to go online'}
              </Text>
              <Text style={styles.verifyBannerSub}>
                {verifyStatus === 'pending'
                  ? "We'll notify you once approved."
                  : 'Upload your Ghana Card and motorcycle photos.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#71717A" />
          </TouchableOpacity>
        )}

        <View style={styles.statusPanel}>
          <View style={styles.statusPanelText}>
            <Text style={styles.statusTitle}>{online ? "You're online" : "You're offline"}</Text>
            <Text style={styles.statusSub}>
              {online
                ? (loading ? 'Checking for requests…' : 'Waiting for ride requests nearby')
                : 'Go online to start receiving rides'}
            </Text>
          </View>
          {online && loading && <ActivityIndicator color="#FFD000" />}
        </View>

        <TouchableOpacity
          style={[styles.onlineBtn, online ? styles.onlineBtnOff : styles.onlineBtnOn]}
          onPress={toggleOnline}
          activeOpacity={0.85}
        >
          <Ionicons name="power" size={18} color={online ? '#FFFFFF' : '#000000'} />
          <Text style={[styles.onlineBtnText, online && styles.onlineBtnTextOff]}>
            {online ? 'Go Offline' : 'Go Online'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* STAGE 1 — full-screen ride request over the blurred dashboard */}
      {incoming && (
        <RideRequestOverlay
          ride={incoming}
          onAccept={() => respond(incoming, true)}
          onDecline={() => respond(incoming, false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  mapDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9,9,11,0.25)' },
  topStrip: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    maxWidth: '100%',
    backgroundColor: 'rgba(9,9,11,0.85)',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tierName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  tierBarTrack: {
    width: 46,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  tierBarFill: { height: '100%', backgroundColor: '#FFD000', borderRadius: 2 },
  tierNext: { color: '#A1A1AA', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  greetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(28,28,31,0.92)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#2A2A2D',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  greetText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  metricsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(28,28,31,0.92)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#2A2A2D',
  },
  metricText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  metricDivider: { width: 1, height: 14, backgroundColor: '#3F3F46', marginHorizontal: 3 },
  bottomWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 12,
  },
  statusPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(28,28,31,0.96)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2A2D',
  },
  statusPanelText: { flex: 1, gap: 3 },
  statusTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  statusSub: { color: '#71717A', fontSize: 13 },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(28,28,31,0.96)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3A2A2D',
  },
  verifyBannerTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  verifyBannerSub: { color: '#71717A', fontSize: 12, marginTop: 2 },
  onlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  onlineBtnOn: { backgroundColor: '#FFD000' },
  onlineBtnOff: { backgroundColor: '#27272A', borderWidth: 1, borderColor: '#3F3F46' },
  onlineBtnText: { fontSize: 16, fontWeight: '800', color: '#000000' },
  onlineBtnTextOff: { color: '#FFFFFF' },
  requestCard: {
    backgroundColor: 'rgba(28,28,31,0.98)',
    borderRadius: 22,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FFD00040',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  requestHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  requestAvatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#252528',
    alignItems: 'center', justifyContent: 'center',
  },
  requestName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  requestType: { color: '#71717A', fontSize: 12, marginTop: 1 },
  requestFare: { color: '#FFD000', fontSize: 18, fontWeight: '800' },
  requestRouteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotYellow: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD000' },
  dotRed: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  requestRouteText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', flex: 1 },
  requestActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  declineBtn: {
    flex: 1, borderWidth: 1, borderColor: '#EF4444', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
  },
  declineText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
  acceptBtn: {
    flex: 1.8, backgroundColor: '#22C55E', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
  },
  acceptText: { color: '#000000', fontSize: 14, fontWeight: '800' },
});
