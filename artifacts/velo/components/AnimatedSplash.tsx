import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';

const { width, height } = Dimensions.get('window');

// Guarantees the branded splash animation plays exactly ONCE per app launch.
// React 19 + the React Compiler can mount this component more than once during
// bootstrap (font load, auth restore, dev double-invoke); without this the
// user saw the logo spin, black out, then spin again. On any later mount we
// skip straight to done instead of replaying.
let hasPlayed = false;

// One drifting aurora blob — a big blurred radial-gradient that slowly floats,
// giving the northern-lights wash behind the logo.
function AuroraBlob({ color, size, from, to, duration }: {
  color: string; size: number; from: { x: number; y: number }; to: { x: number; y: number }; duration: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, [duration, t]);
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] });
  const gid = useMemo(() => `aurora-${Math.random().toString(36).slice(2)}`, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', width: size, height: size, opacity: 0.55, transform: [{ translateX }, { translateY }] }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.85} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

// A single floating particle: rises slowly and twinkles, then loops from a new
// random column. Kept lightweight (transform + opacity, native-driven).
function Particle({ index }: { index: number }) {
  const rise = useRef(new Animated.Value(0)).current;
  const startX = useMemo(() => Math.random() * width, []);
  const drift = useMemo(() => (Math.random() - 0.5) * 60, []);
  const size = useMemo(() => 2 + Math.random() * 3, []);
  const dur = useMemo(() => 5000 + Math.random() * 4000, []);
  const delay = useMemo(() => Math.random() * 4000, []);
  useEffect(() => {
    Animated.loop(
      Animated.timing(rise, { toValue: 1, duration: dur, delay, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [rise, dur, delay]);
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [height + 20, -20] });
  const translateX = rise.interpolate({ inputRange: [0, 1], outputRange: [startX, startX + drift] });
  const opacity = rise.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.9, 0.7, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', width: size, height: size, borderRadius: size / 2,
        backgroundColor: index % 4 === 0 ? '#FFD000' : '#FFFFFF',
        transform: [{ translateX }, { translateY }], opacity,
      }}
    />
  );
}

// Animated brand splash: an aurora + particle field behind the V-wing logo,
// which spins up once with a speed ramp and settles. It HOLDS on the settled
// logo (no self-fade) until the parent unmounts it once the app is ready — so
// there's never a black gap or a second spin.
export default function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    // Already played this launch → don't replay; settle instantly and signal done.
    if (hasPlayed) {
      spin.setValue(3);
      wordmark.setValue(1);
      const t = setTimeout(() => onDoneRef.current(), 0);
      return () => clearTimeout(t);
    }
    hasPlayed = true;

    Animated.timing(spin, {
      toValue: 3, duration: 2400, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    Animated.timing(wordmark, { toValue: 1, duration: 500, delay: 500, useNativeDriver: true }).start();

    // Signal done once the spin has settled. We do NOT fade to black — the
    // parent keeps us mounted (aurora still drifting) until auth is ready,
    // then swaps to the app in one clean cut.
    const t = setTimeout(() => onDoneRef.current(), 2500);
    return () => clearTimeout(t);
  }, [spin, glow, wordmark]);

  const rotateY = spin.interpolate({ inputRange: [0, 3], outputRange: ['0deg', '720deg'] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] });
  const glowSize = width * 1.15;

  // Hide the native splash once this one has painted, so the native V logo
  // hands directly to the animated V — no blank frame between them.
  const hideNative = () => { SplashScreen.hideAsync().catch(() => {}); };

  return (
    <View style={styles.container} onLayout={hideNative}>
      {/* Base + aurora field */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Rect width={width} height={height} fill="#09090B" />
      </Svg>
      <AuroraBlob color="#FFD000" size={width * 1.2} from={{ x: -width * 0.35, y: -height * 0.15 }} to={{ x: -width * 0.1, y: height * 0.05 }} duration={6000} />
      <AuroraBlob color="#7C3AED" size={width * 1.1} from={{ x: width * 0.35, y: height * 0.05 }} to={{ x: width * 0.15, y: height * 0.25 }} duration={7200} />
      <AuroraBlob color="#22D3EE" size={width * 0.95} from={{ x: width * 0.05, y: height * 0.45 }} to={{ x: width * 0.3, y: height * 0.6 }} duration={8000} />

      {/* Particle field */}
      {Array.from({ length: 18 }).map((_, i) => <Particle key={i} index={i} />)}

      {/* pulsing gold core glow */}
      <Animated.View style={[styles.glow, { width: glowSize, height: glowSize, opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
        <Svg width={glowSize} height={glowSize}>
          <Defs>
            <RadialGradient id="core" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFD000" stopOpacity={0.35} />
              <Stop offset="60%" stopColor="#FFD000" stopOpacity={0.05} />
              <Stop offset="100%" stopColor="#FFD000" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#core)" />
        </Svg>
      </Animated.View>

      {/* rotating 3D V logo + wordmark */}
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ perspective: 900 }, { rotateY }] }}>
          <Image source={require('@/assets/images/logo-v.png')} style={styles.logo} resizeMode="contain" />
        </Animated.View>
        <Animated.View style={{ opacity: wordmark, marginTop: 22, alignItems: 'center' }}>
          <Text style={styles.brand}>VELO</Text>
          <Text style={styles.tagline}>RIDE SAFE · RIDE FAST</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1000,
  },
  glow: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
  logo: { width: 168, height: 112 },
  brand: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', letterSpacing: 8 },
  tagline: { marginTop: 6, fontSize: 11, fontWeight: '600', color: '#71717A', letterSpacing: 3 },
});
