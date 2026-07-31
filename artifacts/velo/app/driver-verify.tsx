import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import {
  DOC_FIELDS, type DocKey, type VerificationStatus,
  uploadVerificationImage, submitVerification, getVerification,
} from '@/services/verification';

const STATUS_META: Record<VerificationStatus, { label: string; color: string; icon: any }> = {
  unverified: { label: 'Not verified', color: '#71717A', icon: 'shield-outline' },
  pending: { label: 'Under review', color: '#FFD000', icon: 'time-outline' },
  verified: { label: 'Verified', color: '#22C55E', icon: 'shield-checkmark' },
  rejected: { label: 'Rejected — resubmit', color: '#EF4444', icon: 'close-circle-outline' },
};

export default function DriverVerifyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();

  const [uris, setUris] = useState<Partial<Record<DocKey, string>>>({});
  const [status, setStatus] = useState<VerificationStatus>('unverified');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    getVerification(user.uid).then((v) => {
      setStatus(v.status);
      if (v.docs) setUris(v.docs);
    });
  }, [user]);

  const pick = async (key: DocKey) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload your documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.selectionAsync();
      setUris((prev) => ({ ...prev, [key]: result.assets[0].uri }));
    }
  };

  const allProvided = DOC_FIELDS.every((f) => uris[f.key]);

  const submit = async () => {
    if (!user || !allProvided) return;
    setSubmitting(true);
    try {
      const entries = await Promise.all(
        DOC_FIELDS.map(async (f) => {
          const local = uris[f.key]!;
          // Already-uploaded https URLs (from a prior submission) are kept as-is.
          const url = local.startsWith('http') ? local : await uploadVerificationImage(user.uid, f.key, local);
          return [f.key, url] as const;
        })
      );
      await submitVerification(user.uid, Object.fromEntries(entries) as Record<DocKey, string>);
      setStatus('pending');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Submitted', 'Your documents are under review. We\'ll notify you once verified.');
    } catch (e) {
      Alert.alert('Upload failed', 'Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const meta = STATUS_META[status];
  const locked = status === 'pending' || status === 'verified';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Verification</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 120 }}>
        <View style={[styles.statusChip, { borderColor: meta.color }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        <Text style={styles.intro}>
          Upload a clear photo of your Ghana Card and all four sides of your motorcycle. This keeps
          riders safe and unlocks payouts.
        </Text>

        {DOC_FIELDS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={styles.docRow}
            onPress={() => !locked && pick(f.key)}
            activeOpacity={locked ? 1 : 0.8}
          >
            {uris[f.key] ? (
              <Image source={{ uri: uris[f.key] }} style={styles.thumb} />
            ) : (
              <View style={styles.thumbEmpty}>
                <Ionicons name="camera-outline" size={22} color="#52525B" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.docLabel}>{f.label}</Text>
              <Text style={[styles.docSub, uris[f.key] && { color: '#22C55E' }]}>
                {uris[f.key] ? 'Photo added' : 'Tap to upload'}
              </Text>
            </View>
            {!locked && <Ionicons name={uris[f.key] ? 'checkmark-circle' : 'chevron-forward'} size={20} color={uris[f.key] ? '#22C55E' : '#3F3F46'} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!locked && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.submitBtn, (!allProvided || submitting) && styles.submitDisabled]}
            onPress={submit}
            disabled={!allProvided || submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>{submitting ? 'Uploading…' : 'Submit for review'}</Text>
          </TouchableOpacity>
        </View>
      )}
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
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
  },
  statusText: { fontSize: 14, fontWeight: '700' },
  intro: { fontSize: 14, color: '#A1A1AA', lineHeight: 20, marginTop: 16, marginBottom: 8 },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#131316',
    borderRadius: 16, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#1F1F23',
  },
  thumb: { width: 54, height: 54, borderRadius: 10, backgroundColor: '#1C1C1F' },
  thumbEmpty: {
    width: 54, height: 54, borderRadius: 10, backgroundColor: '#1C1C1F',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3F3F46', borderStyle: 'dashed',
  },
  docLabel: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  docSub: { fontSize: 13, color: '#71717A', marginTop: 2 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: '#09090B', borderTopWidth: 1, borderTopColor: '#18181B',
  },
  submitBtn: { backgroundColor: '#FFD000', borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { opacity: 0.4 },
  submitText: { fontSize: 17, fontWeight: '800', color: '#000' },
});
