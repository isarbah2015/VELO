import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';

export default function IndexScreen() {
  const { isLoading, isOnboarded, isAuthenticated, role } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    // Auth wins: a returning, signed-in user goes straight to their app — they
    // never see the welcome/onboarding again, even on a fresh install where the
    // onboarding flag isn't set yet.
    if (isAuthenticated) {
      router.replace(role === 'driver' ? '/(driver-tabs)' : '/(tabs)');
    } else if (!isOnboarded) {
      router.replace('/onboarding');
    } else {
      router.replace('/(auth)/login');
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
