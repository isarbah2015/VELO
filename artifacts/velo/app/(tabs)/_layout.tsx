import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import VeloTabBar, { type TabDef } from '@/components/VeloTabBar';
import { useApp } from '@/context/AppContext';
import { useResponsive } from '@/hooks/useResponsive';

const TAB_DEFS: TabDef[] = [
  { name: 'index', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'rides', label: 'Rides', icon: 'receipt-outline', iconActive: 'receipt' },
  { name: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="rides">
        <Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} />
        <Label>Rides</Label>
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
      tabBar={(props) => <VeloTabBar {...props} tabDefs={TAB_DEFS} />}
      // Force the bar to the bottom — RN v7 otherwise moves it to the top on
      // large screens (iPad), leaving our floating bar stranded up top.
      screenOptions={{ headerShown: false, tabBarPosition: 'bottom' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="rides" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

export default function TabLayout() {
  const { role } = useApp();
  const { isTablet } = useResponsive();
  // Role is the source of truth for which tab set shows. If a driver lands here
  // (e.g. the initial redirect fired before the profile role loaded), bounce to
  // the driver tabs.
  if (role === 'driver') return <Redirect href="/(driver-tabs)" />;
  // Native tabs only on phones. On iPad, iPadOS renders the native tab bar as
  // a pill at the TOP — off-brand and jarring here — so tablets use the
  // floating VeloTabBar pinned to the bottom instead.
  if (isLiquidGlassAvailable() && !isTablet) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
