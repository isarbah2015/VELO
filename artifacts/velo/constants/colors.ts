/**
 * VELO – Design Tokens
 * Dark-first theme: deep black background, golden yellow primary accent.
 */

const VELO = {
  background: '#09090B',
  surface: '#131316',
  card: '#1C1C1F',
  cardBorder: '#2A2A2D',

  primary: '#FFD000',
  primaryDark: '#D4AC00',
  primaryForeground: '#000000',

  text: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#52525B',

  border: '#27272A',
  inputBg: '#1C1C1F',
  inputBorder: '#3F3F46',

  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',

  // Legacy aliases kept for useColors() compatibility
  tint: '#FFD000',
  foreground: '#FFFFFF',
  cardForeground: '#FFFFFF',
  secondary: '#1C1C1F',
  secondaryForeground: '#FFFFFF',
  muted: '#27272A',
  mutedForeground: '#71717A',
  accent: '#FFD000',
  accentForeground: '#000000',
  input: '#1C1C1F',
  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',
};

const colors = {
  light: VELO,
  dark: VELO,
  radius: 16,
};

export default colors;
