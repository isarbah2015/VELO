import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import EarningsChart from '@/components/EarningsChart';
import { useApp, type Ride } from '@/context/AppContext';
import { getRideHistory } from '@/services/rides';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MS_DAY = 86400000;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
const shortTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' });

export default function DriverEarningsScreen() {
  const insets = useSafeAreaInsets();
  const { user, driverStatus, refreshDriverStatus } = useApp();
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);
  const tabBarH = isWeb ? 84 : Math.max(insets.bottom, 8) + 66;

  const [trips, setTrips] = useState<Ride[]>([]);
  useFocusEffect(useCallback(() => {
    refreshDriverStatus();
    if (user) getRideHistory(user.uid, 'driver').then(setTrips).catch(() => {});
  }, [user, refreshDriverStatus]));

  // Everything is derived from the driver's own completed rides, so the totals,
  // the weekly chart and the per-trip list always agree.
  const { today, weekArr, weekTotal, month, lifetime, completed } = useMemo(() => {
    const done = trips.filter((t) => t.status === 'completed');
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sow = sod - now.getDay() * MS_DAY; // start of week (Sunday)
    const som = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const week = [0, 0, 0, 0, 0, 0, 0];
    let t = 0, m = 0, life = 0;
    for (const r of done) {
      const d = new Date(r.date); const ts = d.getTime(); const p = r.price || 0;
      life += p;
      if (ts >= som) m += p;
      if (ts >= sod) t += p;
      if (ts >= sow) week[d.getDay()] += p;
    }
    return { today: t, weekArr: week, weekTotal: week.reduce((a, b) => a + b, 0), month: m, lifetime: life, completed: done };
  }, [trips]);

  const todayIdx = new Date().getDay();

  const handleWithdraw = () => {
    if (weekTotal <= 0) { Alert.alert('Nothing to withdraw', 'You have no earnings to pay out yet.'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Withdrawal requested', `₵${weekTotal.toFixed(2)} will arrive via MTN MoMo within 24 hours.`);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#09090B' }}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: tabBarH + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Earnings</Text>
      </View>

      <View style={styles.content}>
        {/* Today / Week / Month */}
        <View style={styles.totalsRow}>
          {([['Today', today], ['This week', weekTotal], ['This month', month]] as const).map(([label, val], i) => (
            <View key={label} style={styles.totalCard}>
              <Text style={styles.totalLabel}>{label}</Text>
              <Text style={[styles.totalValue, i === 0 && { color: '#FFD000' }]}>₵{val.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Payout */}
        <View style={styles.payoutCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.payoutLabel}>Available to withdraw</Text>
            <Text style={styles.payoutValue}>₵{weekTotal.toFixed(2)}</Text>
            <View style={styles.payoutMethodRow}>
              <Ionicons name="phone-portrait-outline" size={13} color="#71717A" />
              <Text style={styles.payoutMethod}>MTN MoMo · {user?.phone ? `+233 ${user.phone}` : 'set up'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw} activeOpacity={0.85}>
            <Ionicons name="arrow-down-circle" size={18} color="#000" />
            <Text style={styles.withdrawText}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>This week</Text>
          <View style={{ marginTop: 14 }}>
            <EarningsChart values={weekArr} highlightIndex={todayIdx} />
          </View>
        </View>

        <View style={[styles.card, { padding: 0 }]}>
          {DAY_NAMES.map((day, i) => (
            <View key={day} style={[styles.dayRow, i < DAY_NAMES.length - 1 && styles.dayRowBorder]}>
              <Text style={[styles.dayName, i === todayIdx && styles.dayNameActive]}>
                {day}{i === todayIdx ? ' · Today' : ''}
              </Text>
              <Text style={styles.dayValue}>₵{(weekArr[i] ?? 0).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Per-trip earnings history */}
        <View style={styles.tripsHeaderRow}>
          <Text style={styles.sectionTitle}>Trip earnings</Text>
          <Text style={styles.tripsCount}>{completed.length} trips · ₵{lifetime.toFixed(0)} lifetime</Text>
        </View>
        {completed.length === 0 ? (
          <View style={styles.emptyTrips}>
            <Ionicons name="receipt-outline" size={26} color="#3F3F46" />
            <Text style={styles.emptyTripsText}>Completed trips and their earnings show here.</Text>
          </View>
        ) : (
          <View style={[styles.card, { padding: 0 }]}>
            {completed.slice(0, 12).map((r, i) => (
              <View key={r.id} style={[styles.tripRow, i < Math.min(completed.length, 12) - 1 && styles.dayRowBorder]}>
                <View style={styles.tripIcon}>
                  <Ionicons name="bicycle" size={16} color="#FFD000" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripRoute} numberOfLines={1}>{r.from} → {r.to}</Text>
                  <Text style={styles.tripMeta}>{shortDate(r.date)} · {shortTime(r.date)} · {r.type}</Text>
                </View>
                <Text style={styles.tripFare}>₵{(r.price || 0).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.performanceCard}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.perfRow}>
            <View style={styles.perfStat}>
              <Text style={[styles.perfValue, { color: '#FFD000' }]}>{(driverStatus?.rating ?? 5).toFixed(1)}</Text>
              <Text style={styles.perfLabel}>Rating</Text>
            </View>
            <View style={styles.perfStat}>
              <Text style={[styles.perfValue, { color: '#22C55E' }]}>{driverStatus?.acceptanceRate ?? 100}%</Text>
              <Text style={styles.perfLabel}>Acceptance</Text>
            </View>
            <View style={styles.perfStat}>
              <Text style={[styles.perfValue, { color: '#EF4444' }]}>{driverStatus?.cancellationRate ?? 0}%</Text>
              <Text style={styles.perfLabel}>Cancellation</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  content: { paddingHorizontal: 16, gap: 14 },
  totalsRow: { flexDirection: 'row', gap: 10 },
  totalCard: {
    flex: 1, backgroundColor: '#1C1C1F', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#27272A',
  },
  totalLabel: { fontSize: 10, color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.4 },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },

  payoutCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1C1C1F', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#FFD00030',
  },
  payoutLabel: { fontSize: 12, color: '#71717A' },
  payoutValue: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
  payoutMethodRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  payoutMethod: { fontSize: 12, color: '#A1A1AA' },

  card: {
    backgroundColor: '#1C1C1F', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#27272A',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  dayRowBorder: { borderBottomWidth: 1, borderBottomColor: '#27272A' },
  dayName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  dayNameActive: { color: '#FFD000' },
  dayValue: { fontSize: 14, fontWeight: '700', color: '#A1A1AA' },

  tripsHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 2 },
  tripsCount: { fontSize: 12, color: '#71717A' },
  emptyTrips: {
    backgroundColor: '#131316', borderRadius: 16, borderWidth: 1, borderColor: '#27272A',
    alignItems: 'center', gap: 8, padding: 24,
  },
  emptyTripsText: { fontSize: 13, color: '#71717A', textAlign: 'center' },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  tripIcon: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: '#252528',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3F3F46',
  },
  tripRoute: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  tripMeta: { fontSize: 12, color: '#71717A', marginTop: 2 },
  tripFare: { fontSize: 15, fontWeight: '800', color: '#FFD000' },

  performanceCard: {
    backgroundColor: '#1C1C1F', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#27272A',
  },
  perfRow: { flexDirection: 'row', gap: 16, marginTop: 14 },
  perfStat: { flex: 1, alignItems: 'center' },
  perfValue: { fontSize: 22, fontWeight: '800' },
  perfLabel: { fontSize: 12, color: '#71717A', marginTop: 4 },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFD000', borderRadius: 12, paddingHorizontal: 16, height: 46,
  },
  withdrawText: { fontSize: 14, fontWeight: '800', color: '#000000' },
});
