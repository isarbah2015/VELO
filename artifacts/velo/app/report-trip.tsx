import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { createDispute, DISPUTE_CATEGORIES, type DisputeCategory } from '@/services/disputes';
import { EMERGENCY_NUMBER, callEmergency } from '@/services/safety';

// Rider/driver report-a-problem flow — the front end of dispute handling.
export default function ReportTripScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, role } = useApp();
  const params = useLocalSearchParams<{ rideId?: string; from?: string; to?: string }>();
  const rideId = params.rideId ?? '';

  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Only show categories that apply to who's reporting.
  const cats = DISPUTE_CATEGORIES.filter((c) => !c.forRole || c.forRole === role);
  const canSubmit = !!category && note.trim().length >= 4 && !!user && !!rideId;

  const submit = async () => {
    if (!canSubmit || !user || !category) return;
    setSubmitting(true);
    try {
      await createDispute({
        rideId,
        reporterId: user.uid,
        reporterRole: role,
        category,
        note,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Report submitted', "Thanks — our team will review this and get back to you.", [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Could not submit', 'Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report a problem</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }}>
        {(params.from || params.to) && (
          <View style={styles.tripCard}>
            <Ionicons name="bicycle" size={18} color="#FFD000" />
            <Text style={styles.tripText} numberOfLines={1}>{params.from} → {params.to}</Text>
          </View>
        )}

        <Text style={styles.label}>What went wrong?</Text>
        <View style={styles.catList}>
          {cats.map((c) => {
            const active = category === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.catRow, active && styles.catRowActive]}
                onPress={() => { Haptics.selectionAsync(); setCategory(c.id); }}
                activeOpacity={0.8}
              >
                <Ionicons name={c.icon as any} size={18} color={active ? '#FFD000' : '#A1A1AA'} />
                <Text style={[styles.catText, active && { color: '#FFFFFF' }]}>{c.label}</Text>
                {active && <Ionicons name="checkmark-circle" size={18} color="#FFD000" />}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Tell us more</Text>
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder="Describe what happened…"
          placeholderTextColor="#52525B"
          multiline
          textAlignVertical="top"
        />

        {/* Emergencies route straight to help, not a support ticket. */}
        <TouchableOpacity
          style={styles.sosRow}
          onPress={() => Alert.alert('Emergency', `Call Ghana emergency services (${EMERGENCY_NUMBER})?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: `Call ${EMERGENCY_NUMBER}`, style: 'destructive', onPress: callEmergency },
          ])}
          activeOpacity={0.8}
        >
          <Ionicons name="alert-circle" size={18} color="#EF4444" />
          <Text style={styles.sosText}>In danger right now? Contact emergency services</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={submit}
          disabled={!canSubmit || submitting}
          activeOpacity={0.85}
        >
          <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit report'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  tripCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#131316',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#27272A', marginBottom: 20,
  },
  tripText: { flex: 1, fontSize: 14, color: '#E4E4E7', fontWeight: '600' },
  label: { fontSize: 13, color: '#A1A1AA', fontWeight: '600', marginBottom: 10, marginTop: 8 },
  catList: { gap: 8, marginBottom: 8 },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#131316',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1F1F23',
  },
  catRowActive: { borderColor: '#FFD000', backgroundColor: 'rgba(255,208,0,0.06)' },
  catText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#A1A1AA' },
  input: {
    backgroundColor: '#131316', borderWidth: 1, borderColor: '#27272A', borderRadius: 12,
    padding: 14, minHeight: 110, fontSize: 15, color: '#FFFFFF',
  },
  sosRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18,
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  sosText: { flex: 1, fontSize: 13, color: '#FCA5A5', fontWeight: '600' },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: '#09090B', borderTopWidth: 1, borderTopColor: '#18181B',
  },
  submitBtn: { backgroundColor: '#FFD000', borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { opacity: 0.4 },
  submitText: { fontSize: 17, fontWeight: '800', color: '#000' },
});
