import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

function formatDate(date: Date) {
  return date.toLocaleString('en-GH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PaymentConfirmationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { amount, reference, method } = useLocalSearchParams<{ amount: string; reference: string; method: string }>();
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }).start();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="light" />

      <View style={styles.center}>
        <Animated.View style={[styles.successCircle, { transform: [{ scale }] }]}>
          <Ionicons name="checkmark" size={40} color="#000000" />
        </Animated.View>
        <Text style={styles.amount}>₵{parseFloat(amount ?? '0').toFixed(2)}</Text>
        <Text style={styles.status}>Payment Successful</Text>

        <View style={styles.receipt}>
          <ReceiptRow label="Reference" value={reference ?? '—'} isLast={false} />
          <ReceiptRow label="Method" value={method ?? 'Mobile Money'} isLast={false} />
          <ReceiptRow label="Date" value={formatDate(new Date())} isLast />
        </View>
      </View>

      <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()} activeOpacity={0.85}>
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

function ReceiptRow({ label, value, isLast }: { label: string; value: string; isLast: boolean }) {
  return (
    <View style={[styles.receiptRow, !isLast && styles.receiptRowBorder]}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={styles.receiptValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B', paddingHorizontal: 24, justifyContent: 'space-between' },
  center: { alignItems: 'center' },
  successCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFD000',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  amount: { fontSize: 40, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  status: { fontSize: 15, color: '#A1A1AA', marginTop: 6 },
  receipt: {
    width: '100%', marginTop: 32, backgroundColor: '#1C1C1F', borderRadius: 16,
    borderWidth: 1, borderColor: '#27272A', overflow: 'hidden',
  },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  receiptRowBorder: { borderBottomWidth: 1, borderBottomColor: '#27272A' },
  receiptLabel: { fontSize: 13, color: '#71717A' },
  receiptValue: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', flexShrink: 1, marginLeft: 16 },
  doneBtn: {
    backgroundColor: '#FFD000', borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#000000' },
});
