import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User as FirebaseUser } from 'firebase/auth';
import * as authService from '@/services/auth';
import * as rideService from '@/services/rides';
import * as paymentService from '@/services/payments';
import * as placeService from '@/services/places';
import * as driverService from '@/services/driver';
import type { DriverStatus } from '@/services/driver';
import { registerForPushNotifications } from '@/services/notifications';
import { geocode } from '@/services/geo';
import { type NavMarker, DEFAULT_NAV_MARKER } from '@/services/navMarker';

export type Role = 'rider' | 'driver';

export interface Ride {
  id: string;
  riderId: string;
  riderName: string;
  driverId: string | null;
  driverName: string | null;
  driverPhone?: string | null;
  riderPhone?: string | null;
  fromCoord?: { lat: number; lng: number } | null;
  toCoord?: { lat: number; lng: number } | null;
  // Rider's live position, streamed while the driver is en route to pickup.
  riderLoc?: { lat: number; lng: number; at: number } | null;
  from: string;
  to: string;
  type: 'Standard' | 'Premium' | 'Bossu';
  price: number;
  date: string;
  // requested → accepted (driver assigned) → arrived (at pickup) →
  // in_progress (trip underway) → completed; cancelled from any point.
  status: 'requested' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
  durationMin: number;
  driverRating: number;
  paymentMethod?: string;
  // The driver's verified bike, stamped on accept so the rider knows what to
  // look for (plate + make/model + colour).
  vehicle?: { plate: string; model: string; color: string } | null;
  // Live driver position, streamed to Firestore during an active trip.
  driverLoc?: { lat: number; lng: number; at: number } | null;
  // Rider's star rating of the completed trip (1–5).
  rating?: number;
  // ISO datetime when a ride is booked for later; absent for on-demand rides.
  scheduledFor?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'momo' | 'vodafone' | 'airtel' | 'card';
  name: string;
  number: string;
  isDefault: boolean;
}

export interface WalletTransaction {
  id: string;
  type: 'topup' | 'deduction';
  amount: number;
  description: string;
  date: string;
}

export interface User {
  uid: string;
  name: string;
  phone: string;
  referralCode?: string;
}

interface AppContextType {
  isLoading: boolean;
  authInitialized: boolean;
  isOnboarded: boolean;
  isAuthenticated: boolean;
  user: User | null;
  role: Role;
  rides: Ride[];
  paymentMethods: PaymentMethod[];
  walletBalance: number;
  walletTransactions: WalletTransaction[];
  driverStatus: DriverStatus | null;

  completeOnboarding: () => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  signup: (name: string, phone: string, password: string, role?: Role) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: Role) => Promise<void>;
  updateProfile: (name: string) => Promise<void>;

  requestRide: (input: { from: string; to: string; type: Ride['type']; price: number; scheduledFor?: string; paymentMethod?: string; promoCode?: string | null }) => Promise<string>;
  refreshRides: () => Promise<void>;
  cancelRide: (rideId: string) => Promise<void>;
  completeRide: (rideId: string, extra: { durationMin: number; paymentMethod?: string; rating?: number }) => Promise<void>;

  savedPlaces: placeService.SavedPlace[];
  addSavedPlace: (label: string, address: string) => Promise<void>;
  removeSavedPlace: (id: string) => Promise<void>;

  addPaymentMethod: (method: Omit<PaymentMethod, 'id'>) => Promise<void>;
  removePaymentMethod: (id: string) => Promise<void>;
  setDefaultPayment: (id: string) => Promise<void>;
  getDefaultPayment: () => PaymentMethod | null;
  topUpWallet: (amount: number, methodId: string) => Promise<void>;
  refreshWallet: () => Promise<void>;

  refreshDriverStatus: () => Promise<void>;
  setOnline: (online: boolean) => Promise<void>;

  navMarker: NavMarker;
  setNavMarker: (marker: NavMarker) => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

