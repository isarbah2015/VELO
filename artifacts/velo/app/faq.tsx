import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// Support contact — same number surfaced in forgot-password recovery.
const SUPPORT_PHONE = '+233200000000';
const SUPPORT_EMAIL = 'support@velo-ride.com';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I book an Okada ride?',
    a: 'From the Home tab, set your pickup and destination, choose a ride tier (Standard, Premium or Okada Bossu), pick a payment method, then tap Confirm. We\'ll match you with the nearest online driver and show their bike and plate.',
  },
  {
    q: 'How do I pay for a ride?',
    a: 'VELO supports MTN Mobile Money, Vodafone Cash, AirtelTigo Money, cards, cash, and your in-app VELO Wallet. Choose your method before confirming a ride. Wallet top-ups are handled securely through Paystack.',
  },
  {
    q: 'How is the fare calculated?',
    a: 'Fares are based on distance and the ride tier you select. Loyalty members (Silver and Gold) automatically get a discount applied before you confirm. Any promo code is applied on top of that.',
  },
  {
    q: 'How do I know which bike to look for?',
    a: 'Once a driver accepts, the tracking screen shows a card with their number plate, bike make/model and colour, plus a live map of them approaching. Match the plate before you get on.',
  },
  {
    q: 'Is my ride safe?',
    a: 'Every driver is verified with a Ghana Card and photos of all four sides of their motorcycle. During a trip you can share your live location with family, message or call your driver in-app, and trigger Emergency SOS to dial 191.',
  },
  {
    q: 'How do I become a VELO driver?',
    a: 'Switch to Driver mode in your Profile, then open Verification and upload your Ghana Card, your four bike photos, and your plate + bike details. Once our team approves you, you can go online and start accepting rides.',
  },
  {
    q: 'What are loyalty tiers?',
    a: 'Riders climb Bronze → Silver → Gold as they complete trips. Silver unlocks 5% off fares and Gold unlocks 10% off, applied automatically. You can see your progress on the Profile screen.',
  },
  {
    q: 'How do I get referral rewards?',
    a: 'Open Promo & Referral from your Profile to find your unique code. When a friend signs up and takes their first ride using it, you both earn ₵10 in wallet credit.',
  },
  {
    q: 'Can I cancel a ride?',
    a: 'Yes. You can cancel before a driver arrives from the tracking screen. Repeated late cancellations may affect your account, so please only cancel when necessary.',
  },
  {
    q: 'I left something on the bike. What do I do?',
    a: 'Open the ride in Ride History and use the in-app chat or call to reach your driver directly. If you can\'t reach them, contact VELO support below and we\'ll help.',
  },
];

export default function FaqScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & FAQs</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <Ionicons name="help-buoy" size={32} color="#FFD000" />
          <Text style={styles.introTitle}>How can we help?</Text>
          <Text style={styles.introBody}>
            Answers to the most common questions. Still stuck? Reach our team any time.
          </Text>
        </View>

        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <TouchableOpacity
              key={i}
              style={styles.faqCard}
              onPress={() => setOpen(isOpen ? null : i)}
              activeOpacity={0.8}
            >
              <View style={styles.faqQrow}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#71717A" />
              </View>
              {isOpen && <Text style={styles.faqA}>{item.a}</Text>}
            </TouchableOpacity>
          );
        })}

        <Text style={styles.contactHeading}>Still need help?</Text>
        <TouchableOpacity
          style={styles.contactRow}
          onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_PHONE.replace('+', '')}`)}
          activeOpacity={0.8}
        >
          <View style={[styles.contactIcon, { backgroundColor: 'rgba(37,211,102,0.12)' }]}>
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactLabel}>Chat on WhatsApp</Text>
            <Text style={styles.contactSub}>{SUPPORT_PHONE}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#3F3F46" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactRow}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          activeOpacity={0.8}
        >
          <View style={[styles.contactIcon, { backgroundColor: 'rgba(255,208,0,0.12)' }]}>
            <Ionicons name="mail" size={20} color="#FFD000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.contactLabel}>Email support</Text>
            <Text style={styles.contactSub}>{SUPPORT_EMAIL}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#3F3F46" />
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 24 }} />
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  introCard: {
    backgroundColor: '#131316', borderRadius: 20, padding: 24, alignItems: 'center',
    gap: 12, borderWidth: 1, borderColor: '#27272A', marginBottom: 4,
  },
  introTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  introBody: { fontSize: 14, color: '#A1A1AA', textAlign: 'center', lineHeight: 22 },
  faqCard: {
    backgroundColor: '#131316', borderRadius: 16, padding: 18, gap: 10,
    borderWidth: 1, borderColor: '#27272A',
  },
  faqQrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  faqQ: { flex: 1, fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  faqA: { fontSize: 14, color: '#A1A1AA', lineHeight: 22 },
  contactHeading: {
    fontSize: 12, color: '#52525B', fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.8, marginTop: 12, paddingLeft: 4,
  },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#131316',
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#27272A',
  },
  contactIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  contactSub: { fontSize: 12, color: '#71717A', marginTop: 2 },
});
