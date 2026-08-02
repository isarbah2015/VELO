import AsyncStorage from '@react-native-async-storage/async-storage';

// Lightweight on-device preferences — no server round-trip needed. These are
// per-install settings (language, notification toggles, emergency contacts)
// that the Profile screens read and write.

const LANG_KEY = 'velo_language';
const NOTIF_KEY = 'velo_notif_prefs';
const CONTACTS_KEY = 'velo_emergency_contacts';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tw', label: 'Twi' },
  { code: 'ga', label: 'Ga' },
  { code: 'ee', label: 'Ewe' },
  { code: 'fr', label: 'French' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export async function getLanguage(): Promise<LanguageCode> {
  const v = (await AsyncStorage.getItem(LANG_KEY)) as LanguageCode | null;
  return v ?? 'en';
}

export async function setLanguage(code: LanguageCode) {
  await AsyncStorage.setItem(LANG_KEY, code);
}

export function languageLabel(code: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? 'English';
}

export interface NotifPrefs {
  rideUpdates: boolean;
  promotions: boolean;
  driverAlerts: boolean;
  safety: boolean;
}

const DEFAULT_NOTIF: NotifPrefs = { rideUpdates: true, promotions: true, driverAlerts: true, safety: true };

export async function getNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_KEY);
    return raw ? { ...DEFAULT_NOTIF, ...JSON.parse(raw) } : DEFAULT_NOTIF;
  } catch {
    return DEFAULT_NOTIF;
  }
}

export async function setNotifPrefs(prefs: NotifPrefs) {
  await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

export async function getEmergencyContacts(): Promise<EmergencyContact[]> {
  try {
    const raw = await AsyncStorage.getItem(CONTACTS_KEY);
    return raw ? (JSON.parse(raw) as EmergencyContact[]) : [];
  } catch {
    return [];
  }
}

export async function saveEmergencyContacts(contacts: EmergencyContact[]) {
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}
