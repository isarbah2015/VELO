import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import VeloTabBar, { type TabDef } from '@/components/VeloTabBar';
import { useApp } from '@/context/AppContext';
import { useResponsive } from '@/hooks/useResponsive';

const TAB_DEFS: TabDef[] = [
  { name: 'index', label: 'Dashboard', icon: 'grid-outline', iconActive: 'grid' },
  { name: 'requests', label: 'Requests', icon: 'file-tray-outline', iconActive: 'file-tray-full' },
  { name: 'earnings', label: 'Earnings', icon: 'trending-up-outline', iconActive: 'trending-up' },
  { name: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

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
      tabBar={(props) => <VeloTabBar {...props} tabDefs={TAB_DEFS} />}
      // Force bottom — RN v7 moves the bar to the top on large screens (iPad).
      screenOptions={{ headerShown: false, tabBarPosition: 'bottom' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="requests" />
      <Tabs.Screen name="earnings" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

export default function DriverTabLayout() {
  const { role } = useApp();
  const { isTablet } = useResponsive();
  // Mirror of the rider guard — a rider must never land in the driver tabs.
  if (role !== 'driver') return <Redirect href="/(tabs)" />;
  // Native tabs only on phones; iPad uses the bottom VeloTabBar (iPadOS puts
  // native tab bars at the top).
  if (isLiquidGlassAvailable() && !isTablet) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