const ONBOARDING_KEY = 'velo_onboarded';
const LAST_USER_KEY = 'velo_last_user';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [onboardChecked, setOnboardChecked] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<{ name: string; phone: string; role: Role; walletBalance: number; referralCode?: string } | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [driverStatus, setDriverStatus] = useState<DriverStatus | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<placeService.SavedPlace[]>([]);
  const [navMarker, setNavMarkerState] = useState<NavMarker>(DEFAULT_NAV_MARKER);

  useEffect(() => {
    AsyncStorage.getItem('velo_nav_marker').then((v) => {
      if (v) { try { setNavMarkerState(JSON.parse(v)); } catch {} }
    });
  }, []);

  const setNavMarker = useCallback((m: NavMarker) => {
    setNavMarkerState(m);
    AsyncStorage.setItem('velo_nav_marker', JSON.stringify(m)).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => { if (v) setIsOnboarded(true); })
      .finally(() => setOnboardChecked(true));
  }, []);

  const loadUserData = useCallback(async (uid: string, role: Role) => {
    const [rideHistory, methods] = await Promise.all([
      rideService.getRideHistory(uid, 'rider'),
      paymentService.getPaymentMethods(uid),
    ]);
    setRides(rideHistory);
    setPaymentMethods(methods);
    paymentService.getTransactions(uid).then(setWalletTransactions);
    placeService.getPlaces(uid).then(setSavedPlaces).catch(() => setSavedPlaces([]));
    if (role === 'driver') {
      driverService.getDriverStatus(uid).then(setDriverStatus);
    }
  }, []);

  // AUTH INITIALIZATION FIX:
  // Firebase onAuthStateChanged fires once immediately (often with null),
  // then again when the persisted session is restored. We track
  // authInitialized so the UI knows "Firebase has finished checking"
  // and won't flash the login screen during the brief null window.
  useEffect(() => {
    let firstCallback = true;
    const unsubscribe = authService.onAuthChange(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        // Persist last user ID for instant restore on next cold start
        await AsyncStorage.setItem(LAST_USER_KEY, fbUser.uid);
        const p = await authService.getUserProfile(fbUser.uid);
        setProfile(p);
        if (p) await loadUserData(fbUser.uid, p.role);
        // Register for push in the background — never block sign-in on it.
        registerForPushNotifications(fbUser.uid);
      } else {
        await AsyncStorage.removeItem(LAST_USER_KEY);
        setProfile(null);
        setRides([]);
        setPaymentMethods([]);
        setWalletTransactions([]);
        setDriverStatus(null);
        setSavedPlaces([]);
      }
      // After the FIRST callback, auth is initialized — even if it's null
      if (firstCallback) {
        firstCallback = false;
        setAuthInitialized(true);
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, [loadUserData]);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    setIsOnboarded(true);
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    await authService.login(phone, password);
  }, []);

  const signup = useCallback(async (name: string, phone: string, password: string, role: Role = 'rider') => {
    await authService.register(name, phone, password, role);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
  }, []);

  // Edit-profile: persist the new name, then reflect it locally so the whole
  // app (profile header, chat, etc.) updates without a reload.
  const updateProfile = useCallback(async (name: string) => {
    if (!firebaseUser) return;
    await authService.updateUserName(firebaseUser.uid, name);
    setProfile((p) => (p ? { ...p, name: name.trim() } : p));
  }, [firebaseUser]);

  // OPTIMIZED: Instant role switch — update UI immediately, then sync in background
  const switchRole = useCallback(async (role: Role) => {
    if (!firebaseUser) return;
    setProfile((p) => (p ? { ...p, role } : p));
    try {
      await authService.setUserRole(firebaseUser.uid, role);
      if (role === 'driver') {
        const status = await driverService.getDriverStatus(firebaseUser.uid);
        setDriverStatus(status);
      } else {
        setDriverStatus(null);
      }
    } catch (err) {
      setProfile((p) => (p ? { ...p, role: p.role === 'driver' ? 'rider' : 'driver' } : p));
      throw err;
    }
  }, [firebaseUser]);

  const refreshRides = useCallback(async () => {
    if (!firebaseUser) return;
    setRides(await rideService.getRideHistory(firebaseUser.uid, 'rider'));
  }, [firebaseUser]);

  const requestRide = useCallback(async (input: { from: string; to: string; type: Ride['type']; price: number; scheduledFor?: string; paymentMethod?: string; promoCode?: string | null }) => {
    if (!firebaseUser || !profile) throw new Error('Not signed in');
    // Geocode the typed addresses so the driver's map shows the real pickup +
    // destination (falls back to null → default coords if lookup fails).
    const [fromLL, toLL] = await Promise.all([geocode(input.from), geocode(input.to)]);
    return rideService.createRide({
      ...input,
      riderId: firebaseUser.uid,
      riderName: profile.name,
      riderPhone: profile.phone,
      fromCoord: fromLL ? { lat: fromLL[1], lng: fromLL[0] } : null,
      toCoord: toLL ? { lat: toLL[1], lng: toLL[0] } : null,
    });
  }, [firebaseUser, profile]);

  const cancelRide = useCallback(async (rideId: string) => {
    await rideService.updateRideStatus(rideId, 'cancelled');
    await refreshRides();
  }, [refreshRides]);

  const completeRide = useCallback(async (rideId: string, extra: { durationMin: number; paymentMethod?: string; rating?: number }) => {
    await rideService.updateRideStatus(rideId, 'completed', extra);
    await refreshRides();
  }, [refreshRides]);

  const addPaymentMethod = useCallback(async (method: Omit<PaymentMethod, 'id'>) => {
    if (!firebaseUser) return;
    await paymentService.addPaymentMethod(firebaseUser.uid, method, paymentMethods);
    setPaymentMethods(await paymentService.getPaymentMethods(firebaseUser.uid));
  }, [firebaseUser, paymentMethods]);

  const removePaymentMethod = useCallback(async (id: string) => {
    if (!firebaseUser) return;
    await paymentService.removePaymentMethodDoc(firebaseUser.uid, id);
    setPaymentMethods((prev) => prev.filter((m) => m.id !== id));
  }, [firebaseUser]);

  const setDefaultPayment = useCallback(async (id: string) => {
    if (!firebaseUser) return;
    await paymentService.setDefaultPaymentMethod(firebaseUser.uid, paymentMethods, id);
    setPaymentMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })));
  }, [firebaseUser, paymentMethods]);

  const getDefaultPayment = useCallback((): PaymentMethod | null => {
    return paymentMethods.find((m) => m.isDefault) ?? paymentMethods[0] ?? null;
  }, [paymentMethods]);

  const addSavedPlace = useCallback(async (label: string, address: string) => {
    if (!firebaseUser) return;
    await placeService.addPlace(firebaseUser.uid, label, address);
    setSavedPlaces(await placeService.getPlaces(firebaseUser.uid));
  }, [firebaseUser]);

  const removeSavedPlace = useCallback(async (id: string) => {
    if (!firebaseUser) return;
    await placeService.removePlace(firebaseUser.uid, id);
    setSavedPlaces((prev) => prev.filter((p) => p.id !== id));
  }, [firebaseUser]);

  const topUpWallet = useCallback(async (amount: number, methodId: string) => {
    if (!firebaseUser) return;
    const method = paymentMethods.find((m) => m.id === methodId);
    await paymentService.topUpWallet(firebaseUser.uid, amount, `Top up via ${method?.name ?? 'Mobile Money'}`);
    const p = await authService.getUserProfile(firebaseUser.uid);
    setProfile(p);
    setWalletTransactions(await paymentService.getTransactions(firebaseUser.uid));
  }, [firebaseUser, paymentMethods]);

  // Re-reads wallet balance + transactions after a server-side credit
  // (e.g. a Paystack top-up that was applied by the Cloud Function).
  const refreshWallet = useCallback(async () => {
    if (!firebaseUser) return;
    setProfile(await authService.getUserProfile(firebaseUser.uid));
    setWalletTransactions(await paymentService.getTransactions(firebaseUser.uid));
  }, [firebaseUser]);

  const refreshDriverStatus = useCallback(async () => {
    if (!firebaseUser) return;
    setDriverStatus(await driverService.getDriverStatus(firebaseUser.uid));
  }, [firebaseUser]);

  const setOnline = useCallback(async (online: boolean) => {
    if (!firebaseUser) return;
    setDriverStatus((prev) => (prev ? { ...prev, online } : prev));
    try {
      await driverService.setOnlineStatus(firebaseUser.uid, online);
    } catch {
      setDriverStatus((prev) => (prev ? { ...prev, online: !online } : prev));
    }
  }, [firebaseUser]);

  const value = useMemo(() => ({
    // Stay "loading" until BOTH Firebase auth AND the persisted onboarding flag
    // have been checked — otherwise index.tsx can redirect an already-onboarded
    // user back to the welcome flow during the brief window before the flag load
    // resolves.
    isLoading: isLoading || !onboardChecked,
    authInitialized,
    isOnboarded,
    isAuthenticated: !!firebaseUser,
    user: profile && firebaseUser ? { uid: firebaseUser.uid, name: profile.name, phone: profile.phone, referralCode: profile.referralCode } : null,
    role: profile?.role ?? 'rider',
    rides,
    paymentMethods,
    walletBalance: profile?.walletBalance ?? 0,
    walletTransactions,
    driverStatus,
    completeOnboarding,
    login,
    signup,
    logout,
    switchRole,
    updateProfile,
    requestRide,
    refreshRides,
    cancelRide,
    completeRide,
    savedPlaces,
    addSavedPlace,
    removeSavedPlace,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPayment,
    getDefaultPayment,
    topUpWallet,
    refreshWallet,
    refreshDriverStatus,
    setOnline,
    navMarker,
    setNavMarker,
  }), [
    isLoading, onboardChecked, authInitialized, isOnboarded, firebaseUser, profile, rides, paymentMethods, walletTransactions, driverStatus,
    savedPlaces, addSavedPlace, removeSavedPlace,
    completeOnboarding, login, signup, logout, switchRole, updateProfile, requestRide, refreshRides, cancelRide, completeRide,
    addPaymentMethod, removePaymentMethod, setDefaultPayment, getDefaultPayment, topUpWallet, refreshWallet,
    refreshDriverStatus, setOnline, navMarker, setNavMarker,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
