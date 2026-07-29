import React, { useState } from 'react';
import {
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
    // Simulate auth delay
    await new Promise((r) => setTimeout(r, 800));
    await login('VELO Rider', phone);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
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
            <View style={styles.logoMark}>
              <Text style={styles.logoV}>V</Text>
            </View>
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

            {/* CTA */}
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

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social */}
            <TouchableOpacity style={styles.socialBtn}>
              <Ionicons name="logo-google" size={20} color="#FFFFFF" />
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.footerLink}> Create Account</Text>
            </TouchableOpacity>
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
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFD000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoV: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000000',
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
  ctaBtn: {
    backgroundColor: '#FFD000',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaBtnDisabled: {
    opacity: 0.7,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
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
