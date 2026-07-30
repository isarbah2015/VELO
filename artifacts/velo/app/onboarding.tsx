import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
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
    hasHero: true,
  },
  {
    id: '2',
    tag: 'Transparent',
    title: 'No Surprises.\nKnow Your Fare.',
    subtitle: 'See the full price before you ride. Base ₵5 + ₵2.50/km — no hidden fees, ever.',
    hasHero: false,
    icon: 'receipt-outline' as const,
    features: ['Base Fare ₵5.00', '₵2.50 per km', '₵0.50 per min'],
  },
  {
    id: '3',
    tag: 'Pay Your Way',
    title: 'Mobile Money\nAccepted.',
    subtitle: 'Pay with MTN MoMo, Vodafone Cash, AirtelTigo, card, or cash — your choice.',
    hasHero: false,
    icon: 'wallet-outline' as const,
    features: ['MTN MoMo', 'Vodafone Cash', 'AirtelTigo'],
  },
];

function BikeHero() {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const rotate = float.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '-1deg'] });
  const glowScale = float.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  const glowSize = width * 1.3;

  return (
    <View style={styles.bikeHeroWrap} pointerEvents="none">
      <Animated.View style={[styles.bikeGlow, { width: glowSize, height: glowSize, transform: [{ scale: glowScale }] }]}>
        <Svg width={glowSize} height={glowSize}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFD000" stopOpacity={0.35} />
              <Stop offset="55%" stopColor="#FFD000" stopOpacity={0.08} />
              <Stop offset="100%" stopColor="#FFD000" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#glow)" />
        </Svg>
      </Animated.View>

      <Animated.Image
        source={require('@/assets/images/bike-standard.png')}
        style={[styles.bikeHeroImage, { transform: [{ translateY }, { rotate }] }]}
        resizeMode="contain"
      />

      <View style={styles.bikeReflection} />
    </View>
  );
}

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
      {item.hasHero ? (
        <View style={styles.heroContainer}>
          <BikeHero />
          <LinearGradient
            colors={['transparent', '#09090B']}
            style={styles.heroGradient}
          />
        </View>
      ) : (
        <View style={styles.illustrationContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name={item.icon!} size={64} color="#FFD000" />
          </View>
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
      )}

      <View style={styles.textContent}>
        <View style={styles.tagPill}>
          <Text style={styles.tagText}>{item.tag}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLogoRow}>
          <AnimatedLogo size={30} />
          <Text style={styles.logo}>VELO</Text>
        </View>
        <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
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
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* CTA */}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
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
    color: '#71717A',
    fontWeight: '500',
  },
  flatList: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  heroContainer: {
    flex: 1,
    maxHeight: height * 0.6,
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  bikeHeroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bikeGlow: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bikeHeroImage: {
    width: width * 0.92,
    height: height * 0.42,
  },
  bikeReflection: {
    position: 'absolute',
    bottom: 36,
    width: width * 0.5,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#FFD000',
    opacity: 0.12,
    transform: [{ scaleX: 1.8 }],
  },
  illustrationContainer: {
    flex: 1,
    maxHeight: height * 0.45,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#1C1C1F',
    borderWidth: 1,
    borderColor: '#2A2A2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureList: {
    gap: 12,
    alignItems: 'flex-start',
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
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  textContent: {
    paddingHorizontal: 28,
    paddingTop: 28,
    gap: 12,
  },
  tagPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,208,0,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#FFD000',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 15,
    color: '#A1A1AA',
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
    backgroundColor: '#27272A',
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
    color: '#71717A',
  },
});
