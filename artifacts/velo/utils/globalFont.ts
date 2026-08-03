import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';

// Map a fontWeight to the matching loaded font-family variant, so the whole app
// renders in one premium typeface without editing every StyleSheet. Text that
// sets an explicit fontFamily is left untouched.
const FAMILY: Record<string, string> = {
  '100': 'Inter_400Regular',
  '200': 'Inter_400Regular',
  '300': 'Inter_400Regular',
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  '800': 'Inter_700Bold',
  '900': 'Inter_700Bold',
};

function withFont(el: any) {
  if (!el || !el.props) return el;
  const flat = StyleSheet.flatten(el.props.style) || {};
  if (flat.fontFamily) return el; // respect explicit fontFamily (e.g. monospace)
  const w = String(flat.fontWeight ?? '400');
  const fam = FAMILY[w] ?? 'Inter_400Regular';
  return React.cloneElement(el, { style: [{ fontFamily: fam }, el.props.style] });
}

// Patch Text/TextInput once so every instance inherits the premium font while
// still honouring its own fontWeight and any explicit fontFamily override.
export function applyGlobalFont() {
  for (const Comp of [Text, TextInput] as any[]) {
    if (Comp.__veloFontPatched) continue;
    const orig = Comp.render;
    if (typeof orig !== 'function') continue;
    Comp.render = function patched(...args: any[]) {
      return withFont(orig.apply(this, args));
    };
    Comp.__veloFontPatched = true;
  }
}
