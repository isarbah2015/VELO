import React, { useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useApp, type PaymentMethod } from '@/context/AppContext';

interface ProviderOption {
  type: PaymentMethod['type'];
  label: string;
  color: string;
  prefix: string;
  icon: string;
}

const PROVIDERS: ProviderOption[] = [
  { type: 'momo', label: 'MTN MoMo', color: '#FFD000', prefix: '+233 24 / 25 / 54', icon: 'phone-portrait-outline' },
  { type: 'vodafone', label: 'Vodafone Cash', color: '#E60000', prefix: '+233 20 / 50', icon: 'phone-portrait-outline' },
  { type: 'airtel', label: 'AirtelTigo Cash', color: '#FF6900', prefix: '+233 26 / 27 / 57', icon: 'phone-portrait-outline' },
  { type: 'card', label: 'Bank Card', color: '#4DB8FF', prefix: 'XXXX XXXX XXXX', icon: 'card-outline' },
];

export default function AddPaymentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addPaymentMethod, paymentMethods } = useApp();
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);

  const [selectedType, setSelectedType] = useState<PaymentMethod['type']>('momo');
  const [number, setNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(paymentMethods.length === 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedProvider = PROVIDERS.find((p) => p.type === selectedType)!;

  const handleSave = async () => {
    setError('');
    if (!number.trim() || number.replace(/\s/g, '').length < 9) {
      setError(selectedType === 'card' ? 'Enter a valid card number' : 'Enter a valid phone number');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    await addPaymentMethod({
      type: selectedType,
      name: selectedProvider.label,
      number: selectedType === 'card' ? `•••• ${number.slice(-4)}` : `+233 ${number}`,
      isDefault: setAsDefault,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
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
            <Text style={styles.headerTitle}>Add Payment Method</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Provider selector */}
          <Text style={styles.sectionLabel}>Choose Provider</Text>
          <View style={styles.providerGrid}>
            {PROVIDERS.map((p) => {
              const isSelected = selectedType === p.type;
              return (
                <TouchableOpacity
                  key={p.type}
                  style={[styles.providerCard, isSelected && { borderColor: p.color, backgroundColor: p.color + '12' }]}
                  onPress={() => {
                    setSelectedType(p.type);
                    setNumber('');
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name={p.icon as any} size={24} color={isSelected ? p.color : '#52525B'} />
                  <Text style={[styles.providerLabel, isSelected && { color: p.color }]}>{p.label}</Text>
                  {isSelected && (
                    <View style={[styles.providerCheck, { backgroundColor: p.color }]}>
                      <Ionicons name="checkmark" size={10} color="#000" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Input */}
          <Text style={styles.sectionLabel}>
            {selectedType === 'card' ? 'Card Number' : 'Phone Number'}
          </Text>
          <View style={styles.inputGroup}>
            {selectedType !== 'card' && (
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>🇬🇭 +233</Text>
              </View>
            )}
            <TextInput
              style={[styles.input, selectedType !== 'card' && { flex: 1 }]}
              placeholder={selectedType === 'card' ? '1234 5678 9012 3456' : '24 000 0000'}
              placeholderTextColor="#52525B"
              value={number}
              onChangeText={setNumber}
              keyboardType={selectedType === 'card' ? 'number-pad' : 'phone-pad'}
              maxLength={selectedType === 'card' ? 19 : 12}
            />
          </View>

          {selectedType === 'card' && (
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.inputFull}
                placeholder="Cardholder name"
                placeholderTextColor="#52525B"
                value={holderName}
                onChangeText={setHolderName}
                autoCapitalize="words"
              />
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Set as default toggle */}
          <TouchableOpacity
            style={styles.defaultToggle}
            onPress={() => setSetAsDefault((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, setAsDefault && styles.checkboxActive]}>
              {setAsDefault && <Ionicons name="checkmark" size={14} color="#000" />}
            </View>
            <Text style={styles.defaultToggleText}>Set as default payment method</Text>
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.saveBtnText}>Save Payment Method</Text>
            )}
          </TouchableOpacity>

          <View style={styles.securityRow}>
            <Ionicons name="lock-closed-outline" size={14} color="#52525B" />
            <Text style={styles.securityText}>256-bit encrypted • PCI DSS compliant</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  content: { paddingHorizontal: 16, gap: 14 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: '#52525B',
    textTransform: 'uppercase', letterSpacing: 0.8, paddingLeft: 4,
  },
  providerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  providerCard: {
    width: '47%', backgroundColor: '#1C1C1F', borderRadius: 14,
    padding: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#27272A',
    position: 'relative',
  },
  providerLabel: { fontSize: 13, fontWeight: '600', color: '#71717A', textAlign: 'center' },
  providerCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  inputGroup: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  countryCode: {
    backgroundColor: '#1C1C1F', borderWidth: 1, borderColor: '#3F3F46',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14,
  },
  countryCodeText: { fontSize: 15, color: '#FFFFFF' },
  input: {
    backgroundColor: '#1C1C1F', borderWidth: 1, borderColor: '#3F3F46',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#FFFFFF',
  },
  inputFull: {
    backgroundColor: '#1C1C1F', borderWidth: 1, borderColor: '#3F3F46',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#FFFFFF',
  },
  errorText: { fontSize: 13, color: '#EF4444' },
  defaultToggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#3F3F46',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: '#FFD000', borderColor: '#FFD000' },
  defaultToggleText: { fontSize: 14, color: '#A1A1AA', flex: 1 },
  saveBtn: {
    backgroundColor: '#FFD000', borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#000000' },
  securityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  securityText: { fontSize: 12, color: '#3F3F46' },
});
