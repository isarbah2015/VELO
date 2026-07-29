import React, { useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useApp, type Ride } from '@/context/AppContext';

const FILTERS = ['All', 'Completed', 'Cancelled'] as const;
type Filter = typeof FILTERS[number];

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
}

function RideCard({ ride }: { ride: Ride }) {
  const isCompleted = ride.status === 'completed';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrap}>
          <Ionicons name="bicycle" size={22} color="#FFD000" />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.rideType}>{ride.type} Bike</Text>
          <Text style={styles.rideDate}>{formatDate(ride.date)}</Text>
        </View>
        <View style={[styles.statusBadge, !isCompleted && styles.statusBadgeCancelled]}>
          <Text style={[styles.statusText, !isCompleted && styles.statusTextCancelled]}>
            {isCompleted ? 'Completed' : 'Cancelled'}
          </Text>
        </View>
      </View>

      <View style={styles.cardRoute}>
        <View style={styles.routePoint}>
          <View style={styles.dotYellow} />
          <Text style={styles.routePointText} numberOfLines={1}>{ride.from}</Text>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routePoint}>
          <View style={styles.dotRed} />
          <Text style={styles.routePointText} numberOfLines={1}>{ride.to}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerStat}>
          <Ionicons name="time-outline" size={14} color="#52525B" />
          <Text style={styles.footerStatText}>{ride.durationMin} min</Text>
        </View>
        <View style={styles.footerStat}>
          <Ionicons name="star" size={14} color="#FFD000" />
          <Text style={styles.footerStatText}>{ride.driverRating} · {ride.driverName}</Text>
        </View>
        <Text style={styles.ridePrice}>₵{ride.price.toFixed(2)}</Text>
      </View>
    </View>
  );
}

export default function RidesScreen() {
  const insets = useSafeAreaInsets();
  const { rides } = useApp();
  const [filter, setFilter] = useState<Filter>('All');
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);
  const tabBarH = isWeb ? 100 : Math.max(insets.bottom, 8) + 80;

  const filtered = rides.filter((r) => {
    if (filter === 'All') return true;
    return r.status === filter.toLowerCase();
  });

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Rides</Text>
        <Text style={styles.headerSub}>{rides.length} total trips</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RideCard ride={item} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarH + 16 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#27272A" />
            <Text style={styles.emptyTitle}>No rides yet</Text>
            <Text style={styles.emptySub}>Your completed rides will appear here</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 13,
    color: '#71717A',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1C1C1F',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  filterBtnActive: {
    backgroundColor: '#FFD000',
    borderColor: '#FFD000',
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717A',
  },
  filterBtnTextActive: {
    color: '#000000',
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#1C1C1F',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#252528',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  rideType: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rideDate: {
    fontSize: 12,
    color: '#71717A',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  statusBadgeCancelled: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22C55E',
  },
  statusTextCancelled: {
    color: '#EF4444',
  },
  cardRoute: {
    gap: 0,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  routeConnector: {
    width: 1.5,
    height: 12,
    backgroundColor: '#3F3F46',
    marginLeft: 5,
  },
  dotYellow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD000',
  },
  dotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  routePointText: {
    fontSize: 13,
    color: '#FFFFFF',
    flex: 1,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    paddingTop: 12,
  },
  footerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerStatText: {
    fontSize: 12,
    color: '#71717A',
  },
  ridePrice: {
    marginLeft: 'auto',
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD000',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySub: {
    fontSize: 14,
    color: '#71717A',
    textAlign: 'center',
  },
});
