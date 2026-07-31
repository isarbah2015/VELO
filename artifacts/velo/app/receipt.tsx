import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

// Trip receipt shown after a completed ride (and re-openable from history).
// Fare is broken down into a base fare + service fee that sum to the total,
// so the numbers are transparent rather than a single opaque figure.
export default function ReceiptScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const p = useLocalSearchParams<{
    from?: string; to?: string; price?: string; durationMin?: string;
    paymentMethod?: string; driverName?: string; rideType?: string; rating?: string; date?: string;
  }>();

  const total = parseFloat(p.price ?? '0');
  const serviceFee = Math.round(total * 0.12 * 100) / 100;
  const baseFare = Math.round((total - serviceFee) * 100) / 100;
  const rating = parseInt(p.rating ?? '0', 10);
  const dateStr = p.date
    ? new Date(p.date).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receipt</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100 }}>
        <View style={styles.hero}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={30} color="#000" />
          </View>
          <Text style={styles.heroTotal}>₵{total.toFixed(2)}</Text>
          <Text style={styles.heroLabel}>Trip completed · {dateStr}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: '#FFD000' }]} />
            <Text style={styles.routeText} numberOfLines={1}>{p.from ?? 'Pickup'}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.routeText} numberOfLines={1}>{p.to ?? 'Destination'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Row label="Base fare" value={`₵${baseFare.toFixed(2)}`} />
          <Row label="Service fee (12%)" value={`₵${serviceFee.toFixed(2)}`} />
          <View style={styles.divider} />
          <Row label="Total" value={`₵${total.toFixed(2)}`} bold />
          <Row label="Paid with" value={p.paymentMethod ?? 'MTN MoMo'} />
        </View>

        <View style={styles.card}>
          <Row label="Driver" value={p.driverName ?? 'VELO driver'} />
          <Row label="Bike" value={`${p.rideType ?? 'Standard'}`} />
          <Row label="Duration" value={`${p.durationMin ?? '0'} min`} />
          {rating > 0 && (
            <View style={styles.ratingRow}>
              <Text style={styles.rowLabel}>Your rating</Text>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons key={s} name={s <= rating ? 'star' : 'star-outline'} size={16} color="#FFD000" />
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.rowBold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  hero: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  checkCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFD000',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  heroTotal: { fontSize: 40, fontWeight: '900', color: '#FFFFFF' },
  heroLabel: { fontSize: 13, color: '#71717A' },
  card: {
    backgroundColor: '#131316', borderRadius: 18, padding: 18, marginTop: 14,
    borderWidth: 1, borderColor: '#1F1F23', gap: 12,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 1, height: 16, backgroundColor: '#3F3F46', marginLeft: 4 },
  routeText: { flex: 1, fontSize: 15, color: '#E4E4E7' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: 14, color: '#A1A1AA' },
  rowValue: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  rowBold: { fontWeight: '800', color: '#FFFFFF', fontSize: 16 },
  divider: { height: 1, backgroundColor: '#27272A' },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: '#09090B', borderTopWidth: 1, borderTopColor: '#18181B',
  },
  doneBtn: { backgroundColor: '#FFD000', borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontSize: 17, fontWeight: '800', color: '#000' },
});
