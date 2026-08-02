import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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

type SlideBg = {
  image?: number;
  imageStyle?: object; // per-slide framing (scale/rotate/offset) for the hero image
  heroMode?: 'cover' | 'contain'; // 'cover' = full-bleed photo, 'contain' = whole product visible up top
  colors: readonly [string, string, ...string[]];
  glow: string;
};

const SLIDES: {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  features?: string[];
  bg: SlideBg;
}[] = [
  {
    id: '1',
    tag: 'Premium Rides',
    title: 'Ride Safe.\nRide Fast.',
    subtitle: "Ghana's #1 bike-hailing app. Get to your destination fast, safely, and affordably.",
    // Human hero photo, warmed with a subtle gold glow.
    bg: {
      image: require('@/assets/images/onboarding-hero.png'),
      colors: ['#09090B', '#0B0A06', '#09090B'],
      glow: 'rgba(255,208,0,0.20)',
    },
  },
  {
    id: '2',
    tag: 'Transparent',
    title: 'No Surprises.\nKnow Your Fare.',
    subtitle: 'See the full price before you ride. Base ₵5 + ₵2.50/km — no hidden fees, ever.',
    features: ['Base Fare ₵5.00', '₵2.50 per km', '₵0.50 per min'],
    // Standard bike — shown whole (front wheel + tyres visible) in the top area.
    bg: {
      image: require('@/assets/images/bike-standard.png'),
      heroMode: 'contain',
      // Zoom into the front quarter (front wheel + fairing).
      imageStyle: { transform: [{ scale: 1.9 }, { translateX: -width * 0.22 }] },
      colors: ['#0A1F2E', '#0A1424', '#09090B'],
      glow: 'rgba(255,208,0,0.22)',
    },
  },
  {
    id: '3',
    tag: 'Pay Your Way',
    title: 'Mobile Money\nAccepted.',
    subtitle: 'Pay with MTN MoMo, Vodafone Cash, AirtelTigo, card, or cash — your choice.',
    features: ['MTN MoMo', 'Vodafone Cash', 'AirtelTigo'],
    // Premium bike — shown whole in the top area (no crop), text sits below.
    bg: {
      image: require('@/assets/images/bike-premium.png'),
      heroMode: 'contain',
      // Zoom into the front quarter (front wheel + fairing).
      imageStyle: { transform: [{ scale: 1.9 }, { translateX: -width * 0.22 }] },
      colors: ['#0A2A1C', '#0A1A14', '#09090B'],
      glow: 'rgba(34,197,94,0.22)',
    },
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding } = useApp();
  const [currentIndex, setCurrentIndex] = useState(0);
  // Drives the crossfade between each slide's background.
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: currentIndex,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [currentIndex, progress]);

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      setCurrentIndex(currentIndex + 1); // drives both the slide + background crossfade
    } else {
      await completeOnboarding();
      // push (not replace) so the welcome flow stays in history and the signup
      // back button can return here.
      router.push('/(auth)/signup');
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
    router.replace('/(auth)/login');
  };

  const slide = SLIDES[currentIndex];
  const isContain = slide.bg.heroMode === 'contain';

  return (
    <View style={styles.container}>
      {/* Per-slide backdrop, crossfaded as you advance: the full-bleed photo for
          'cover' slides, or a coloured gradient for 'contain' product slides.
          (The contained product image itself sits in normal flow below, so it
          can never cover the text or the footer.) */}
      {SLIDES.map((item, i) => {
        const opacity = progress.interpolate({
          inputRange: [i - 1, i, i + 1],
          outputRange: [0, 1, 0],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            key={item.id}
            style={[StyleSheet.absoluteFill, { opacity }]}
            pointerEvents="none"
          >
            {item.bg.image && item.bg.heroMode !== 'contain' ? (
              <Image source={item.bg.image} style={styles.heroBg} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={item.bg.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            {/* Corner glow for depth */}
            <LinearGradient
              colors={[item.bg.glow, 'transparent']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0.15, y: 0.65 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        );
      })}
      {/* Shared bottom scrim so the text stays legible on every background. */}
      <LinearGradient
        colors={['rgba(9,9,11,0.5)', 'rgba(9,9,11,0.15)', 'rgba(9,9,11,0.75)', 'rgba(9,9,11,0.98)']}
        locations={[0, 0.4, 0.72, 0.92]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
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

      {/* Content column: the contained product image (if any) sits up top, and
          the text sits below it — both in normal flow, so nothing overlaps. */}
      <View style={styles.slide}>
        {/* Cropped bike hero, absolutely positioned in the top band so it never
            disturbs the flow of the text/footer below. The zoom shows only the
            front quarter; the screen edges do the cropping. */}
        {isContain && slide.bg.image && (
          <View style={styles.heroClip}>
            <Image
              source={slide.bg.image}
              style={[styles.heroImg, slide.bg.imageStyle]}
              resizeMode="contain"
            />
          </View>
        )}
        <View style={styles.textContent}>
          <View style={styles.tagPill}>
            <Text style={styles.tagText}>{slide.tag}</Text>
          </View>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
          {slide.features && (
            <View style={styles.featureList}>
              {slide.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <View style={styles.featureDot} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

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
  // Cropped hero: an ABSOLUTE clip box in the top band. Absolute keeps it out of
  // flow (the text/footer below lay out untouched); overflow:hidden confines the
  // zoomed image — including its opaque background — to this band so it can't
  // cover the text. The per-slide zoom shows only the front quarter of the bike.
  heroClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.46,
    overflow: 'hidden',
  },
  heroImg: {
    width: '100%',
    height: '100%',
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
