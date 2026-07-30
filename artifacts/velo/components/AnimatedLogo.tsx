import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

const AnimatedSvgCircle = Animated.createAnimatedComponent(Circle);

// The VELO "V" mark, given some motion-graphics depth: a rotating gradient
// ring, a diagonal shine sweep, and a gentle 3D tilt — built from Animated +
// SVG rather than a rendered video/GIF, so it stays crisp at any size and
// needs no extra asset.
export default function AnimatedLogo({ size = 64 }: { size?: number }) {
  const rotate = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rotateLoop = Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 6000, useNativeDriver: true })
    );
    const tiltLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tilt, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    const shineLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shine, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    rotateLoop.start();
    tiltLoop.start();
    shineLoop.start();
    return () => {
      rotateLoop.stop();
      tiltLoop.stop();
      shineLoop.stop();
    };
  }, []);

  const ringRotate = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotateY = tilt.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '14deg'] });
  const rotateX = tilt.interpolate({ inputRange: [0, 1], outputRange: ['6deg', '-6deg'] });
  const shineX = shine.interpolate({ inputRange: [0, 1], outputRange: [-size, size] });

  const ringSize = size * 1.55;
  const markSize = size;

  return (
    <View style={[styles.wrap, { width: ringSize, height: ringSize }]}>
      <Animated.View style={[styles.ring, { width: ringSize, height: ringSize, transform: [{ rotate: ringRotate }] }]}>
        <Svg width={ringSize} height={ringSize}>
          <Defs>
            <SvgGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFD000" stopOpacity={0} />
              <Stop offset="50%" stopColor="#FFD000" stopOpacity={0.9} />
              <Stop offset="100%" stopColor="#FFD000" stopOpacity={0} />
            </SvgGradient>
          </Defs>
          <AnimatedSvgCircle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={ringSize / 2 - 3}
            stroke="url(#ring)"
            strokeWidth={2.5}
            fill="none"
            strokeDasharray={`${ringSize * 1.6} ${ringSize * 3.14}`}
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={{
          transform: [
            { perspective: 600 },
            { rotateY },
            { rotateX },
          ],
        }}
      >
        <LinearGradient
          colors={['#FFE45C', '#FFD000', '#D4AC00']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[
            styles.mark,
            { width: markSize, height: markSize, borderRadius: markSize * 0.3 },
          ]}
        >
          <Text style={[styles.markText, { fontSize: markSize * 0.5 }]}>V</Text>
          <Animated.View
            pointerEvents="none"
            style={[styles.shine, { width: markSize * 0.6, transform: [{ translateX: shineX }, { rotate: '20deg' }] }]}
          />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#FFD000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  markText: {
    fontWeight: '900',
    color: '#09090B',
  },
  shine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
