// Driver-selectable navigation marker (the puck that follows them on the map).
// Motorbike ride app — two bike styles + a plain nav arrow (no bicycle).
export type NavIconId = 'moto' | 'moped' | 'nav';

export interface NavMarker {
  icon: NavIconId;
  color: string;
}

export const NAV_ICONS: {
  id: NavIconId;
  family: 'ionicons' | 'mci';
  name: string;
  label: string;
}[] = [
  { id: 'moto', family: 'mci', name: 'motorbike', label: 'Sport bike' },
  { id: 'moped', family: 'mci', name: 'moped', label: 'Moped' },
  { id: 'nav', family: 'ionicons', name: 'navigate', label: 'Arrow' },
];

export const NAV_COLORS = ['#FFD000', '#22C55E', '#4DA6FF', '#EF4444', '#B026FF', '#FFFFFF'];

export const DEFAULT_NAV_MARKER: NavMarker = { icon: 'moto', color: '#FFD000' };

export function navIcon(id: NavIconId) {
  return NAV_ICONS.find((n) => n.id === id) ?? NAV_ICONS[0];
}
