import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const SECTIONS = [
  {
    title: '1. Introduction',
    body: `VELO ("we", "us", or "our") operates the VELO mobile application (the "Service"). This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.

By using the Service, you agree to the collection and use of information in accordance with this policy. Unless otherwise defined in this Privacy Policy, terms used in this Privacy Policy have the same meanings as in our Terms and Conditions.

VELO is a ride-hailing platform connecting riders with motorcycle (Okada) drivers in Ghana.`,
  },
  {
    title: '2. Information We Collect',
    body: `We collect several different types of information for various purposes to provide and improve our Service to you.

Personal Data:
• Phone number and authentication credentials
• Full name and profile photo
• Payment information (Mobile Money number, network provider)
• Device location (GPS coordinates during active rides)
• Device information (model, OS version, unique identifiers)

Usage Data:
• Ride history (pickup/drop-off locations, timestamps, fares)
• In-app messaging and call logs
• App crash reports and diagnostic data
• IP address and browser type (for web access)`,
  },
  {
    title: '3. How We Use Your Data',
    body: `VELO uses the collected data for various purposes:

• To provide and maintain our Service
• To match riders with nearby drivers
• To process payments via MTN Mobile Money, Vodafone Cash, and AirtelTigo Money
• To notify you about changes to our Service
• To allow you to participate in interactive features
• To provide customer support
• To gather analysis or valuable information so that we can improve our Service
• To monitor the usage of our Service
• To detect, prevent and address technical issues
• To ensure rider and driver safety through trip tracking`,
  },
  {
    title: '4. Location Data',
    body: `We collect precise location data from your device during active rides and when the app is open. This is essential for:

• Showing your location on the map
• Finding nearby available drivers
• Tracking the progress of your ride
• Calculating accurate fares based on distance traveled
• Safety monitoring during trips

You can disable location services through your device settings, but this will prevent you from using core features of the VELO app.`,
  },
  {
    title: '5. Data Sharing & Disclosure',
    body: `We do not sell your personal data. We may share your information with:

• Drivers: Your name, pickup location, and phone number (masked) are shared with the driver assigned to your ride.
• Payment Processors: Mobile Money providers (MTN, Vodafone, AirtelTigo) receive transaction details necessary to process payments.
• Law Enforcement: We may disclose your information where required to do so by law or in response to valid requests by public authorities (e.g., a court or government agency).
• Safety Partners: In emergencies, we may share trip data with emergency services or safety response teams.

All third-party service providers are contractually obligated to protect your data and use it only for the purposes we specify.`,
  },
  {
    title: '6. Data Security',
    body: `The security of your data is important to us. We use industry-standard security measures including:

• Encryption of data in transit (TLS/SSL)
• Firebase Authentication for secure login
• Firestore security rules restricting data access
• Regular security audits of our infrastructure

However, no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.`,
  },
  {
    title: '7. Data Retention',
    body: `We retain your Personal Data only for as long as is necessary for the purposes set out in this Privacy Policy:

• Account data: Retained until you delete your account
• Ride history: Retained for 7 years for tax and legal compliance
• Location data: Retained for 90 days after trip completion (then anonymized)
• Payment records: Retained for 7 years per Ghana Revenue Authority requirements

You may request deletion of your account and associated data at any time through the app or by contacting our support team.`,
  },
  {
    title: '8. Your Rights',
    body: `Under the Data Protection Act, 2012 (Act 843) of Ghana, you have the right to:

• Access the personal data we hold about you
• Request correction of inaccurate data
• Request deletion of your personal data
• Object to processing of your personal data
• Request restriction of processing
• Data portability (receive your data in a structured format)

To exercise any of these rights, please contact us at privacy@velo-ride.com.`,
  },
  {
    title: '9. Children\'s Privacy',
    body: `Our Service does not address anyone under the age of 18 ("Children"). We do not knowingly collect personally identifiable information from anyone under the age of 18. If you are a parent or guardian and you are aware that your Child has provided us with Personal Data, please contact us. If we become aware that we have collected Personal Data from children without verification of parental consent, we take steps to remove that information from our servers.`,
  },
  {
    title: '10. Changes to This Policy',
    body: `We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "effective date" at the top of this policy.

You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.`,
  },
  {
    title: '11. Contact Us',
    body: `If you have any questions about this Privacy Policy, please contact us:

• Email: privacy@velo-ride.com
• Phone: +233 30 123 4567
• Address: VELO Technologies Ltd., Accra, Ghana
• Website: www.velo-ride.com

Effective Date: July 30, 2026`,
  },
];

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <Ionicons name="shield-checkmark" size={32} color="#FFD000" />
          <Text style={styles.introTitle}>Your Privacy Matters</Text>
          <Text style={styles.introBody}>
            VELO is committed to protecting your personal information. This policy explains what data we collect, how we use it, and your rights under Ghanaian law.
          </Text>
        </View>

        {SECTIONS.map((section, index) => (
          <View key={index} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <View style={{ height: insets.bottom + 24 }} />
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#09090B',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1F',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1C1C1F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2D',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  introCard: {
    backgroundColor: '#131316',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 4,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  introBody: {
    fontSize: 14,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionCard: {
    backgroundColor: '#131316',
    borderRadius: 16,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD000',
  },
  sectionBody: {
    fontSize: 14,
    color: '#A1A1AA',
    lineHeight: 22,
  },
});
