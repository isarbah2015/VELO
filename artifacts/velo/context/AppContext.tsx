import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Ride {
  id: string;
  from: string;
  to: string;
  type: 'Standard' | 'Premium' | 'Group';
  price: number;
  date: string;
  status: 'completed' | 'cancelled';
  durationMin: number;
  driverName: string;
  driverRating: number;
}

export interface User {
  name: string;
  phone: string;
}

interface AppContextType {
  isLoading: boolean;
  isOnboarded: boolean;
  isAuthenticated: boolean;
  user: User | null;
  rides: Ride[];
  completeOnboarding: () => Promise<void>;
  login: (name: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  addRide: (ride: Omit<Ride, 'id' | 'date'>) => Promise<void>;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

const SAMPLE_RIDES: Ride[] = [
  {
    id: 'r1',
    from: 'Accra Mall, East Legon',
    to: 'Osu Oxford Street',
    type: 'Standard',
    price: 42,
    date: new Date(Date.now() - 86400000).toISOString(),
    status: 'completed',
    durationMin: 18,
    driverName: 'Kwame A.',
    driverRating: 4.9,
  },
  {
    id: 'r2',
    from: 'Kotoka Airport',
    to: 'Cantonments Road',
    type: 'Premium',
    price: 65,
    date: new Date(Date.now() - 86400000 * 3).toISOString(),
    status: 'completed',
    durationMin: 25,
    driverName: 'Yaw B.',
    driverRating: 4.8,
  },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [onboarded, userData, ridesData] = await Promise.all([
          AsyncStorage.getItem('velo_onboarded'),
          AsyncStorage.getItem('velo_user'),
          AsyncStorage.getItem('velo_rides'),
        ]);
        setIsOnboarded(!!onboarded);
        if (userData) setUser(JSON.parse(userData));
        if (ridesData) {
          setRides(JSON.parse(ridesData));
        } else {
          setRides(SAMPLE_RIDES);
          await AsyncStorage.setItem('velo_rides', JSON.stringify(SAMPLE_RIDES));
        }
      } catch (_) {
        setRides(SAMPLE_RIDES);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem('velo_onboarded', '1');
    setIsOnboarded(true);
  }, []);

  const login = useCallback(async (name: string, phone: string) => {
    const u: User = { name, phone };
    await AsyncStorage.setItem('velo_user', JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem('velo_user');
    setUser(null);
  }, []);

  const addRide = useCallback(async (ride: Omit<Ride, 'id' | 'date'>) => {
    const newRide: Ride = {
      ...ride,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
      date: new Date().toISOString(),
    };
    const updated = [newRide, ...rides];
    setRides(updated);
    await AsyncStorage.setItem('velo_rides', JSON.stringify(updated));
  }, [rides]);

  return (
    <AppContext.Provider value={{
      isLoading,
      isOnboarded,
      isAuthenticated: !!user,
      user,
      rides,
      completeOnboarding,
      login,
      logout,
      addRide,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
