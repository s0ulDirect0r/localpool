import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Driver, Mode, Passenger, Ride, Screen, User } from '../types';

type AppState = {
  user: User | null;
  mode: Mode;
  screen: Screen;
  activeRide: Ride | null;
  history: Ride[];
  loaded: boolean;
};

type AppContextValue = AppState & {
  signIn: (name: string, email: string, phone: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<void>;
  setMode: (m: Mode) => void;
  navigate: (s: Screen) => void;
  startRiderRequest: (ride: Omit<Ride, 'id' | 'createdAt' | 'role' | 'status'>) => void;
  selectDriver: (driver: Driver) => void;
  startDriverTrip: (
    pickup: Ride['pickup'],
    dropoff: Ride['dropoff'],
    seats: number,
  ) => void;
  acceptPassenger: (p: Passenger) => void;
  cancelRide: () => Promise<void>;
  completeRide: () => Promise<void>;
};

const STORAGE_KEYS = {
  user: 'localpool.user',
  history: 'localpool.history',
  mode: 'localpool.mode',
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setModeState] = useState<Mode>('rider');
  const [screen, setScreen] = useState<Screen>('welcome');
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [history, setHistory] = useState<Ride[]>([]);
  const [loaded, setLoaded] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load persisted state once
  useEffect(() => {
    (async () => {
      try {
        const [u, h, m] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.user),
          AsyncStorage.getItem(STORAGE_KEYS.history),
          AsyncStorage.getItem(STORAGE_KEYS.mode),
        ]);
        if (u) {
          const parsed: User = JSON.parse(u);
          setUser(parsed);
          setScreen('home');
        }
        if (h) setHistory(JSON.parse(h));
        if (m === 'rider' || m === 'driver') setModeState(m);
      } catch {
        // ignore
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persistUser = useCallback(async (u: User | null) => {
    if (u) await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(u));
    else await AsyncStorage.removeItem(STORAGE_KEYS.user);
  }, []);

  const persistHistory = useCallback(async (h: Ride[]) => {
    await AsyncStorage.setItem(STORAGE_KEYS.history, JSON.stringify(h));
  }, []);

  const signIn = useCallback(
    async (name: string, email: string, phone: string) => {
      const u: User = {
        id: `usr_${Date.now()}`,
        name: name.trim() || 'New User',
        email: email.trim(),
        phone: phone.trim(),
      };
      setUser(u);
      await persistUser(u);
      setScreen('home');
    },
    [persistUser],
  );

  const signOut = useCallback(async () => {
    setUser(null);
    setActiveRide(null);
    setScreen('welcome');
    await persistUser(null);
  }, [persistUser]);

  const updateProfile = useCallback(
    async (patch: Partial<User>) => {
      if (!user) return;
      const next = { ...user, ...patch };
      setUser(next);
      await persistUser(next);
    },
    [user, persistUser],
  );

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEYS.mode, m).catch(() => {});
  }, []);

  const navigate = useCallback((s: Screen) => setScreen(s), []);

  const startRiderRequest = useCallback(
    (r: Omit<Ride, 'id' | 'createdAt' | 'role' | 'status'>) => {
      const ride: Ride = {
        ...r,
        id: `ride_${Date.now()}`,
        createdAt: Date.now(),
        role: 'rider',
        status: 'searching',
      };
      setActiveRide(ride);
      setScreen('rider_matches');
    },
    [],
  );

  const selectDriver = useCallback(
    (driver: Driver) => {
      setActiveRide((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'driver_en_route',
          driver,
          fare: driver.fare,
          etaMinutes: driver.etaMinutes,
          progressPct: 0,
        };
      });
      setScreen('active_ride');
    },
    [],
  );

  const startDriverTrip = useCallback(
    (pickup: Ride['pickup'], dropoff: Ride['dropoff'], seats: number) => {
      const ride: Ride = {
        id: `ride_${Date.now()}`,
        createdAt: Date.now(),
        role: 'driver',
        status: 'driver_en_route',
        pickup,
        dropoff,
        seats,
        fare: 0,
        passengers: [],
        etaMinutes: 12,
        progressPct: 0,
      };
      setActiveRide(ride);
      setScreen('driver_requests');
    },
    [],
  );

  const acceptPassenger = useCallback((p: Passenger) => {
    setActiveRide((prev) => {
      if (!prev) return prev;
      const passengers = [...(prev.passengers ?? []), p];
      const fare = +passengers.reduce((s, x) => s + x.fare, 0).toFixed(2);
      return { ...prev, passengers, fare };
    });
  }, []);

  const cancelRide = useCallback(async () => {
    if (!activeRide) return;
    const cancelled: Ride = { ...activeRide, status: 'cancelled' };
    const next = [cancelled, ...history];
    setHistory(next);
    await persistHistory(next);
    setActiveRide(null);
    setScreen('home');
  }, [activeRide, history, persistHistory]);

  const completeRide = useCallback(async () => {
    if (!activeRide) return;
    const completed: Ride = {
      ...activeRide,
      status: 'completed',
      progressPct: 100,
    };
    const next = [completed, ...history];
    setHistory(next);
    await persistHistory(next);
    setActiveRide(null);
    setScreen('home');
  }, [activeRide, history, persistHistory]);

  // Simulated ride progress: tick every 2s while ride is en route or in progress
  useEffect(() => {
    if (!activeRide) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    if (
      activeRide.status !== 'driver_en_route' &&
      activeRide.status !== 'in_progress'
    ) {
      return;
    }
    tickRef.current = setInterval(() => {
      setActiveRide((prev) => {
        if (!prev) return prev;
        if (prev.status === 'driver_en_route') {
          const nextEta = Math.max(0, (prev.etaMinutes ?? 0) - 1);
          if (nextEta === 0) {
            return { ...prev, etaMinutes: 0, status: 'in_progress', progressPct: 0 };
          }
          return { ...prev, etaMinutes: nextEta };
        }
        if (prev.status === 'in_progress') {
          const next = Math.min(100, (prev.progressPct ?? 0) + 10);
          return { ...prev, progressPct: next };
        }
        return prev;
      });
    }, 2000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [activeRide?.id, activeRide?.status]);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      mode,
      screen,
      activeRide,
      history,
      loaded,
      signIn,
      signOut,
      updateProfile,
      setMode,
      navigate,
      startRiderRequest,
      selectDriver,
      startDriverTrip,
      acceptPassenger,
      cancelRide,
      completeRide,
    }),
    [
      user,
      mode,
      screen,
      activeRide,
      history,
      loaded,
      signIn,
      signOut,
      updateProfile,
      setMode,
      navigate,
      startRiderRequest,
      selectDriver,
      startDriverTrip,
      acceptPassenger,
      cancelRide,
      completeRide,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
