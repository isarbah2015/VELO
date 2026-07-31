import React, { useCallback, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useApp, type Ride } from '@/context/AppContext';
import { getRideHistory } from '@/services/rides';

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
}

const STATUS_META: Record<Ride['status'], { label: string; color: string }> = {
  requested: { label: 'Pending', color: '#FFD000' },
  accepted: { label: 'In progress', color: '#FFD000' },
  arrived: { label: 'In progress', color: '#FFD000' },
  in_progress: { label: 'In progress', color: '#FFD000' },
  completed: { label: 'Completed', color: '#22C55E' },
  cancelled: { label: 'Cancelled', color: '#EF4444' },
};

function HistoryCard({ ride }: { ride: Ride }) {
  const meta = STATUS_META[ride.status];
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.riderName} numberOfLines={1}>{ride.riderName}</Text>
          <Text style={styles.rideDate}>{formatDate(ride.date)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: meta.color + '20' }]}>
          <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
      <View style={styles.routeRow}>
        <View style={styles.dotYellow} />
        <Text style={styles.routeText} numberOfLines={1}>{ride.from}</Text>
      </View>
      <View style={styles.routeConnector} />
      <View style={styles.routeRow}>
        <View style={styles.dotRed} />
        <Text style={styles.routeText} numberOfLines={1}>{ride.to}</Text>
      </View>
      <Text style={styles.fare}>₵{ride.price.toFixed(2)}</Text>
    </View>
  );
}

export default function DriverHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();
  const [rides, setRides] = useState<Ride[]>([]);
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);

  const load = useCallback(async () => {
    if (!user) return;
    setRides(await getRideHistory(user.uid, 'driver'));
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const earned = rides.filter((r) => r.status === 'accepted' || r.status === 'completed').reduce((s, r) => s + r.price, 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride History</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryValue}>{rides.length}</Text>
          <Text style={styles.summaryLabel}>Total Rides</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryValue}>₵{earned.toFixed(2)}</Text>
          <Text style={styles.summaryLabel}>Total Earned</Text>
        </View>
      </View>

      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={40} color="#27272A" />
            <Text style={styles.emptyText}>No completed rides yet</Text>
          </View>
        }
        renderItem={({ item }) => <HistoryCard ride={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  summary: {
    flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#1C1C1F', borderRadius: 16,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#27272A',
  },
  summaryCol: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#27272A' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  summaryLabel: { fontSize: 11, color: '#71717A', marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: '#1C1C1F', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#27272A', gap: 0,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  riderName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  rideDate: { fontSize: 12, color: '#71717A', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 },
  routeConnector: { width: 1.5, height: 10, backgroundColor: '#3F3F46', marginLeft: 4 },
  dotYellow: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD000' },
  dotRed: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  routeText: { fontSize: 13, color: '#FFFFFF', fontWeight: '500' },
  fare: { fontSize: 16, fontWeight: '800', color: '#FFD000', marginTop: 10, textAlign: 'right' },
  empty: { alignItems: 'center', gap: 10, paddingTop: 80 },
  emptyText: { fontSize: 14, color: '#71717A' },
});
