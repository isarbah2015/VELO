import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useApp, type Role } from '@/context/AppContext';
import { callEmergency, EMERGENCY_NUMBER } from '@/services/safety';
import { NAV_ICONS, NAV_COLORS } from '@/services/navMarker';
import { riderTierProgress } from '@/services/riderTiers';
import { tierProgress } from '@/services/tiers';
import {
  LANGUAGES, getLanguage, setLanguage, languageLabel, type LanguageCode,
} from '@/services/settings';

interface MenuItem {
  id: string;
  label: string;
  sub: string;
  icon: string;
  iconColor?: string;
  chevron?: boolean;
  badge?: string;
}

// Built per-render so dynamic subtitles (e.g. the chosen language) stay live.
const buildMenuSections = (langLbl: string): { title: string; items: MenuItem[] }[] => [
  {
    title: 'Account',
    items: [
      { id: 'payment', label: 'Payment Methods', sub: 'MTN MoMo, Cards', icon: 'wallet-outline', chevron: true },
      { id: 'promo', label: 'Promo & Referral', sub: 'Invite friends, earn ₵10', icon: 'gift-outline', chevron: true, badge: 'NEW' },
      { id: 'history', label: 'Ride History', sub: 'All completed trips', icon: 'receipt-outline', chevron: true },
    ],
  },
  {
    title: 'Safety',
    items: [
      { id: 'sos', label: 'Emergency SOS', sub: 'Quick-dial 191', icon: 'alert-circle-outline', iconColor: '#EF4444', chevron: true },
      { id: 'track', label: 'Share Location', sub: 'Share your live trip', icon: 'location-outline', chevron: true },
      { id: 'contacts', label: 'Emergency Contacts', sub: 'Trusted people to reach', icon: 'people-outline', chevron: true },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { id: 'lang', label: 'Language', sub: langLbl, icon: 'language-outline', chevron: true },
      { id: 'notif', label: 'Notifications', sub: 'Rides, offers, alerts', icon: 'notifications-outline', chevron: true },
    ],
  },
  {
    title: 'Support & Legal',
    items: [
      { id: 'help', label: 'Help & FAQs', sub: 'Answers and contact us', icon: 'help-circle-outline', chevron: true },
      { id: 'privacy', label: 'Privacy Policy', sub: 'How we handle your data', icon: 'shield-outline', chevron: true },
      { id: 'terms', label: 'Terms of Service', sub: 'The rules of using VELO', icon: 'document-text-outline', chevron: true },
    ],
  },
];

