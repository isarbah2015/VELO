// Driver-selectable navigation marker — the puck that follows them on the map.
// Premium PNG markers (Yandex/Google style): a pro directional arrow plus two
// top-down motorbikes, rather than flat vector glyphs.
export type NavIconId = 'arrow' | 'sport' | 'okada';

export interface NavMarker {
  icon: NavIconId;
  color: string; // retained for back-compat; the PNGs carry their own colour
}

export const NAV_ICONS: {
  id: NavIconId;
  label: string;
  source: number; // require()'d PNG asset
}[] = [
  { id: 'arrow', label: 'Nav arrow', source: require('@/assets/images/nav-arrow.png') },
  { id: 'sport', label: 'Sport bike', source: require('@/assets/images/nav-bike-sport.png') },
  { id: 'okada', label: 'Okada', source: require('@/assets/images/nav-bike-okada.png') },
];

// Kept for back-compat with any importers; the marker picker no longer tints.
export const NAV_COLORS = ['#FFD000', '#22C55E', '#4DA6FF', '#EF4444', '#B026FF', '#FFFFFF'];

export const DEFAULT_NAV_MARKER: NavMarker = { icon: 'arrow', color: '#FFD000' };

export function navIcon(id: NavIconId) {
  return NAV_ICONS.find((n) => n.id === id) ?? NAV_ICONS[0];
}
