import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Rect, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

// Animated brand splash: the V-wing logo spins in 3D with a speed ramp
// (slow → fast → settle) over ~3.4s on a modern tech backdrop (grid, radar
// rings, a pulsing gold core glow and a sweeping scan line), then calls
// onDone so the app can proceed.
export default function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const ping = useRef(new Animated.Value(0)).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Two calm turns over 5s with a gentle ease-out settle — deliberately
    // slow so the reveal feels premium rather than a fast whirl.
    Animated.timing(spin, {
      toValue: 3,
      duration: 2400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    // Radar "ping": a ring that expands out from the core and fades — replaces
    // the old top-to-bottom scan line for a calmer, more premium motion.
    Animated.loop(
      Animated.timing(ping, { toValue: 1, duration: 2600, easing: Easing.out(Easing.ease), useNativeDriver: true })
    ).start();

    Animated.timing(wordmark, { toValue: 1, duration: 500, delay: 500, useNativeDriver: true }).start();

    const t = setTimeout(() => {
      Animated.timing(fadeOut, { toValue: 0, duration: 350, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onDone();
      });
    }, 2600);
    return () => clearTimeout(t);
  }, []);

  // 2 full turns (720°) instead of 3 — a noticeably slower, calmer spin.
  const rotateY = spin.interpolate({ inputRange: [0, 3], outputRange: ['0deg', '720deg'] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
  // Two staggered rings expanding + fading from the centre.
  const pingScale = ping.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1.6] });
  const pingOpacity = ping.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] });
  const ping2Scale = ping.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1.1] });
  const ping2Opacity = ping.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.4, 0.25, 0] });

  const glowSize = width * 1.1;
  const ringSize = width * 0.62;

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      {/* Tech backdrop */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Rect width={width} height={height} fill="#09090B" />
        {/* grid */}
        {Array.from({ length: Math.ceil(height / 44) }).map((_, i) => (
          <Line key={`h-${i}`} x1={0} y1={i * 44} x2={width} y2={i * 44} stroke="#16161C" strokeWidth={1} />
        ))}
        {Array.from({ length: Math.ceil(width / 44) }).map((_, i) => (
          <Line key={`v-${i}`} x1={i * 44} y1={0} x2={i * 44} y2={height} stroke="#16161C" strokeWidth={1} />
        ))}
        {/* radar rings */}
        <Defs>
          <RadialGradient id="core" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFD000" stopOpacity={0.4} />
            <Stop offset="60%" stopColor="#FFD000" stopOpacity={0.06} />
            <Stop offset="100%" stopColor="#FFD000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {[90, 150, 220, 300].map((r) => (
          <Circle key={r} cx={width / 2} cy={height / 2} r={r} stroke="#1E1E26" strokeWidth={1} fill="none" />
        ))}
      </Svg>

      {/* pulsing core glow */}
      <Animated.View
        style={[
          styles.glow,
          { width: glowSize, height: glowSize, opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      >
        <Svg width={glowSize} height={glowSize}>
          <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill="url(#core)" />
        </Svg>
      </Animated.View>

      {/* radar ping — expanding rings from the core */}
      <Animated.View
        style={[
          styles.ring,
          { width: ringSize, height: ringSize, borderRadius: ringSize / 2, opacity: pingOpacity, transform: [{ scale: pingScale }] },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          { width: ringSize, height: ringSize, borderRadius: ringSize / 2, opacity: ping2Opacity, transform: [{ scale: ping2Scale }] },
        ]}
      />

      {/* rotating 3D V logo */}
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
    zIndex: 1000,
  },
  glow: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255,208,0,0.6)',
  },
  center: {
    alignItems: 'center',
  },
  logo: {
    width: 168,
    height: 112,
  },
  brand: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 8,
  },
  tagline: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
    letterSpacing: 3,
  },
});
