import React, { useMemo } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { makeReferralCode, tierForRides } from '@/services/referrals';

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, rides } = useApp();

  const code = user?.referralCode ?? (user ? makeReferralCode(user.name, user.uid) : 'VELO');
  const completed = useMemo(() => rides.filter((r) => r.status === 'completed').length, [rides]);
  const tier = tierForRides(completed);

  const share = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `Ride with VELO 🏍️ — Ghana's fastest okada. Use my code ${code} and we both get ₵5 off your first ride. Download: https://velo.app`,
    });
  };

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={{ padding: 20, gap: 18 }}>
        {/* Tier badge */}
        <View style={[styles.tierCard, { borderColor: tier.color }]}>
          <View style={styles.tierTop}>
            <Ionicons name="ribbon" size={20} color={tier.color} />
            <Text style={[styles.tierName, { color: tier.color }]}>{tier.label}</Text>
          </View>
          <Text style={styles.tierPerk}>{tier.perk}</Text>
          {tier.next && tier.ridesToNext != null && (
            <Text style={styles.tierNext}>
              {tier.ridesToNext} more ride{tier.ridesToNext === 1 ? '' : 's'} to {tier.next}
            </Text>
          )}
        </View>

        {/* Referral code */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your referral code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.code}>{code}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={copy}>
              <Ionicons name="copy-outline" size={18} color="#FFD000" />
              <Text style={styles.copyText}>Copy</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.codeHint}>You and your friend each get ₵5 when they take their first ride.</Text>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={share} activeOpacity={0.85}>
          <Ionicons name="share-social" size={20} color="#000" />
          <Text style={styles.shareText}>Share your code</Text>
        </TouchableOpacity>
      </View>
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
  tierCard: { backgroundColor: '#131316', borderRadius: 18, padding: 18, borderWidth: 1.5, gap: 6 },
  tierTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierName: { fontSize: 17, fontWeight: '800' },
  tierPerk: { fontSize: 14, color: '#E4E4E7' },
  tierNext: { fontSize: 13, color: '#71717A', marginTop: 2 },
  codeCard: { backgroundColor: '#131316', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#27272A', gap: 12 },
  codeLabel: { fontSize: 13, color: '#A1A1AA' },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: 3 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1C1C1F',
    borderWidth: 1, borderColor: '#3F3F46', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  copyText: { color: '#FFD000', fontWeight: '600', fontSize: 14 },
  codeHint: { fontSize: 13, color: '#71717A', lineHeight: 18 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFD000', borderRadius: 16, height: 56,
  },
  shareText: { fontSize: 17, fontWeight: '800', color: '#000' },
});
