import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { getNotifPrefs, setNotifPrefs, type NotifPrefs } from '@/services/settings';

const ROWS: { key: keyof NotifPrefs; label: string; sub: string; icon: string }[] = [
  { key: 'rideUpdates', label: 'Ride updates', sub: 'Driver assigned, arriving, trip status', icon: 'car-outline' },
  { key: 'driverAlerts', label: 'New ride requests', sub: 'Alerts when you\'re online as a driver', icon: 'notifications-outline' },
  { key: 'promotions', label: 'Promotions & offers', sub: 'Discounts, promo codes, referral rewards', icon: 'gift-outline' },
  { key: 'safety', label: 'Safety alerts', sub: 'Important safety and account notices', icon: 'shield-checkmark-outline' },
];

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);

  useEffect(() => { getNotifPrefs().then(setPrefs); }, []);

  const toggle = (key: keyof NotifPrefs) => {
    if (!prefs) return;
    Haptics.selectionAsync();
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setNotifPrefs(next).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {ROWS.map((row, i) => (
            <View key={row.key}>
              <View style={styles.row}>
                <View style={styles.iconWrap}>
                  <Ionicons name={row.icon as any} size={20} color="#A1A1AA" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{row.label}</Text>
                  <Text style={styles.sub}>{row.sub}</Text>
                </View>
                <Switch
                  value={prefs?.[row.key] ?? true}
                  onValueChange={() => toggle(row.key)}
                  trackColor={{ false: '#3F3F46', true: '#FFD000' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#3F3F46"
                />
              </View>
              {i < ROWS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
        <Text style={styles.footnote}>
          You can also manage system-level permissions in your phone&apos;s Settings app.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#09090B',
    borderBottomWidth: 1, borderBottomColor: '#1C1C1F',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#1C1C1F',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2A2D',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  card: {
    backgroundColor: '#131316', borderRadius: 16, borderWidth: 1, borderColor: '#27272A',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#252528',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3F3F46',
  },
  label: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  sub: { fontSize: 12, color: '#71717A', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#27272A', marginLeft: 64 },
  footnote: { fontSize: 12, color: '#52525B', lineHeight: 18, paddingHorizontal: 4 },
});
