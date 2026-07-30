import React, { useCallback } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import EarningsChart from '@/components/EarningsChart';
import { useApp } from '@/context/AppContext';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function DriverEarningsScreen() {
  const insets = useSafeAreaInsets();
  const { driverStatus, refreshDriverStatus } = useApp();
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);
  const tabBarH = isWeb ? 84 : Math.max(insets.bottom, 8) + 66;

  useFocusEffect(useCallback(() => { refreshDriverStatus(); }, [refreshDriverStatus]));

  const weekly = driverStatus?.weeklyEarnings ?? [0, 0, 0, 0, 0, 0, 0];
  const weekTotal = weekly.reduce((s, v) => s + v, 0);
  const todayIdx = new Date().getDay();

  const handleWithdraw = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Withdrawal Requested', 'Your earnings will arrive via MTN MoMo within 24 hours.');
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
        <View style={styles.totalsRow}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Today</Text>
            <Text style={styles.totalValue}>₵{(driverStatus?.todayEarnings ?? 0).toFixed(2)}</Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>This Week</Text>
            <Text style={styles.totalValue}>₵{weekTotal.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Weekly Breakdown</Text>
          <View style={{ marginTop: 14 }}>
            <EarningsChart values={weekly} highlightIndex={todayIdx} />
          </View>
        </View>

        <View style={[styles.card, { padding: 0 }]}>
          {DAY_NAMES.map((day, i) => (
            <View key={day} style={[styles.dayRow, i < DAY_NAMES.length - 1 && styles.dayRowBorder]}>
              <Text style={[styles.dayName, i === todayIdx && styles.dayNameActive]}>
                {day}{i === todayIdx ? ' · Today' : ''}
              </Text>
              <Text style={styles.dayValue}>₵{(weekly[i] ?? 0).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.performanceCard}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.perfRow}>
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

        <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw} activeOpacity={0.85}>
          <Ionicons name="arrow-down-circle-outline" size={18} color="#000000" />
          <Text style={styles.withdrawText}>Withdraw Earnings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  content: { paddingHorizontal: 16, gap: 14 },
  totalsRow: { flexDirection: 'row', gap: 12 },
  totalCard: {
    flex: 1, backgroundColor: '#1C1C1F', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#27272A',
  },
  totalLabel: { fontSize: 11, color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.4 },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
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
  performanceCard: {
    backgroundColor: '#1C1C1F', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#27272A',
  },
  perfRow: { flexDirection: 'row', gap: 16, marginTop: 14 },
  perfStat: { flex: 1, alignItems: 'center' },
  perfValue: { fontSize: 22, fontWeight: '800' },
  perfLabel: { fontSize: 12, color: '#71717A', marginTop: 4 },
  withdrawBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFD000', borderRadius: 14, height: 54,
  },
  withdrawText: { fontSize: 15, fontWeight: '700', color: '#000000' },
});
