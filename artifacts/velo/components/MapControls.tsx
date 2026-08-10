import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Yandex-Pro-style map controls: a slim vertical stack on the right — zoom in,
// zoom out, and recenter — that fades in on a map tap and out after a few
// seconds, so it never competes with the map itself.
export default function MapControls({
  visible,
  top,
  onZoomIn,
  onZoomOut,
  onRecenter,
}: {
  visible: boolean;
  top: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
}) {
  const op = useRef(new Animated.Value(0)).current;
  const shift = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }),
      Animated.spring(shift, { toValue: visible ? 0 : 12, useNativeDriver: true, friction: 8, tension: 90 }),
    ]).start();
  }, [visible, op, shift]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.wrap, { top, opacity: op, transform: [{ translateX: shift }] }]}
    >
      {/* zoom pill: + over − */}
      <BlurishStack>
        <TouchableOpacity style={styles.btn} onPress={onZoomIn} activeOpacity={0.7}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Animated.View style={styles.sep} />
        <TouchableOpacity style={styles.btn} onPress={onZoomOut} activeOpacity={0.7}>
          <Ionicons name="remove" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </BlurishStack>

      {/* recenter */}
      <TouchableOpacity style={[styles.round]} onPress={onRecenter} activeOpacity={0.8}>
        <Ionicons name="locate" size={20} color="#FFD000" />
      </TouchableOpacity>
    </Animated.View>
  );
}

function BlurishStack({ children }: { children: React.ReactNode }) {
  return <Animated.View style={styles.pill}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 14, alignItems: 'center', gap: 12 },
  pill: {
    backgroundColor: 'rgba(18,18,20,0.92)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2A2A2D',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
  btn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  sep: { height: 1, backgroundColor: '#2A2A2D', marginHorizontal: 8 },
  round: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(18,18,20,0.92)',
    borderWidth: 1,
    borderColor: '#2A2A2D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
});
