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
  const scan = useRef(new Animated.Value(0)).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 3 full turns with an ease-in-out ramp = accelerate then settle.
    Animated.timing(spin, {
      toValue: 3,
      duration: 3000,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(scan, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.timing(wordmark, { toValue: 1, duration: 600, delay: 700, useNativeDriver: true }).start();

    const t = setTimeout(() => {
      Animated.timing(fadeOut, { toValue: 0, duration: 400, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onDone();
      });
    }, 3400);
    return () => clearTimeout(t);
  }, []);

  const rotateY = spin.interpolate({ inputRange: [0, 3], outputRange: ['0deg', '1080deg'] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
  const scanY = scan.interpolate({ inputRange: [0, 1], outputRange: [-height * 0.4, height * 0.4] });

  const glowSize = width * 1.1;

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

      {/* sweeping scan line */}
      <Animated.View style={[styles.scan, { transform: [{ translateY: scanY }] }]} />

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
  scan: {
    position: 'absolute',
    width: width * 0.9,
    height: 2,
    backgroundColor: 'rgba(255,208,0,0.25)',
    shadowColor: '#FFD000',
    shadowOpacity: 0.8,
    shadowRadius: 8,
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
