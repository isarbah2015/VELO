import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { ensureGoogleProfile } from './auth';

// Required so the auth popup/redirect can hand control back to the app.
WebBrowser.maybeCompleteAuthSession();

// OAuth client IDs from the velo-ride-gh Google Cloud / Firebase project.
// Set these in an .env file (see .env.example). Web/Expo client id is what
// Expo Go uses; iOS/Android ids are for standalone dev/production builds.
const CLIENT_IDS = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};

// Platform-aware: expo-auth-session's Google provider REQUIRES the client id
// for the running platform (e.g. on iOS it throws at render if iosClientId is
// missing). So only report "configured" when the right id for this platform is
// present — callers must not mount useGoogleSignIn() unless this is true.
export function googleConfigured(): boolean {
  if (Platform.OS === 'ios') return Boolean(CLIENT_IDS.iosClientId);
  if (Platform.OS === 'android') return Boolean(CLIENT_IDS.androidClientId);
  return Boolean(CLIENT_IDS.webClientId);
}

/**
 * Hook that drives the Google OAuth flow (works in Expo Go via expo-auth-session)
 * and exchanges the returned Google ID token for a Firebase session. Calls
 * `onResult` once the flow settles. Trigger it with the returned `promptAsync`.
 */
export function useGoogleSignIn(onResult: (err?: Error) => void) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(CLIENT_IDS);

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.id_token;
      if (!idToken) {
        onResult(new Error('Google did not return an ID token. Try again.'));
        return;
      }
      const credential = GoogleAuthProvider.credential(idToken);
      signInWithCredential(auth, credential)
        .then((cred) => ensureGoogleProfile(cred.user))
        .then(() => onResult())
        .catch((e) => onResult(e instanceof Error ? e : new Error('Google sign-in failed')));
    } else if (response.type === 'error') {
      onResult(new Error(response.error?.message || 'Google sign-in failed'));
    }
    // 'dismiss' / 'cancel' → user backed out; stay silent.
  }, [response]); // eslint-disable-line react-hooks/exhaustive-deps

  return { promptAsync, ready: !!request };
}
