import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import {
  DOC_FIELDS, type DocKey, type VerificationStatus,
  uploadVerificationImage, submitVerification, getVerification, isLicenseExpired,
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
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');

  useEffect(() => {
    if (!user) return;
    getVerification(user.uid).then((v) => {
      setStatus(v.status);
      if (v.docs) setUris(v.docs);
      if (v.vehicle) {
        setPlate(v.vehicle.plate ?? '');
        setModel(v.vehicle.model ?? '');
        setColor(v.vehicle.color ?? '');
      }
      if (v.license) {
        setLicenseNo(v.license.number ?? '');
        setLicenseExpiry(v.license.expiry ?? '');
      }
    });
  }, [user]);

  // Camera-only capture (no gallery). Documents and bike photos must be taken
  // live so a driver can't upload arbitrary images pulled from elsewhere — a
  // basic anti-fraud measure for verification.
  const pick = async (key: DocKey) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to photograph your Ghana Card and motorcycle. Documents must be taken with the camera, not chosen from your gallery.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      allowsEditing: true,
      cameraType: ImagePicker.CameraType.back,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.selectionAsync();
      setUris((prev) => ({ ...prev, [key]: result.assets[0].uri }));
    }
  };

  // Live selfie via the FRONT camera, for face-matching against the Ghana Card
  // and licence at review — the guard against a borrowed/stolen ID.
  const takeSelfie = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to take a live selfie for identity verification.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.selectionAsync();
      setUris((prev) => ({ ...prev, selfie: result.assets[0].uri }));
    }
  };

  const expiry = licenseExpiry.trim();
  const expiryValid = /^\d{4}-\d{2}-\d{2}$/.test(expiry);
  const expired = expiryValid && isLicenseExpired(expiry);
  const licenseOk = licenseNo.trim().length >= 4 && expiryValid && !expired;
  const vehicleOk = plate.trim().length >= 4 && model.trim().length >= 2 && color.trim().length >= 2;
  const allProvided =
    DOC_FIELDS.every((f) => uris[f.key]) && !!uris.selfie && vehicleOk && licenseOk;

  const submit = async () => {
    if (!user || !allProvided) return;
    setSubmitting(true);
    try {
      // Upload every document photo plus the selfie (front-camera).
      const keys: DocKey[] = [...DOC_FIELDS.map((f) => f.key), 'selfie'];
      const entries = await Promise.all(
        keys.map(async (k) => {
          const local = uris[k]!;
          // Already-uploaded https URLs (from a prior submission) are kept as-is.
          const url = local.startsWith('http') ? local : await uploadVerificationImage(user.uid, k, local);
          return [k, url] as const;
        })
      );
      await submitVerification(
        user.uid,
        Object.fromEntries(entries) as Record<DocKey, string>,
        { plate: plate.trim(), model: model.trim(), color: color.trim() },
        { number: licenseNo.trim(), expiry: expiry }
      );
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
          Photograph your Ghana Card, your rider's licence (front & back), all four sides of your
          motorcycle, and take a live selfie (camera only). Riders only ride with verified, licensed
          drivers.
        </Text>

        {/* Live selfie — front camera, for face-matching against the ID + licence. */}
        <TouchableOpacity
          style={styles.docRow}
          onPress={() => !locked && takeSelfie()}
          activeOpacity={locked ? 1 : 0.8}
        >
          {uris.selfie ? (
            <Image source={{ uri: uris.selfie }} style={styles.thumb} />
          ) : (
            <View style={styles.thumbEmpty}>
              <Ionicons name="person-outline" size={22} color="#52525B" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.docLabel}>Live selfie</Text>
            <Text style={[styles.docSub, uris.selfie && { color: '#22C55E' }]}>
              {uris.selfie ? 'Selfie added' : 'Tap to take a selfie'}
            </Text>
          </View>
          {!locked && <Ionicons name={uris.selfie ? 'checkmark-circle' : 'chevron-forward'} size={20} color={uris.selfie ? '#22C55E' : '#3F3F46'} />}
        </TouchableOpacity>

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
                {uris[f.key] ? 'Photo added' : 'Tap to take photo'}
              </Text>
            </View>
            {!locked && <Ionicons name={uris[f.key] ? 'checkmark-circle' : 'chevron-forward'} size={20} color={uris[f.key] ? '#22C55E' : '#3F3F46'} />}
          </TouchableOpacity>
        ))}

        {/* Licence details — number + expiry kept on record; an expired
            licence can't be submitted and is flagged if it lapses later. */}
        <Text style={styles.sectionTitle}>Rider's licence</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Licence number</Text>
          <TextInput
            style={styles.input}
            value={licenseNo}
            onChangeText={setLicenseNo}
            editable={!locked}
            placeholder="e.g. GHA-1234567"
            placeholderTextColor="#52525B"
            autoCapitalize="characters"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Expiry date (YYYY-MM-DD)</Text>
          <TextInput
            style={[styles.input, expired && { borderColor: '#EF4444' }]}
            value={licenseExpiry}
            onChangeText={setLicenseExpiry}
            editable={!locked}
            placeholder="2027-12-31"
            placeholderTextColor="#52525B"
            keyboardType="numbers-and-punctuation"
          />
          {expired && <Text style={styles.errorText}>This licence has expired — renew it before applying.</Text>}
        </View>

        {/* Vehicle details — the plate + description a rider uses to spot the
            right bike, and the platform keeps on record. */}
        <Text style={styles.sectionTitle}>Vehicle details</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Number plate</Text>
          <TextInput
            style={styles.input}
            value={plate}
            onChangeText={setPlate}
            editable={!locked}
            placeholder="e.g. GR-1234-24"
            placeholderTextColor="#52525B"
            autoCapitalize="characters"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Make & model</Text>
          <TextInput
            style={styles.input}
            value={model}
            onChangeText={setModel}
            editable={!locked}
            placeholder="e.g. Bajaj Boxer"
            placeholderTextColor="#52525B"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Colour</Text>
          <TextInput
            style={styles.input}
            value={color}
            onChangeText={setColor}
            editable={!locked}
            placeholder="e.g. Red"
            placeholderTextColor="#52525B"
            autoCapitalize="words"
          />
        </View>
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
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginTop: 24, marginBottom: 12 },
  field: { marginBottom: 14, gap: 6 },
  fieldLabel: { fontSize: 13, color: '#A1A1AA', fontWeight: '500' },
  errorText: { fontSize: 12, color: '#EF4444', marginTop: 2 },
  input: {
    backgroundColor: '#1C1C1F',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#FFFFFF',
  },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: '#09090B', borderTopWidth: 1, borderTopColor: '#18181B',
  },
  submitBtn: { backgroundColor: '#FFD000', borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { opacity: 0.4 },
  submitText: { fontSize: 17, fontWeight: '800', color: '#000' },
});
