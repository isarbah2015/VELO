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
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider, useApp } from '@/context/AppContext';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Single splash bridge: show the animated splash until BOTH the branded
// animation has finished AND Firebase has restored the auth state, then hand
// off directly to the navigator. One continuous splash — no spinner flash or
// second logo in between (the native splash simply hands over to this one).
function Bootstrap() {
  const { authInitialized } = useApp();
  const [animDone, setAnimDone] = useState(false);
  const ready = authInitialized && animDone;

  return (
    <>
      {!ready && <AnimatedSplash onDone={() => setAnimDone(true)} />}
      {ready && <RootLayoutNav />}
    </>
  );
}

function RootLayoutNav() {
  const router = useRouter();

  // Tapping a push notification deep-links to the relevant screen. Ride
  // pushes carry { rideId, type } — riders land on live tracking, a driver's
  // new-request push opens their dashboard.
  useEffect(() => {
    const route = (data?: { type?: string; rideId?: string }) => {
      if (!data) return;
      if (data.type === 'request') {
        router.push('/(driver-tabs)');
      } else if (data.type === 'expired') {
        // No trip to track — send the rider home to rebook.
        router.push('/(tabs)');
      } else if (data.rideId) {
        router.push({ pathname: '/tracking', params: { rideId: data.rideId } });
      }
    };

    // Warm case: a tap while the app is already running.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      route(response.notification.request.content.data as { type?: string; rideId?: string });
    });

    // Cold-start case: the app was killed and launched *by* tapping the
    // notification. That response isn't delivered to the listener above — it's
    // only available here, so without this the deep-link is silently dropped.
    let cancelled = false;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (cancelled || !response) return;
      route(response.notification.request.content.data as { type?: string; rideId?: string });
    });

    return () => { cancelled = true; sub.remove(); };
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(driver-tabs)" />
      <Stack.Screen name="tracking" />
      <Stack.Screen name="driver-trip" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="receipt" />
      <Stack.Screen name="driver-verify" />
      <Stack.Screen name="referral" />
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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Note: the native splash is NOT hidden here on font-load — AnimatedSplash
  // hides it on its own first paint (onLayout) so the native V logo stays up
  // continuously until the animated V is on screen underneath it. One logo,
  // no blank frame, no second splash.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <AppProvider>
              <ErrorBoundary>
                <Bootstrap />
              </ErrorBoundary>
            </AppProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

