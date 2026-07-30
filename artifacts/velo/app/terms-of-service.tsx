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
    title: '1. Acceptance of Terms',
    body: `By accessing or using the VELO mobile application and services (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of the terms, you may not access the Service.

These Terms apply to all visitors, users, riders, and drivers ("Users") who access or use the Service.`,
  },
  {
    title: '2. Description of Service',
    body: `VELO is a technology platform that connects riders seeking transportation with independent third-party drivers operating motorcycle taxis ("Okada") in Ghana. VELO does not provide transportation services directly — we are a marketplace connecting independent drivers with riders.

The Service includes:
• Real-time ride booking and matching
• In-app navigation and trip tracking
• Electronic payment processing (Mobile Money)
• Rating and feedback systems
• Safety features including SOS alerts and trip sharing`,
  },
  {
    title: '3. Eligibility',
    body: `To use VELO, you must:

• Be at least 18 years of age
• Possess a valid Ghanaian phone number
• Have the legal capacity to enter into binding contracts
• Not be barred from using the Service under applicable laws

For Drivers specifically:
• Hold a valid Ghanaian driver's license (Class A or equivalent)
• Possess a valid roadworthy certificate for your motorcycle
• Have valid third-party insurance coverage
• Pass our background verification process
• Wear an approved helmet at all times while operating on the platform`,
  },
  {
    title: '4. User Accounts',
    body: `When you create an account with us, you must provide accurate, complete, and current information at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account.

You are responsible for:
• Safeguarding the password and authentication credentials used to access the Service
• Notifying us immediately upon becoming aware of any breach of security
• Ensuring all activity under your account complies with these Terms

You may not use as a username the name of another person or entity that is not lawfully available for use, or a name or trademark that is subject to any rights of another person or entity without appropriate authorization.`,
  },
  {
    title: '5. Ride Booking & Fares',
    body: `Fares are calculated based on:
• Base fare (fixed starting amount)
• Distance traveled (per kilometer)
• Time taken (per minute during active trip)
• Dynamic pricing during high-demand periods (surge pricing)

All fares are displayed to the rider before confirming the booking. By confirming a ride, you agree to pay the displayed fare plus any applicable tolls or fees.

Payment Methods:
• MTN Mobile Money
• Vodafone Cash
• AirtelTigo Money
• VELO Wallet balance

Cancellation Policy:
• Free cancellation within 2 minutes of booking confirmation
• Cancellation fee of ₵5.00 applies after 2 minutes or if the driver has already arrived at the pickup location
• No-show fee of ₵10.00 applies if the rider is not at the pickup location within 5 minutes of the driver's arrival`,
  },
  {
    title: '6. Driver Terms',
    body: `As an independent contractor on the VELO platform, you agree to:

• Maintain your motorcycle in safe, roadworthy condition at all times
• Comply with all Ghana Road Traffic Regulations
• Wear an approved helmet and ensure your rider wears one too
• Display your VELO driver identification while online
• Not discriminate against riders based on race, religion, gender, disability, or any other protected characteristic
• Not transport more passengers than your motorcycle is legally designed to carry
• Not use the platform while under the influence of alcohol or drugs
• Report any accidents or incidents to VELO within 24 hours

VELO charges a commission of 15% on each completed trip fare. This commission is automatically deducted before payout.`,
  },
  {
    title: '7. Prohibited Conduct',
    body: `Users are prohibited from:

• Using the Service for any illegal purpose or in violation of any local, state, national, or international law
• Harassing, abusing, or harming another person, including VELO staff, drivers, or riders
• Impersonating another person or misrepresenting your affiliation with a person or entity
• Interfering with or disrupting the Service or servers or networks connected to the Service
• Attempting to decipher, decompile, disassemble, or reverse-engineer any of the software comprising the Service
• Using any robot, spider, scraper, or other automated means to access the Service
• Sharing your account credentials with any third party
• Soliciting or arranging rides outside the VELO platform (fare evasion)
• Carrying illegal goods, weapons, or hazardous materials during a VELO trip`,
  },
  {
    title: '8. Intellectual Property',
    body: `The Service and its original content, features, and functionality are and will remain the exclusive property of VELO Technologies Ltd. and its licensors. The Service is protected by copyright, trademark, and other laws of Ghana and foreign countries.

Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of VELO Technologies Ltd.`,
  },
  {
    title: '9. Termination',
    body: `We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.

Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service or contact us to request account deletion.

All provisions of the Terms which by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, indemnity, and limitations of liability.`,
  },
  {
    title: '10. Limitation of Liability',
    body: `In no event shall VELO Technologies Ltd., nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from:

• Your access to or use of or inability to access or use the Service
• Any conduct or content of any third party on the Service
• Any content obtained from the Service
• Unauthorized access, use, or alteration of your transmissions or content

VELO's total liability to you for all claims arising from or relating to these Terms or your use of the Service is limited to the amount you paid to VELO in the 12 months preceding the event giving rise to liability.`,
  },
  {
    title: '11. Governing Law',
    body: `These Terms shall be governed and construed in accordance with the laws of the Republic of Ghana, without regard to its conflict of law provisions.

Any dispute arising from these Terms shall first be attempted to be resolved through good-faith negotiation. If negotiation fails, the dispute shall be submitted to arbitration in Accra, Ghana, in accordance with the Arbitration Act, 1961 (Act 38).

You agree to submit to the personal jurisdiction of the courts located within Ghana for the purpose of litigating all such claims.`,
  },
  {
    title: '12. Changes to Terms',
    body: `We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.

By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms. If you do not agree to the new terms, please stop using the Service.`,
  },
  {
    title: '13. Contact Us',
    body: `If you have any questions about these Terms, please contact us:

• Email: legal@velo-ride.com
• Phone: +233 30 123 4567
• Address: VELO Technologies Ltd., Accra, Ghana
• Website: www.velo-ride.com

Last Updated: July 30, 2026`,
  },
];

export default function TermsOfServiceScreen() {
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
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <Ionicons name="document-text" size={32} color="#FFD000" />
          <Text style={styles.introTitle}>Terms & Conditions</Text>
          <Text style={styles.introBody}>
            Please read these terms carefully before using VELO. By using our service, you agree to be bound by these terms.
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
