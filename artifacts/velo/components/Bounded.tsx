import React from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import { CONTENT_MAX_WIDTH } from '@/hooks/useResponsive';

// Centres its children in a max-width column on tablets, full-width on phones.
// Wrap phone-first content (forms, sheet bodies, card lists) so it doesn't
// stretch across a wide iPad. On phones it's a no-op passthrough.
export default function Bounded({
  children,
  style,
  maxWidth = CONTENT_MAX_WIDTH,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
}) {
  return (
    <View style={[{ width: '100%', maxWidth, alignSelf: 'center' }, style]}>
      {children}
    </View>
  );
}
