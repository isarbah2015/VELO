import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';

export default function IndexScreen() {
  const { isLoading, isOnboarded, isAuthenticated, role } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isOnboarded) {
      router.replace('/onboarding');
    } else if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else {
      router.replace(role === 'driver' ? '/(driver-tabs)' : '/(tabs)');
    }
  }, [isLoading, isOnboarded, isAuthenticated, role]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#FFD000" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
