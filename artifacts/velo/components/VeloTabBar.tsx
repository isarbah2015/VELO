import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface TabDef {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}

const MUTED = '#52525B';

function TabIcon({ def, isFocused }: { def: TabDef; isFocused: boolean }) {
  const pop = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: isFocused ? 1 : 0, useNativeDriver: true, speed: 16, bounciness: 10 }).start();
  }, [isFocused]);

  return (
    <View style={styles.iconSlot}>
      <Animated.View
        style={[
          styles.iconBadge,
          { opacity: pop, transform: [{ scale: pop }] },
        ]}
      />
      <Ionicons
        name={isFocused ? def.iconActive : def.icon}
        size={20}
        color={isFocused ? '#000000' : MUTED}
        style={{ zIndex: 1 }}
      />
    </View>
  );
}

// Shared between rider and driver tab groups — equal-width tabs (icon +
// label always visible, active tab gets a spring-scaled gold badge behind
// its icon rather than the old asymmetric "expand + inline label" pill),
// plus a continuous slow hover float so the bar always reads as floating
// above the content, not just on first mount.
export default function VeloTabBar({
  state,
  navigation,
  tabDefs,
}: {
  state: any;
  navigation: any;
  tabDefs: TabDef[];
}) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const restingBottom = isWeb ? 18 : Math.max(insets.bottom, 8);

  const mountIn = useRef(new Animated.Value(0)).current;
  const hover = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(mountIn, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 6 }).start();

    const hoverLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(hover, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(hover, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    );
    const timer = setTimeout(() => hoverLoop.start(), 500);
    return () => {
      clearTimeout(timer);
      hoverLoop.stop();
    };
  }, []);

  const mountY = mountIn.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const hoverY = hover.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <Animated.View
      style={[
        styles.tabBarWrapper,
        { bottom: restingBottom, opacity: mountIn, transform: [{ translateY: Animated.add(mountY, hoverY) }] },
      ]}
    >
      <View style={styles.tabBar}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const def = tabDefs[index];
          if (!def) return null;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => {
                if (!isFocused) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate(route.name);
                }
              }}
              style={styles.tabItem}
              activeOpacity={0.75}
            >
              <TabIcon def={def} isFocused={isFocused} />
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]} numberOfLines={1}>
                {def.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'stretch',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(24,24,27,0.98)',
    borderRadius: 30,
    paddingHorizontal: 6,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 30,
    elevation: 30,
    borderWidth: 1,
    borderColor: '#2A2A2D',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 2,
  },
  iconSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD000',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
  },
  tabLabelActive: {
    color: '#FFD000',
    fontWeight: '800',
  },
});
