import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';

const { width, height } = Dimensions.get('window');

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
    <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, opacity: 0.5, transform: [{ translateX }, { translateY }] }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.8} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.16} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

// A long-exposure light trail: a thin streak whose brightness fades at both
// ends (like a car's light trail on a road), sweeping across the frame at an
// angle. Kept faded so the V logo always reads on top.
function LightTrail({ y, angle, color, thickness, duration, delay }: {
  y: number; angle: number; color: string; thickness: number; duration: number; delay: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(t, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
    ).start();
  }, [t, duration, delay]);
  const w = width * 1.5;
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [-w, width + w * 0.3] });
  const opacity = t.interpolate({ inputRange: [0, 0.12, 0.5, 0.88, 1], outputRange: [0, 0.42, 0.5, 0.42, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top: y, left: 0, width: w, height: thickness,
        opacity, transform: [{ translateX }, { rotate: `${angle}deg` }],
      }}
    >
      <LinearGradient
        colors={['transparent', color, '#FFFFFF', color, 'transparent']}
        locations={[0, 0.35, 0.5, 0.65, 1]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={{ flex: 1, borderRadius: thickness }}
      />
    </Animated.View>
  );
}

// A tiny drifting spark, for a little extra depth behind the trails.
function Particle({ index }: { index: number }) {
  const rise = useRef(new Animated.Value(0)).current;
  const startX = useMemo(() => Math.random() * width, []);
  const size = useMemo(() => 2 + Math.random() * 2.5, []);
  const dur = useMemo(() => 5000 + Math.random() * 4000, []);
  const delay = useMemo(() => Math.random() * 4000, []);
  useEffect(() => {
    Animated.loop(Animated.timing(rise, { toValue: 1, duration: dur, delay, easing: Easing.linear, useNativeDriver: true })).start();
  }, [rise, dur, delay]);
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [height + 20, -20] });
  const opacity = rise.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.7, 0.55, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: startX, width: size, height: size, borderRadius: size / 2,
        backgroundColor: index % 3 === 0 ? '#FFD000' : '#FFFFFF', transform: [{ translateY }], opacity,
      }}
    />
  );
}

const TRAILS: { y: number; angle: number; color: string; thickness: number; duration: number; delay: number }[] = [
  { y: height * 0.30, angle: -14, color: '#FFD000', thickness: 3, duration: 3200, delay: 0 },
  { y: height * 0.42, angle: -8, color: '#22D3EE', thickness: 2, duration: 3800, delay: 700 },
  { y: height * 0.55, angle: 10, color: '#FFFFFF', thickness: 2.5, duration: 3000, delay: 1400 },
  { y: height * 0.62, angle: 16, color: '#A78BFA', thickness: 2, duration: 4200, delay: 500 },
  { y: height * 0.70, angle: 6, color: '#FF6B6B', thickness: 2, duration: 3600, delay: 2100 },
  { y: height * 0.36, angle: -20, color: '#FFFFFF', thickness: 1.5, duration: 4600, delay: 1800 },
];

// Aurora + light-trail splash: the V-wing logo spins up once and settles over a
// field of faded long-exposure light trails. It HOLDS on the settled logo (no
// self-fade) and crossfades out over the already-mounted app when `dismiss`
// turns true — so there's no black gap, no replay, and no post-splash flash.
export default function AnimatedSplash({ onDone, dismiss, onHidden }: {
  onDone: () => void; dismiss?: boolean; onHidden?: () => void;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    Animated.timing(spin, { toValue: 3, duration: 2400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(wordmark, { toValue: 1, duration: 500, delay: 500, useNativeDriver: true }).start();

    const t = setTimeout(() => onDoneRef.current(), 2500);
    return () => clearTimeout(t);
  }, [spin, glow, wordmark]);

  // Crossfade out over the mounted app once the parent says we're ready. The
  // app is already painted underneath, so this is a smooth dissolve — never a
  // hard cut to a half-rendered screen.
  useEffect(() => {
    if (!dismiss) return;
    const a = Animated.timing(fade, { toValue: 0, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true });
    a.start(({ finished }) => { if (finished) onHidden?.(); });
    return () => a.stop();
  }, [dismiss, fade, onHidden]);

  const rotateY = spin.interpolate({ inputRange: [0, 3], outputRange: ['0deg', '720deg'] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.6] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] });
  const glowSize = width * 1.15;

  const hideNative = () => { SplashScreen.hideAsync().catch(() => {}); };

  return (
    <Animated.View style={[styles.container, { opacity: fade }]} onLayout={hideNative}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Rect width={width} height={height} fill="#09090B" />
      </Svg>

      {/* aurora wash */}
      <AuroraBlob color="#FFD000" size={width * 1.2} from={{ x: -width * 0.35, y: -height * 0.15 }} to={{ x: -width * 0.1, y: height * 0.05 }} duration={6000} />
      <AuroraBlob color="#7C3AED" size={width * 1.1} from={{ x: width * 0.35, y: height * 0.05 }} to={{ x: width * 0.15, y: height * 0.25 }} duration={7200} />
      <AuroraBlob color="#22D3EE" size={width * 0.95} from={{ x: width * 0.05, y: height * 0.5 }} to={{ x: width * 0.3, y: height * 0.65 }} duration={8000} />

      {/* long-exposure light trails */}
      {TRAILS.map((t, i) => <LightTrail key={i} {...t} />)}

      {/* subtle sparks */}
      {Array.from({ length: 10 }).map((_, i) => <Particle key={i} index={i} />)}

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
    </Animated.View>
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
