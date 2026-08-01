import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { useGoogleSignIn, googleConfigured } from '@/services/googleAuth';

// Isolated so useGoogleSignIn() only runs when Google is configured for this
// platform — the expo-auth-session Google provider throws at render otherwise.
function GoogleAuthButton({ onError, onSuccess }: { onError: (m: string) => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const { promptAsync, ready } = useGoogleSignIn((err) => {
    setLoading(false);
    if (err) {
      onError(err.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    }
  });

  const handleGoogle = async () => {
    onError('');
    setLoading(true);
    try {
      const res = await promptAsync();
      if (res?.type !== 'success') setLoading(false); // dismissed → callback won't fire
    } catch {
      setLoading(false);
      onError('Could not open Google sign-in. Try again.');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.socialBtn, (loading || !ready) && { opacity: 0.6 }]}
      onPress={handleGoogle}
      disabled={loading || !ready}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          <Ionicons name="logo-google" size={20} color="#FFFFFF" />
          <Text style={styles.socialBtnText}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useApp();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!phone.trim() || phone.length < 9) {
      setError('Enter a valid phone number');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!password || password.length < 4) {
      setError('Enter your password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setIsLoading(true);
    try {
      await login(phone, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (e: any) {
      setError(
        ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(e?.code)
          ? 'Incorrect phone number or password'
          : 'Something went wrong — try again'
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoSection}>
            <Image
              source={require('@/assets/images/logo-v.png')}
              style={styles.logoMark}
              resizeMode="contain"
            />
            <Text style={styles.logoText}>VELO</Text>
            <Text style={styles.tagline}>Ride Safe. Ride Fast.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Welcome Back</Text>
            <Text style={styles.formSubtitle}>Sign in to continue riding</Text>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>🇬🇭 +233</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="24 000 0000"
                  placeholderTextColor="#52525B"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={12}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.inputFull, { paddingRight: 48 }]}
                  placeholder="Enter your password"
                  placeholderTextColor="#52525B"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#52525B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={styles.forgotLink}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign In + Create Account — 2x1 grid */}
            <View style={styles.ctaGrid}>
              <TouchableOpacity
                style={[styles.ctaBtn, isLoading && styles.ctaBtnDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.ctaBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctaBtnOutline}
                onPress={() => router.push('/(auth)/signup')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaBtnOutlineText}>Create Account</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social — only mounts the Google hook when configured for this
                platform, otherwise the provider throws at render. */}
            {googleConfigured() ? (
              <GoogleAuthButton onError={setError} onSuccess={() => router.replace('/')} />
            ) : (
              <View style={[styles.socialBtn, { opacity: 0.5 }]}>
                <Ionicons name="logo-google" size={20} color="#FFFFFF" />
                <Text style={styles.socialBtnText}>Google sign-in coming soon</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 32,
  },
  logoSection: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
  },
  logoMark: {
    width: 84,
    height: 56,
    marginBottom: 4,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFD000',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 13,
    color: '#71717A',
    letterSpacing: 0.5,
  },
  form: {
    gap: 16,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  formSubtitle: {
    fontSize: 14,
    color: '#71717A',
    marginTop: -8,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryCode: {
    backgroundColor: '#1C1C1F',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  countryCodeText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  input: {
    flex: 1,
    backgroundColor: '#1C1C1F',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#FFFFFF',
  },
  inputWrapper: {
    position: 'relative',
  },
  inputFull: {
    backgroundColor: '#1C1C1F',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#FFFFFF',
  },
  eyeBtn: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: -8,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    color: '#FFD000',
    fontWeight: '500',
  },
  ctaGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  ctaBtn: {
    flex: 1,
    backgroundColor: '#FFD000',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnDisabled: {
    opacity: 0.7,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  ctaBtnOutline: {
    flex: 1,
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#3F3F46',
    backgroundColor: '#1C1C1F',
  },
  ctaBtnOutlineText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#27272A',
  },
  dividerText: {
    fontSize: 13,
    color: '#52525B',
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1C1C1F',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 14,
    height: 54,
  },
  socialBtnText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#71717A',
  },
  footerLink: {
    fontSize: 14,
    color: '#FFD000',
    fontWeight: '600',
  },
});
