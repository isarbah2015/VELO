import React, { useCallback, useEffect, useState } from 'react';
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
import LiveMap from '@/components/LiveMap';
import { useApp, type Ride } from '@/context/AppContext';
import { watchDriverRequests } from '@/services/rides';
import { acceptRide, declineRide, recordCompletedRide } from '@/services/driver';

const { width, height } = Dimensions.get('window');

// Driver home = a clean live map to receive rides (Bolt/Uber-Driver style).
// The map is the whole screen; a slim status strip floats at the top and a
// single action panel floats at the bottom. Detailed stats and the weekly
// chart live on the Earnings tab, so nothing is lost by keeping this clean.
export default function DriverHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, driverStatus, setOnline, refreshDriverStatus } = useApp();
  const [requests, setRequests] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);
  const tabBarH = isWeb ? 84 : Math.max(insets.bottom, 8) + 66;

  const online = driverStatus?.online ?? false;

  // Keep driver stats fresh whenever this screen mounts.
  useEffect(() => { refreshDriverStatus(); }, [refreshDriverStatus]);

  // Subscribe to the open-request pool in realtime, but only while online —
  // a rider's booking then appears instantly with no manual refresh.
  useEffect(() => {
    if (!online) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = watchDriverRequests((reqs) => {
      setRequests(reqs);
      setLoading(false);
    });
    return unsub;
  }, [online]);

  const toggleOnline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOnline(!online);
  };

  const respond = async (ride: Ride, accepted: boolean) => {
    if (!user) return;
    Haptics.notificationAsync(accepted ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    setRequests((prev) => prev.filter((r) => r.id !== ride.id));
    if (accepted) {
      await acceptRide(ride.id, user.uid, user.name);
      await recordCompletedRide(user.uid, ride.price);
      await refreshDriverStatus();
    } else {
      await declineRide(ride.id);
    }
  };

  const incoming = online ? requests[0] : undefined;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Full-screen map */}
      <View style={StyleSheet.absoluteFill}>
        <LiveMap width={width} height={height} mode="nearby" />
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
        {incoming ? (
          <View style={styles.requestCard}>
            <View style={styles.requestHeader}>
              <View style={styles.requestAvatar}>
                <Ionicons name="person" size={20} color="#FFD000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestName} numberOfLines={1}>{incoming.riderName}</Text>
                <Text style={styles.requestType}>{incoming.type} Bike</Text>
              </View>
              <Text style={styles.requestFare}>₵{incoming.price.toFixed(2)}</Text>
            </View>
            <View style={styles.requestRouteRow}>
              <View style={styles.dotYellow} />
              <Text style={styles.requestRouteText} numberOfLines={1}>{incoming.from}</Text>
            </View>
            <View style={styles.requestRouteRow}>
              <View style={styles.dotRed} />
              <Text style={styles.requestRouteText} numberOfLines={1}>{incoming.to}</Text>
            </View>
            <View style={styles.requestActions}>
              <TouchableOpacity style={styles.declineBtn} onPress={() => respond(incoming, false)}>
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => respond(incoming, true)}>
                <Text style={styles.acceptText}>Accept · ₵{incoming.price.toFixed(2)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
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
        )}

        {!incoming && (
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
        )}
      </View>
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
