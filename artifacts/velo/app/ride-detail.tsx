import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import LiveMap from '@/components/LiveMap';
import { getRoute, type LngLat, type RouteResult } from '@/services/geo';

const { width } = Dimensions.get('window');

// Completed-trip detail: a map of the actual route the driver took to carry the
// passenger from pickup to drop-off, plus the fare breakdown and trip facts.
export default function RideDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { rides } = useApp();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const ride = useMemo(() => rides.find((r) => r.id === rideId), [rides, rideId]);

  const pickup: LngLat | null = ride?.fromCoord ? [ride.fromCoord.lng, ride.fromCoord.lat] : null;
  const drop: LngLat | null = ride?.toCoord ? [ride.toCoord.lng, ride.toCoord.lat] : null;

  const [route, setRoute] = useState<RouteResult | null>(null);
  useEffect(() => {
    if (!pickup || !drop) return;
    let alive = true;
    getRoute(pickup, drop).then((r) => { if (alive) setRoute(r); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.join(), drop?.join()]);

  if (!ride) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <Text style={styles.muted}>Trip not found.</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const total = ride.price;
  const serviceFee = Math.round(total * 0.12 * 100) / 100;
  const baseFare = Math.round((total - serviceFee) * 100) / 100;
  const distanceKm = route?.distanceKm;
  const dateStr = new Date(ride.date).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' });
  const mapH = Dimensions.get('window').height * 0.46;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Route map */}
      <View style={{ height: mapH + insets.top }}>
        <LiveMap
          width={width}
          height={mapH + insets.top}
          mode="route"
          pickup={pickup ?? undefined}
          dest={drop ?? undefined}
          routeLine={route?.coords ?? null}
        />
        <View style={styles.mapDim} pointerEvents="none" />
      </View>

      <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <ScrollView style={styles.sheet} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 28 }}>
        <View style={styles.handle} />
        <View style={styles.headRow}>
          <View>
            <Text style={styles.title}>{ride.type} Bike</Text>
            <Text style={styles.date}>{dateStr}</Text>
          </View>
          <Text style={styles.total}>₵{total.toFixed(2)}</Text>
        </View>

        {/* Route */}
        <View style={styles.card}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: '#FFD000' }]} />
            <Text style={styles.routeText} numberOfLines={2}>{ride.from}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.routeText} numberOfLines={2}>{ride.to}</Text>
          </View>
        </View>

        {/* Trip facts */}
        <View style={styles.card}>
          <Row label="Driver" value={`${ride.driverName ?? 'VELO driver'}`} />
          <Row label="Driver rating" value={`★ ${ride.driverRating ?? 5}`} />
          <Row label="Duration" value={`${ride.durationMin} min`} />
          <Row label="Distance" value={distanceKm != null ? `${distanceKm.toFixed(1)} km` : '—'} />
          {ride.rating ? (
            <View style={styles.stars}>
              <Text style={styles.rowLabel}>Your rating</Text>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons key={s} name={s <= (ride.rating ?? 0) ? 'star' : 'star-outline'} size={15} color="#FFD000" />
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* Fare */}
        <View style={styles.card}>
          <Row label="Base fare" value={`₵${baseFare.toFixed(2)}`} />
          <Row label="Service fee (12%)" value={`₵${serviceFee.toFixed(2)}`} />
          <View style={styles.divider} />
          <Row label="Total" value={`₵${total.toFixed(2)}`} bold />
          <Row label="Paid with" value={ride.paymentMethod ?? 'Cash'} />
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { color: '#A1A1AA', fontSize: 15 },
  backLink: { paddingHorizontal: 16, paddingVertical: 10 },
  backLinkText: { color: '#FFD000', fontWeight: '700' },
  mapDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9,9,11,0.12)' },
  backBtn: {
    position: 'absolute', left: 14, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(19,19,22,0.9)', borderWidth: 1, borderColor: '#27272A',
    alignItems: 'center', justifyContent: 'center',
  },
  sheet: {
    flex: 1, marginTop: -24, backgroundColor: '#09090B',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#3F3F46', marginBottom: 14 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  date: { fontSize: 13, color: '#71717A', marginTop: 2 },
  total: { fontSize: 24, fontWeight: '900', color: '#FFD000' },
  card: {
    backgroundColor: '#131316', borderRadius: 18, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#1F1F23', gap: 10,
  },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  routeLine: { width: 1, height: 16, backgroundColor: '#3F3F46', marginLeft: 4 },
  routeText: { flex: 1, fontSize: 15, color: '#E4E4E7' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: '#A1A1AA' },
  rowValue: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  bold: { fontWeight: '800', color: '#FFFFFF', fontSize: 16 },
  divider: { height: 1, backgroundColor: '#27272A' },
});
