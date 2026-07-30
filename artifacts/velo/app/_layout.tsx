import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import AnimatedSplash from '@/components/AnimatedSplash';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider, useApp } from '@/context/AppContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Inner component that waits for auth initialization before rendering Stack
function AuthGate({ children }: { children: React.ReactNode }) {
  const { authInitialized } = useApp();

  // Don't render the navigation tree until Firebase has finished
  // checking the persisted auth state. This prevents the login screen
  // from flashing briefly on every app restart.
  if (!authInitialized) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FFD000" />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(driver-tabs)" />
      <Stack.Screen name="tracking" />
      <Stack.Screen name="wallet" />
      <Stack.Screen name="payment-methods" />
      <Stack.Screen name="add-payment" />
      <Stack.Screen name="payment-confirmation" />
      <Stack.Screen name="privacy-policy" options={{ presentation: 'modal' }} />
      <Stack.Screen name="terms-of-service" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <AppProvider>
              <ErrorBoundary>
                <AuthGate>
                  {!splashDone && <AnimatedSplash onComplete={() => setSplashDone(true)} />}
                  {splashDone && <RootLayoutNav />}
                </AuthGate>
              </ErrorBoundary>
            </AppProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
