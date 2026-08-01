import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useApp, type WalletTransaction } from '@/context/AppContext';
import { auth } from '@/config/firebase';
import { topUpViaPaystack, reconcilePendingTopups } from '@/services/paystack';

const QUICK_AMOUNTS = [20, 50, 100, 200];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const isTopup = tx.type === 'topup';
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIconWrap, { backgroundColor: isTopup ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }]}>
        <Ionicons
          name={isTopup ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
          size={22}
          color={isTopup ? '#22C55E' : '#EF4444'}
        />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txDesc}>{tx.description}</Text>
        <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isTopup ? '#22C55E' : '#EF4444' }]}>
        {isTopup ? '+' : '-'}₵{tx.amount.toFixed(2)}
      </Text>
    </View>
  );
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { walletBalance, walletTransactions, paymentMethods, getDefaultPayment, refreshWallet } = useApp();
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);

  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const defaultMethod = getDefaultPayment();

  // Catch top-ups that were paid but never confirmed (app closed mid-payment).
  // Replaces the need for a Paystack webhook, which the shared account can't add.
  useEffect(() => {
    reconcilePendingTopups()
      .then((credited) => { if (credited) refreshWallet(); })
      .catch(() => {});
  }, [refreshWallet]);

  const handleTopUp = async () => {
    setError('');
    const num = parseFloat(amount);
    if (!num || num < 5) {
      setError('Minimum top-up is ₵5.00');
      return;
    }
    // Paystack needs an email; Auth stores VELO's synthetic phone email.
    const email = auth.currentUser?.email ?? 'wallet@velo.app';
    setIsLoading(true);
    try {
      const { paid, reference } = await topUpViaPaystack(num, email);
      if (!paid) {
        setError('Payment was not completed. You were not charged.');
        return;
      }
      await refreshWallet(); // balance credited server-side
      setAmount('');
      router.push({
        pathname: '/payment-confirmation',
        params: { amount: num.toString(), reference, method: 'Paystack' },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar style="light" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, isWeb ? 34 : 8) + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>VELO Wallet</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Balance card */}
          <LinearGradient
            colors={['#1C1C00', '#2A2500', '#1C1C1F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <View style={styles.balanceTop}>
              <Ionicons name="wallet" size={24} color="#FFD000" />
              <Text style={styles.balanceLabel}>Available Balance</Text>
            </View>
            <Text style={styles.balanceAmount}>₵{walletBalance.toFixed(2)}</Text>
            <Text style={styles.balanceSub}>Use for rides or top up anytime</Text>
          </LinearGradient>

          {/* Top up */}
          <View style={styles.topupCard}>
            <Text style={styles.topupTitle}>Top Up Wallet</Text>

            {defaultMethod ? (
              <View style={styles.methodRow}>
                <Ionicons name="phone-portrait-outline" size={18} color="#A1A1AA" />
                <Text style={styles.methodText}>{defaultMethod.name} · {defaultMethod.number}</Text>
                <TouchableOpacity onPress={() => router.push('/payment-methods')}>
                  <Text style={styles.changeText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addMethodPrompt} onPress={() => router.push('/add-payment')}>
                <Ionicons name="add-circle-outline" size={18} color="#FFD000" />
                <Text style={styles.addMethodText}>Add a payment method first</Text>
              </TouchableOpacity>
            )}

            <View style={styles.quickAmounts}>
              {QUICK_AMOUNTS.map((qa) => (
                <TouchableOpacity
                  key={qa}
                  style={[styles.quickAmountBtn, amount === qa.toString() && styles.quickAmountBtnActive]}
                  onPress={() => {
                    setAmount(qa.toString());
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[styles.quickAmountText, amount === qa.toString() && styles.quickAmountTextActive]}>
                    ₵{qa}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.amountInput}>
              <Text style={styles.cedisSymbol}>₵</Text>
              <TextInput
                style={styles.amountTextInput}
                placeholder="Enter amount"
                placeholderTextColor="#52525B"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.topupBtn, isLoading && styles.topupBtnDisabled]}
              onPress={handleTopUp}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.topupBtnText}>Top Up Now</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Transaction history */}
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {walletTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color="#27272A" />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {walletTransactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  content: { paddingHorizontal: 16, gap: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  balanceCard: {
    borderRadius: 20, padding: 24, gap: 8, borderWidth: 1, borderColor: '#FFD00030',
  },
  balanceTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceLabel: { fontSize: 13, color: '#71717A', fontWeight: '500' },
  balanceAmount: { fontSize: 42, fontWeight: '900', color: '#FFFFFF' },
  balanceSub: { fontSize: 13, color: '#52525B' },
  topupCard: {
    backgroundColor: '#1C1C1F', borderRadius: 20, padding: 20, gap: 14,
    borderWidth: 1, borderColor: '#27272A',
  },
  topupTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#252528', borderRadius: 12, padding: 12,
  },
  methodText: { fontSize: 13, color: '#A1A1AA', flex: 1 },
  changeText: { fontSize: 13, color: '#FFD000', fontWeight: '600' },
  addMethodPrompt: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#252528', borderRadius: 12, padding: 12,
  },
  addMethodText: { fontSize: 13, color: '#FFD000' },
  quickAmounts: { flexDirection: 'row', gap: 8 },
  quickAmountBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#252528',
    alignItems: 'center', borderWidth: 1, borderColor: '#3F3F46',
  },
  quickAmountBtnActive: { backgroundColor: '#FFD000', borderColor: '#FFD000' },
  quickAmountText: { fontSize: 14, fontWeight: '700', color: '#71717A' },
  quickAmountTextActive: { color: '#000000' },
  amountInput: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#252528', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 4,
    borderWidth: 1, borderColor: '#3F3F46',
  },
  cedisSymbol: { fontSize: 22, fontWeight: '700', color: '#FFD000' },
  amountTextInput: { flex: 1, fontSize: 22, fontWeight: '700', color: '#FFFFFF', paddingVertical: 10 },
  errorText: { fontSize: 13, color: '#EF4444' },
  topupBtn: {
    backgroundColor: '#FFD000', borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
  },
  topupBtnDisabled: { opacity: 0.5 },
  topupBtnText: { fontSize: 16, fontWeight: '700', color: '#000000' },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: '#52525B', textTransform: 'uppercase',
    letterSpacing: 0.8, paddingLeft: 4,
  },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyText: { fontSize: 14, color: '#71717A' },
  txList: {
    backgroundColor: '#1C1C1F', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#27272A',
  },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#27272A',
  },
  txIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, gap: 3 },
  txDesc: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  txDate: { fontSize: 11, color: '#71717A' },
  txAmount: { fontSize: 15, fontWeight: '700' },
});
