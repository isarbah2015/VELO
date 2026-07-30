import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

const C = {
  muted: '#52525B',
};

const TAB_DEFS = [
  { name: 'index', label: 'Dashboard', icon: 'grid-outline' as const, iconActive: 'grid' as const },
  { name: 'requests', label: 'Requests', icon: 'file-tray-outline' as const, iconActive: 'file-tray-full' as const },
  { name: 'earnings', label: 'Earnings', icon: 'trending-up-outline' as const, iconActive: 'trending-up' as const },
  { name: 'profile', label: 'Profile', icon: 'person-outline' as const, iconActive: 'person' as const },
];

function VeloTabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const restingBottom = isWeb ? 18 : Math.max(insets.bottom, 8);

  const floatIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(floatIn, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 6 }).start();
  }, []);
  const translateY = floatIn.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View
      style={[
        styles.tabBarWrapper,
        { bottom: restingBottom, opacity: floatIn, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.tabBar}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const def = TAB_DEFS[index];
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
              style={[styles.tabItem, isFocused && styles.tabItemActive]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isFocused ? def.iconActive : def.icon}
                size={22}
                color={isFocused ? '#000000' : C.muted}
              />
              {isFocused && <Text style={styles.tabLabel}>{def.label}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="requests">
        <Icon sf={{ default: 'tray', selected: 'tray.full.fill' }} />
        <Label>Requests</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="earnings">
        <Icon sf={{ default: 'chart.line.uptrend.xyaxis', selected: 'chart.line.uptrend.xyaxis' }} />
        <Label>Earnings</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <VeloTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="requests" />
      <Tabs.Screen name="earnings" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

export default function DriverTabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1F',
    borderRadius: 36,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 28,
    borderWidth: 1,
    borderColor: '#2A2A2D',
  },
  tabItem: {
    flex: 1,
    height: 48,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
  },
  tabItemActive: {
    backgroundColor: '#FFD000',
    flex: 2,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
});
