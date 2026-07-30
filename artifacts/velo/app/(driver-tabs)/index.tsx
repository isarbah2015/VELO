import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import EarningsChart from '@/components/EarningsChart';
import { useApp, type Ride } from '@/context/AppContext';
import { getDriverRequests } from '@/services/rides';
import { acceptRide, declineRide, recordCompletedRide } from '@/services/driver';

export default function DriverDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, driverStatus, setOnline, refreshDriverStatus } = useApp();
  const [requests, setRequests] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);
  const tabBarH = isWeb ? 120 : Math.max(insets.bottom, 8) + 96;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs] = await Promise.all([getDriverRequests(), refreshDriverStatus()]);
      setRequests(reqs);
    } finally {
      setLoading(false);
    }
  }, [refreshDriverStatus]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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

  const weekly = driverStatus?.weeklyEarnings ?? [0, 0, 0, 0, 0, 0, 0];
  const todayIdx = new Date().getDay();

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Driver Dashboard</Text>
          <Text style={styles.headerSub}>Welcome back, {user?.name?.split(' ')[0] ?? 'Driver'}</Text>
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: tabBarH + 16 }}>
        {/* Online toggle */}
        <View style={styles.statusCard}>
          <View>
            <Text style={styles.statusLabel}>{driverStatus?.online ? "You're online" : "You're offline"}</Text>
            <Text style={styles.statusSub}>{driverStatus?.online ? 'Ready to accept rides' : 'Go online to start earning'}</Text>
          </View>
          <Switch
            value={driverStatus?.online ?? false}
            onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setOnline(v); }}
            trackColor={{ false: '#3F3F46', true: '#22C55E' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>₵{(driverStatus?.todayEarnings ?? 0).toFixed(2)}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{driverStatus?.ridesToday ?? 0}</Text>
            <Text style={styles.statLabel}>Rides</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="star" size={14} color="#FFD000" />
              <Text style={styles.statValue}>{(driverStatus?.rating ?? 5).toFixed(1)}</Text>
            </View>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {/* Requests */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ride Requests</Text>
          {requests.length > 0 && (
            <View style={styles.countBadge}><Text style={styles.countText}>{requests.length}</Text></View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color="#FFD000" style={{ marginTop: 20 }} />
        ) : requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="file-tray-outline" size={28} color="#3F3F46" />
            <Text style={styles.emptyText}>No pending requests</Text>
          </View>
        ) : (
          requests.slice(0, 2).map((r) => (
            <View key={r.id} style={styles.requestCard}>
              <View style={styles.requestTop}>
                <Text style={styles.requestName} numberOfLines={1}>{r.riderName}</Text>
                <Text style={styles.requestFare}>₵{r.price.toFixed(2)}</Text>
              </View>
              <Text style={styles.requestRoute} numberOfLines={1}>{r.from} → {r.to}</Text>
              <View style={styles.requestActions}>
                <TouchableOpacity style={styles.declineBtn} onPress={() => respond(r, false)}>
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => respond(r, true)}>
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        {requests.length > 2 && (
          <TouchableOpacity style={styles.viewAllBtn} onPress={() => router.push('/(driver-tabs)/requests')}>
            <Text style={styles.viewAllText}>View all {requests.length} requests</Text>
          </TouchableOpacity>
        )}

        {/* Weekly chart */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Weekly Earnings</Text>
          <View style={{ marginTop: 12 }}>
            <EarningsChart values={weekly} highlightIndex={todayIdx} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: { paddingHorizontal: 20, paddingVertical: 16, gap: 2 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 13, color: '#71717A' },
  statusCard: {
    backgroundColor: '#1C1C1F', borderRadius: 16, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#27272A',
  },
  statusLabel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  statusSub: { fontSize: 12, color: '#71717A', marginTop: 2 },
  statsRow: {
    flexDirection: 'row', backgroundColor: '#1C1C1F', borderRadius: 16, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: '#27272A',
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.4 },
  statDivider: { width: 1, backgroundColor: '#27272A' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  countBadge: { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  countText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  emptyCard: {
    backgroundColor: '#1C1C1F', borderRadius: 16, padding: 24, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#27272A', marginBottom: 12,
  },
  emptyText: { fontSize: 13, color: '#71717A' },
  requestCard: {
    backgroundColor: '#1C1C1F', borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#27272A', gap: 8,
  },
  requestTop: { flexDirection: 'row', justifyContent: 'space-between' },
  requestName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', flexShrink: 1 },
  requestFare: { fontSize: 15, fontWeight: '800', color: '#FFD000' },
  requestRoute: { fontSize: 12, color: '#71717A' },
  requestActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  declineBtn: {
    flex: 1, borderWidth: 1, borderColor: '#EF4444', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 10,
  },
  declineText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },
  acceptBtn: {
    flex: 1.4, backgroundColor: '#22C55E', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 10,
  },
  acceptText: { color: '#000000', fontSize: 13, fontWeight: '700' },
  viewAllBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 8 },
  viewAllText: { color: '#FFD000', fontSize: 13, fontWeight: '600' },
  chartCard: {
    backgroundColor: '#1C1C1F', borderRadius: 16, padding: 16, marginTop: 8,
    borderWidth: 1, borderColor: '#27272A',
  },
});
