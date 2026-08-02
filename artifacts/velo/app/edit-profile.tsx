import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/context/AppContext';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile } = useApp();

  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);

  const dirty = name.trim().length >= 2 && name.trim() !== user?.name;

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await updateProfile(name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('Could not save', 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(name || 'R').charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Full name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor="#52525B"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={save}
        />

        <Text style={styles.fieldLabel}>Phone number</Text>
        <View style={[styles.input, styles.inputLocked]}>
          <Text style={styles.lockedText}>+233 {user?.phone ?? ''}</Text>
          <Ionicons name="lock-closed" size={15} color="#52525B" />
        </View>
        <Text style={styles.hint}>Your phone number is your login and can&apos;t be changed here.</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, (!dirty || saving) && styles.saveDisabled]}
          onPress={save}
          disabled={!dirty || saving}
          activeOpacity={0.85}
        >
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </TouchableOpacity>
      </View>
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
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  avatarWrap: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFD000',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 38, fontWeight: '800', color: '#000000' },
  fieldLabel: { fontSize: 13, color: '#A1A1AA', fontWeight: '500', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#1C1C1F', borderWidth: 1, borderColor: '#3F3F46', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#FFFFFF',
  },
  inputLocked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lockedText: { fontSize: 15, color: '#71717A' },
  hint: { fontSize: 12, color: '#52525B', marginTop: 8, lineHeight: 17 },
  footer: {
    paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#09090B',
    borderTopWidth: 1, borderTopColor: '#18181B',
  },
  saveBtn: { backgroundColor: '#FFD000', borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  saveDisabled: { opacity: 0.4 },
  saveText: { fontSize: 17, fontWeight: '800', color: '#000' },
});
