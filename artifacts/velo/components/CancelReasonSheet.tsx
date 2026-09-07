import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';

const VELO = colors.dark;

// Reason-required cancel sheet — shared by the rider (tracking + search-cancel)
// and driver (active trip) cancel flows so both sides always log why. VELO
// never charges a cancellation fee; this only records the reason.
export default function CancelReasonSheet({
  visible,
  title,
  reasons,
  onDismiss,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  reasons: readonly string[];
  onDismiss: () => void;
  onConfirm: (reason: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');

  const isOther = selected === 'Other';
  const canConfirm = !!selected && (!isOther || otherText.trim().length > 0);

  const reset = () => {
    setSelected(null);
    setOtherText('');
  };

  const handleDismiss = () => {
    reset();
    onDismiss();
  };

  const handleConfirm = () => {
    if (!canConfirm || !selected) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const reason = isOther ? otherText.trim() : selected;
    reset();
    onConfirm(reason);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <View style={styles.headRow}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={handleDismiss} hitSlop={10}>
              <Ionicons name="close" size={22} color={VELO.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.sub}>Cancelling is always free — just tell us why.</Text>

          <View style={styles.reasonList}>
            {reasons.map((r) => {
              const active = selected === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonRow, active && styles.reasonRowActive]}
                  onPress={() => { Haptics.selectionAsync(); setSelected(r); }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.reasonText, active && styles.reasonTextActive]}>{r}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isOther && (
            <TextInput
              style={styles.otherInput}
              placeholder="Tell us more…"
              placeholderTextColor={VELO.textMuted}
              value={otherText}
              onChangeText={setOtherText}
              multiline
              maxLength={200}
            />
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!canConfirm}
            activeOpacity={0.85}
          >
            <Text style={[styles.confirmText, !canConfirm && styles.confirmTextDisabled]}>Confirm cancellation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={handleDismiss} activeOpacity={0.7}>
            <Text style={styles.backText}>Never mind, keep the ride</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: VELO.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: VELO.border,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: VELO.inputBorder, alignSelf: 'center', marginBottom: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: VELO.text, fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  sub: { color: VELO.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 16 },
  reasonList: { gap: 8 },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: VELO.card, borderWidth: 1, borderColor: VELO.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
  },
  reasonRowActive: { borderColor: VELO.primary, backgroundColor: 'rgba(255,208,0,0.08)' },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: VELO.inputBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: VELO.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: VELO.primary },
  reasonText: { color: VELO.textSecondary, fontSize: 14.5, fontWeight: '600', flex: 1 },
  reasonTextActive: { color: VELO.text, fontWeight: '700' },
  otherInput: {
    backgroundColor: VELO.card, borderWidth: 1, borderColor: VELO.inputBorder,
    borderRadius: 14, padding: 14, color: VELO.text, fontSize: 14,
    minHeight: 70, marginTop: 12, textAlignVertical: 'top',
  },
  confirmBtn: {
    backgroundColor: VELO.error, borderRadius: 16, height: 54,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  confirmBtnDisabled: { backgroundColor: VELO.card, borderWidth: 1, borderColor: VELO.border },
  confirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  confirmTextDisabled: { color: VELO.textMuted },
  backBtn: { alignItems: 'center', justifyContent: 'center', height: 46 },
  backText: { color: VELO.textSecondary, fontSize: 14, fontWeight: '700' },
});
