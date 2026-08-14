import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import {
  getEmergencyContacts, saveEmergencyContacts, type EmergencyContact,
} from '@/services/settings';

export default function EmergencyContactsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => { getEmergencyContacts().then(setContacts); }, []);

  const persist = (next: EmergencyContact[]) => {
    setContacts(next);
    saveEmergencyContacts(next).catch(() => {});
  };

  const add = () => {
    const n = name.trim();
    const p = phone.trim();
    if (n.length < 2 || p.length < 7) {
      Alert.alert('Incomplete', 'Enter a name and a valid phone number.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    persist([...contacts, { id: Date.now().toString(), name: n, phone: p }]);
    setName('');
    setPhone('');
  };

  const remove = (id: string) => {
    Alert.alert('Remove contact', 'Remove this emergency contact?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => persist(contacts.filter((c) => c.id !== id)) },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Contacts</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          These people can be reached quickly during a trip. Add a trusted family member or friend.
        </Text>

        {contacts.length > 0 && (
          <View style={styles.card}>
            {contacts.map((c, i) => (
              <View key={c.id}>
                <View style={styles.row}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{c.name}</Text>
                    <Text style={styles.phone}>{c.phone}</Text>
                  </View>
                  <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${c.phone}`)} activeOpacity={0.8}>
                    <Ionicons name="call" size={18} color="#22C55E" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.delBtn} onPress={() => remove(c.id)} activeOpacity={0.8}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                {i < contacts.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        )}

        <View style={styles.addCard}>
          <Text style={styles.addTitle}>Add a contact</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#52525B"
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor="#52525B"
            keyboardType="phone-pad"
          />
          <TouchableOpacity style={styles.addBtn} onPress={add} activeOpacity={0.85}>
            <Ionicons name="add" size={20} color="#000" />
            <Text style={styles.addBtnText}>Add contact</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  intro: { fontSize: 14, color: '#A1A1AA', lineHeight: 20 },
  card: {
    backgroundColor: '#131316', borderRadius: 16, borderWidth: 1, borderColor: '#27272A', overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#252528',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '800', color: '#FFD000' },
  name: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  phone: { fontSize: 13, color: '#71717A', marginTop: 2 },
  callBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  delBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: '#27272A', marginLeft: 66 },
  addCard: {
    backgroundColor: '#131316', borderRadius: 16, padding: 16, gap: 12,
    borderWidth: 1, borderColor: '#27272A',
  },
  addTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  input: {
    backgroundColor: '#1C1C1F', borderWidth: 1, borderColor: '#3F3F46', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#FFFFFF',
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFD000', borderRadius: 12, height: 48,
  },
  addBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
});