const ROLE_LABEL: Record<Role, string> = { rider: 'Rider', driver: 'Driver' };

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, role, rides, driverStatus, walletBalance, logout, switchRole, navMarker, setNavMarker } = useApp();
  const router = useRouter();
  const [lang, setLang] = useState<LanguageCode>('en');

  useEffect(() => { getLanguage().then(setLang); }, []);
  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);
  const tabBarH = isWeb ? 84 : Math.max(insets.bottom, 8) + 66;

  const completedRides = rides.filter((r) => r.status === 'completed').length;
  const totalSpent = rides.reduce((sum, r) => (r.status === 'completed' ? sum + r.price : sum), 0);
  const isDriver = role === 'driver';

  const menuSections = buildMenuSections(languageLabel(lang));

  // Drivers get an extra "Driver" section with the verification flow.
  const sections = isDriver
    ? [
        {
          title: 'Driver',
          items: [
            { id: 'verify', label: 'Verification', sub: 'Ghana Card & motorcycle photos', icon: 'shield-checkmark-outline', iconColor: '#FFD000', chevron: true } as MenuItem,
          ],
        },
        ...menuSections,
      ]
    : menuSections;

  const chooseLanguage = () => {
    Alert.alert('Language', 'Choose your preferred language', [
      ...LANGUAGES.map((l) => ({
        text: l.label,
        onPress: () => { setLang(l.code); setLanguage(l.code).catch(() => {}); },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const shareLocation = async () => {
    const active = rides.find((r) => r.status === 'accepted' || r.status === 'in_progress');
    const msg = active
      ? `I'm on a VELO ride from ${active.from} to ${active.to}. Track my trip and check in on me.`
      : `I'm using VELO for my Okada rides in Ghana. I'll share my live trip with you next time I ride.`;
    try {
      await Share.share({ message: msg });
    } catch {
      /* user dismissed the share sheet — nothing to do */
    }
  };

  const handleMenuPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switch (id) {
      case 'payment': return router.push('/payment-methods');
      case 'history': return router.push(isDriver ? '/driver-history' : '/(tabs)/rides');
      case 'promo': return router.push('/referral');
      case 'verify': return router.push('/driver-verify');
      case 'track': return shareLocation();
      case 'contacts': return router.push('/emergency-contacts');
      case 'lang': return chooseLanguage();
      case 'notif': return router.push('/notification-settings');
      case 'help': return router.push('/faq');
      case 'privacy': return router.push('/privacy-policy');
      case 'terms': return router.push('/terms-of-service');
      case 'sos':
        return Alert.alert(
          'Emergency SOS',
          `Call Ghana emergency services (${EMERGENCY_NUMBER}) now?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: `Call ${EMERGENCY_NUMBER}`, style: 'destructive', onPress: callEmergency },
          ]
        );
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleSwitchRole = (next: Role) => {
    if (next === role) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate first so the tab set swaps on this same frame — then persist the
    // role in the background. switchRole also flips the role in context
    // optimistically, so nothing waits on the Firestore round-trip.
    router.replace(next === 'driver' ? '/(driver-tabs)' : '/(tabs)');
    switchRole(next).catch(() => {});
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarH + 16 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase() ?? 'R'}
              </Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={10} color="#000" />
            </View>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{user?.name ?? 'Rider'}</Text>
            <Text style={styles.userPhone} numberOfLines={1}>+233 {user?.phone ?? ''}</Text>
            <View style={styles.veloTag}>
              <Ionicons name="shield-checkmark" size={12} color="#FFD000" />
              <Text style={styles.veloTagText}>Verified {ROLE_LABEL[role]}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-profile')} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={20} color="#FFD000" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {isDriver ? (
            <>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{driverStatus?.ridesToday ?? 0}</Text>
                <Text style={styles.statLbl}>Rides Today</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{(driverStatus?.rating ?? 5).toFixed(1)}</Text>
                <Text style={styles.statLbl}>Rating</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#FFD000' }]}>₵{(driverStatus?.todayEarnings ?? 0).toFixed(0)}</Text>
                <Text style={styles.statLbl}>Earned</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{completedRides}</Text>
                <Text style={styles.statLbl}>Rides</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{(user?.rating ?? 5).toFixed(1)}</Text>
                <Text style={styles.statLbl}>Rating</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#FFD000' }]}>₵{totalSpent}</Text>
                <Text style={styles.statLbl}>Spent</Text>
              </View>
            </>
          )}
        </View>

        {/* Rider loyalty tier — climbs with completed trips, unlocks fare
            discounts. Riders only (drivers have their own tier ladder). */}
        {!isDriver && (() => {
          const rt = riderTierProgress(completedRides);
          return (
            <View style={styles.loyaltyCard}>
              <View style={styles.loyaltyHeader}>
                <Text style={styles.loyaltyTier}>{rt.current.emoji} {rt.current.label} member</Text>
                {rt.current.discountPct > 0 && (
                  <View style={styles.loyaltyBadge}>
                    <Text style={styles.loyaltyBadgeText}>{Math.round(rt.current.discountPct * 100)}% off fares</Text>
                  </View>
                )}
              </View>
              <Text style={styles.loyaltyPerk}>{rt.current.perk}</Text>
              {rt.next ? (
                <>
                  <View style={styles.loyaltyBarTrack}>
                    <View style={[styles.loyaltyBarFill, { width: `${Math.round(rt.progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.loyaltyNext}>
                    {rt.ridesToNext} more {rt.ridesToNext === 1 ? 'ride' : 'rides'} to {rt.next.emoji} {rt.next.label}
                  </Text>
                </>
              ) : (
                <Text style={styles.loyaltyNext}>You&apos;ve reached the top tier 🎉</Text>
              )}
            </View>
          );
        })()}

        {/* Driver tier — climbs Standard → Premium → Okada Bossu with lifetime
            rides + rating. Shows current tier and rides left to the next. */}
        {isDriver && (() => {
          const tp = tierProgress(driverStatus?.totalRides ?? 0, driverStatus?.rating ?? 5);
          const EMOJI: Record<string, string> = { standard: '🛵', premium: '⚡', bossu: '👑' };
          return (
            <View style={styles.loyaltyCard}>
              <View style={styles.loyaltyHeader}>
                <Text style={styles.loyaltyTier}>{EMOJI[tp.tier]} {tp.current.label} driver</Text>
                <View style={styles.loyaltyBadge}>
                  <Text style={styles.loyaltyBadgeText}>{driverStatus?.totalRides ?? 0} rides</Text>
                </View>
              </View>
              <Text style={styles.loyaltyPerk}>{tp.current.blurb}</Text>
              {tp.next ? (
                <>
                  <View style={styles.loyaltyBarTrack}>
                    <View style={[styles.loyaltyBarFill, { width: `${Math.round(tp.ridesProgress * 100)}%` }]} />
                  </View>
                  <Text style={styles.loyaltyNext}>
                    {tp.ridesToNext > 0
                      ? `${tp.ridesToNext} more ${tp.ridesToNext === 1 ? 'ride' : 'rides'} to ${EMOJI[tp.next.tier]} ${tp.next.label}`
                      : `Keep a ${tp.next.minRating.toFixed(1)}★ rating to reach ${EMOJI[tp.next.tier]} ${tp.next.label}`}
                    {tp.ratingNeeded && tp.ridesToNext > 0 ? ` · needs ${tp.ratingNeeded.toFixed(1)}★` : ''}
                  </Text>
                </>
              ) : (
                <Text style={styles.loyaltyNext}>You&apos;ve reached the top tier 🎉</Text>
              )}
            </View>
          );
        })()}

        {/* Role switcher */}
        <View style={styles.roleSwitchCard}>
          <Text style={styles.roleSwitchTitle}>Account Mode</Text>
          <View style={styles.roleSwitchRow}>
            {(['rider', 'driver'] as Role[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleSwitchChip, role === r && styles.roleSwitchChipActive]}
                onPress={() => handleSwitchRole(r)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={r === 'rider' ? 'bicycle-outline' : 'briefcase-outline'}
                  size={16}
                  color={role === r ? '#000000' : '#A1A1AA'}
                />
                <Text style={[styles.roleSwitchText, role === r && styles.roleSwitchTextActive]}>{ROLE_LABEL[r]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Wallet Card */}
        <TouchableOpacity style={styles.walletCard} activeOpacity={0.85} onPress={() => router.push('/wallet')}>
          <View style={styles.walletLeft}>
            <Ionicons name="wallet" size={24} color="#FFD000" />
            <View>
              <Text style={styles.walletLabel}>VELO Wallet</Text>
              <Text style={styles.walletBalance}>₵ {walletBalance.toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.walletAddBtn}>
            <Ionicons name="add" size={18} color="#000" />
            <Text style={styles.walletAddText}>Top Up</Text>
          </View>
        </TouchableOpacity>

        {/* Navigation marker picker (drivers) */}
        {isDriver && (
          <View style={styles.navCard}>
            <Text style={styles.navTitle}>Navigation marker</Text>
            <Text style={styles.navSub}>Your icon on the live map</Text>

            <View style={styles.navIconRow}>
              {NAV_ICONS.map((ic) => {
                const active = navMarker.icon === ic.id;
                const Family = ic.family === 'mci' ? MaterialCommunityIcons : Ionicons;
                return (
                  <TouchableOpacity
                    key={ic.id}
                    style={[styles.navIconChip, active && { borderColor: navMarker.color, backgroundColor: 'rgba(255,255,255,0.05)' }]}
                    onPress={() => { Haptics.selectionAsync(); setNavMarker({ ...navMarker, icon: ic.id }); }}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.navIconPuck, { backgroundColor: active ? navMarker.color : '#1C1C1F' }]}>
                      <Family name={ic.name as any} size={22} color={active ? (navMarker.color === '#FFFFFF' || navMarker.color === '#FFD000' ? '#000' : '#FFF') : '#A1A1AA'} />
                    </View>
                    <Text style={[styles.navIconLabel, active && { color: '#FFFFFF' }]}>{ic.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.navColorRow}>
              {NAV_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.navSwatch, { backgroundColor: c }, navMarker.color === c && styles.navSwatchActive]}
                  onPress={() => { Haptics.selectionAsync(); setNavMarker({ ...navMarker, color: c }); }}
                  activeOpacity={0.85}
                >
                  {navMarker.color === c && <Ionicons name="checkmark" size={16} color={c === '#FFFFFF' || c === '#FFD000' ? '#000' : '#FFF'} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Menu Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, i) => (
                <View key={item.id}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleMenuPress(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuIconWrap, item.iconColor && { borderColor: item.iconColor + '30' }]}>
                      <Ionicons
                        name={item.icon as any}
                        size={20}
                        color={item.iconColor ?? '#A1A1AA'}
                      />
                    </View>
                    <View style={styles.menuItemText}>
                      <Text style={styles.menuItemLabel}>{item.label}</Text>
                      <Text style={styles.menuItemSub}>{item.sub}</Text>
                    </View>
                    {item.badge && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    )}
                    {item.chevron && (
                      <Ionicons name="chevron-forward" size={16} color="#3F3F46" />
                    )}
                  </TouchableOpacity>
                  {i < section.items.length - 1 && (
                    <View style={styles.menuDivider} />
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>VELO v1.0.0 · Made in Ghana 🇬🇭</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userCard: {
    marginHorizontal: 16,
    backgroundColor: '#1C1C1F',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 12,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFD000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000000',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1C1C1F',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userPhone: {
    fontSize: 13,
    color: '#71717A',
  },
  veloTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  veloTagText: {
    fontSize: 11,
    color: '#FFD000',
    fontWeight: '600',
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#252528',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    marginHorizontal: 16,
    backgroundColor: '#1C1C1F',
    borderRadius: 16,
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLbl: {
    fontSize: 11,
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#27272A',
    alignSelf: 'stretch',
  },
  navCard: {
    marginHorizontal: 16,
    backgroundColor: '#1C1C1F',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  navTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  navSub: { fontSize: 12, color: '#71717A', marginTop: 2, marginBottom: 14 },
  navIconRow: { flexDirection: 'row', gap: 10 },
  navIconChip: {
    flex: 1, alignItems: 'center', gap: 8, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#2A2A2D', backgroundColor: '#131316',
  },
  navIconPuck: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
  },
  navIconLabel: { fontSize: 12, fontWeight: '700', color: '#A1A1AA' },
  navColorRow: { flexDirection: 'row', gap: 12, marginTop: 16, justifyContent: 'center' },
  navSwatch: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  navSwatchActive: { borderColor: '#FFFFFF' },
  roleSwitchCard: {
    marginHorizontal: 16,
    backgroundColor: '#1C1C1F',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 10,
  },
  loyaltyCard: {
    marginHorizontal: 16,
    backgroundColor: '#1C1C1F',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2620',
    gap: 8,
  },
  loyaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loyaltyTier: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  loyaltyBadge: {
    backgroundColor: 'rgba(255,208,0,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  loyaltyBadgeText: { color: '#FFD000', fontSize: 12, fontWeight: '700' },
  loyaltyPerk: { color: '#A1A1AA', fontSize: 13, lineHeight: 18 },
  loyaltyBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#27272A',
    overflow: 'hidden',
    marginTop: 4,
  },
  loyaltyBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#FFD000' },
  loyaltyNext: { color: '#71717A', fontSize: 12 },
  roleSwitchTitle: {
    fontSize: 12,
    color: '#52525B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  roleSwitchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleSwitchChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#252528',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 12,
    paddingVertical: 12,
  },
  roleSwitchChipActive: {
    backgroundColor: '#FFD000',
    borderColor: '#FFD000',
  },
  roleSwitchText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A1A1AA',
  },
  roleSwitchTextActive: {
    color: '#000000',
  },
  walletCard: {
    marginHorizontal: 16,
    backgroundColor: '#1C1C1F',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFD00030',
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletLabel: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '500',
  },
  walletBalance: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  walletAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD000',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  walletAddText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  menuSection: {
    marginBottom: 16,
    paddingHorizontal: 16,
    gap: 8,
  },
  menuSectionTitle: {
    fontSize: 12,
    color: '#52525B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingLeft: 4,
  },
  menuCard: {
    backgroundColor: '#1C1C1F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#252528',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  menuItemText: {
    flex: 1,
    gap: 2,
  },
  menuItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  menuItemSub: {
    fontSize: 12,
    color: '#71717A',
  },
  badge: {
    backgroundColor: 'rgba(255,208,0,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD000',
    letterSpacing: 0.5,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#27272A',
    marginLeft: 64,
  },
  logoutBtn: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    marginBottom: 16,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#3F3F46',
    marginBottom: 8,
  },
});
