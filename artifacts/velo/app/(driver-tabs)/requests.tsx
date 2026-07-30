import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useApp, type Ride } from '@/context/AppContext';
import { getDriverRequests } from '@/services/rides';
import { acceptRide, declineRide, recordCompletedRide } from '@/services/driver';

function RequestCard({ ride, onAccept, onDecline }: { ride: Ride; onAccept: () => void; onDecline: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={20} color="#FFD000" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.riderName} numberOfLines={1}>{ride.riderName}</Text>
          <Text style={styles.rideType}>{ride.type} Bike</Text>
        </View>
        <Text style={styles.fare}>₵{ride.price.toFixed(2)}</Text>
      </View>

      <View style={styles.routeBox}>
        <View style={styles.routeRow}>
          <View style={styles.dotYellow} />
          <Text style={styles.routeText} numberOfLines={1}>{ride.from}</Text>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routeRow}>
          <View style={styles.dotRed} />
          <Text style={styles.routeText} numberOfLines={1}>{ride.to}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
          <Text style={styles.declineText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function DriverRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshDriverStatus } = useApp();
  const [requests, setRequests] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);
  const tabBarH = isWeb ? 120 : Math.max(insets.bottom, 8) + 96;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await getDriverRequests());
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ride Requests</Text>
        <Text style={styles.headerSub}>{requests.length} pending</Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarH + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#FFD000" />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="file-tray-outline" size={40} color="#27272A" />
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySub}>New ride requests will appear here</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <RequestCard ride={item} onAccept={() => respond(item, true)} onDecline={() => respond(item, false)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: { paddingHorizontal: 20, paddingVertical: 16, gap: 2 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 13, color: '#71717A' },
  list: { paddingHorizontal: 16, gap: 12 },
  card: {
    backgroundColor: '#1C1C1F', borderRadius: 16, padding: 16, gap: 14,
    borderWidth: 1, borderColor: '#27272A',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#252528',
    alignItems: 'center', justifyContent: 'center',
  },
  riderName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  rideType: { fontSize: 12, color: '#71717A' },
  fare: { fontSize: 17, fontWeight: '800', color: '#FFD000' },
  routeBox: { backgroundColor: '#131316', borderRadius: 12, padding: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 },
  routeConnector: { width: 1.5, height: 10, backgroundColor: '#3F3F46', marginLeft: 4 },
  dotYellow: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD000' },
  dotRed: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  routeText: { fontSize: 13, color: '#FFFFFF', flex: 1, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 10 },
  declineBtn: {
    flex: 1, borderWidth: 1, borderColor: '#EF4444', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
  },
  declineText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
  acceptBtn: {
    flex: 1.4, backgroundColor: '#22C55E', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
  },
  acceptText: { color: '#000000', fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 10, paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  emptySub: { fontSize: 14, color: '#71717A', textAlign: 'center' },
});
