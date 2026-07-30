import React, { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useApp, type PaymentMethod } from '@/context/AppContext';

const PROVIDER_META: Record<PaymentMethod['type'], { label: string; color: string; icon: string }> = {
  momo: { label: 'MTN MoMo', color: '#FFD000', icon: 'phone-portrait-outline' },
  vodafone: { label: 'Vodafone Cash', color: '#E60000', icon: 'phone-portrait-outline' },
  airtel: { label: 'AirtelTigo', color: '#E40000', icon: 'phone-portrait-outline' },
  card: { label: 'Bank Card', color: '#4DB8FF', icon: 'card-outline' },
};

export default function PaymentMethodsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { paymentMethods, removePaymentMethod, setDefaultPayment } = useApp();
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);

  const handleRemove = (method: PaymentMethod) => {
    if (method.isDefault) {
      Alert.alert('Cannot Remove', 'This is your default payment method. Set another as default first.');
      return;
    }
    Alert.alert('Remove Payment Method', `Remove ${method.name} (${method.number})?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removePaymentMethod(method.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const handleSetDefault = async (method: PaymentMethod) => {
    if (method.isDefault) return;
    await setDefaultPayment(method.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, isWeb ? 34 : 8) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Wallet shortcut */}
        <TouchableOpacity style={styles.walletCard} onPress={() => router.push('/wallet')}>
          <View style={styles.walletLeft}>
            <View style={styles.walletIconWrap}>
              <Ionicons name="wallet" size={22} color="#FFD000" />
            </View>
            <View>
              <Text style={styles.walletLabel}>VELO Wallet</Text>
              <Text style={styles.walletSub}>Tap to top up or view transactions</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#52525B" />
        </TouchableOpacity>

        {/* Methods list */}
        <Text style={styles.sectionTitle}>Saved Methods</Text>

        {paymentMethods.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={48} color="#27272A" />
            <Text style={styles.emptyTitle}>No payment methods</Text>
            <Text style={styles.emptySub}>Add a Mobile Money or card to pay for rides</Text>
          </View>
        ) : (
          <View style={styles.methodsList}>
            {paymentMethods.map((method) => {
              const meta = PROVIDER_META[method.type];
              return (
                <View key={method.id} style={styles.methodCard}>
                  <View style={[styles.methodIcon, { borderColor: meta.color + '40' }]}>
                    <Ionicons name={meta.icon as any} size={22} color={meta.color} />
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodName}>{meta.label}</Text>
                    <Text style={styles.methodNumber}>{method.number}</Text>
                  </View>
                  <View style={styles.methodActions}>
                    {method.isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.setDefaultBtn}
                        onPress={() => handleSetDefault(method)}
                      >
                        <Text style={styles.setDefaultText}>Set default</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemove(method)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#52525B" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Add button */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/add-payment')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={22} color="#FFD000" />
          <Text style={styles.addBtnText}>Add Payment Method</Text>
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#22C55E" />
          <Text style={styles.infoText}>
            Your payment details are encrypted and never stored on our servers. All transactions are secured.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  walletCard: {
    backgroundColor: '#1C1C1F',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FFD00030',
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  walletIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,208,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  walletSub: {
    fontSize: 12,
    color: '#71717A',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#52525B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySub: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
  },
  methodsList: {
    gap: 10,
  },
  methodCard: {
    backgroundColor: '#1C1C1F',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#252528',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  methodInfo: {
    flex: 1,
    gap: 3,
  },
  methodName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  methodNumber: {
    fontSize: 12,
    color: '#71717A',
  },
  methodActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  defaultBadge: {
    backgroundColor: 'rgba(255,208,0,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFD000',
  },
  setDefaultBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  setDefaultText: {
    fontSize: 11,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  removeBtn: {
    padding: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1C1C1F',
    borderRadius: 14,
    height: 54,
    borderWidth: 1,
    borderColor: '#FFD00030',
    borderStyle: 'dashed',
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFD000',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  infoText: {
    fontSize: 12,
    color: '#71717A',
    flex: 1,
    lineHeight: 18,
  },
});
