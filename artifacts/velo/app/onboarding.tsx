import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import AnimatedLogo from '@/components/AnimatedLogo';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    tag: 'Premium Rides',
    title: 'Ride Safe.\nRide Fast.',
    subtitle: "Ghana's #1 bike-hailing app. Get to your destination fast, safely, and affordably.",
  },
  {
    id: '2',
    tag: 'Transparent',
    title: 'No Surprises.\nKnow Your Fare.',
    subtitle: 'See the full price before you ride. Base ₵5 + ₵2.50/km — no hidden fees, ever.',
    features: ['Base Fare ₵5.00', '₵2.50 per km', '₵0.50 per min'],
  },
  {
    id: '3',
    tag: 'Pay Your Way',
    title: 'Mobile Money\nAccepted.',
    subtitle: 'Pay with MTN MoMo, Vodafone Cash, AirtelTigo, card, or cash — your choice.',
    features: ['MTN MoMo', 'Vodafone Cash', 'AirtelTigo'],
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    } else {
      await completeOnboarding();
      router.replace('/(auth)/signup');
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
    router.replace('/(auth)/login');
  };

  const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => (
    <View style={[styles.slide, { width }]}>
      <View style={styles.textContent}>
        <View style={styles.tagPill}>
          <Text style={styles.tagText}>{item.tag}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
        {item.features && (
          <View style={styles.featureList}>
            {item.features.map((f) => (
              <View key={f} style={styles.featureRow}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Full-screen atmospheric welcome background — anchored so the rider
          and motorbike stay in frame, with the text overlaid on a darker
          lower third. */}
      <Image
        source={require('@/assets/images/onboarding-hero.png')}
        style={styles.heroBg}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(9,9,11,0.5)', 'rgba(9,9,11,0.15)', 'rgba(9,9,11,0.75)', 'rgba(9,9,11,0.98)']}
        locations={[0, 0.4, 0.72, 0.92]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLogoRow}>
          <AnimatedLogo size={30} />
          <Text style={styles.logo}>VELO</Text>
        </View>
        <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides — text sits over the lower third of the photo */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.flatList}
      />

      {/* Bottom */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={styles.ctaButton} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.ctaText}>
            {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#000" />
        </TouchableOpacity>

        {currentIndex === SLIDES.length - 1 && (
          <TouchableOpacity onPress={handleSkip} style={styles.signInLink}>
            <Text style={styles.signInLinkText}>Already have an account? Sign In</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  heroBg: {
    position: 'absolute',
    bottom: 0,
    left: -width * 0.09,
    width: width * 1.18,
    height: height,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFD000',
    letterSpacing: 3,
  },
  skipText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  flatList: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  textContent: {
    paddingHorizontal: 28,
    gap: 12,
  },
  featureList: {
    gap: 10,
    alignItems: 'flex-start',
    marginTop: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD000',
  },
  featureText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tagPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,208,0,0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,208,0,0.3)',
  },
  tagText: {
    fontSize: 12,
    color: '#FFD000',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 46,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#D4D4D8',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 16,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#FFD000',
  },
  ctaButton: {
    backgroundColor: '#FFD000',
    borderRadius: 30,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  signInLink: {
    alignSelf: 'center',
  },
  signInLinkText: {
    fontSize: 14,
    color: '#D4D4D8',
  },
});
