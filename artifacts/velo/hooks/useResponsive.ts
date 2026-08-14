import { useWindowDimensions } from 'react-native';

// A tablet is anything whose SHORTER side is at least 600dp — covers iPad
// (768) and Android tablets while excluding large phones. Using the shorter
// side makes the result orientation-independent.
export const TABLET_BREAKPOINT = 600;

// Phone-first content (forms, bottom sheets, cards) shouldn't stretch edge to
// edge on a wide tablet — it looks broken. We cap it to this width and centre
// it, the way every well-behaved app does on iPad.
export const CONTENT_MAX_WIDTH = 560;

export interface Responsive {
  width: number;
  height: number;
  isTablet: boolean;
  isLandscape: boolean;
  // Width a centred content column should actually occupy.
  contentWidth: number;
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_BREAKPOINT;
  const isLandscape = width > height;
  const contentWidth = isTablet ? Math.min(width, CONTENT_MAX_WIDTH) : width;
  return { width, height, isTablet, isLandscape, contentWidth };
}
