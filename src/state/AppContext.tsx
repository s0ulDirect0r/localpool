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
import { ApiError, api } from '../api';
import type {
  Location,
  Mode,
  Screen,
  ScreenParams,
  ServerActiveDriver,
  ServerActiveRider,
  ServerHistoryItem,
  ServerSelfUser,
  ServerUser,
} from '../types';

type ActivePayload =
  | { kind: 'rider'; data: ServerActiveRider }
  | { kind: 'driver'; data: ServerActiveDriver }
  | null;

type AppState = {
  user: ServerSelfUser | null;
  token: string | null;
  mode: Mode;
  screen: Screen;
  screenParams: ScreenParams;
  active: ActivePayload;
  lastCompletedTripId: string | null;
  history: ServerHistoryItem[];
  loaded: boolean;
  error: string | null;
};

type AppContextValue = AppState & {
  signUp: (name: string, email: string, phone: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<ServerUser, 'vehicle' | 'seats' | 'name' | 'phone' | 'bio'>>) => Promise<void>;
  setMode: (m: Mode) => void;
  navigate: (s: Screen, params?: ScreenParams) => void;
  clearLastCompletedTrip: () => void;
  riderRequest: (pickup: Location, dropoff: Location, seats: number) => Promise<void>;
  riderJoin: (tripId: string) => Promise<void>;
  riderCancel: () => Promise<void>;
  driverTrip: (pickup: Location, dropoff: Location, seats: number) => Promise<void>;
  driverAccept: (requestId: string) => Promise<void>;
  driverStart: () => Promise<void>;
  driverComplete: () => Promise<void>;
  driverCancel: () => Promise<void>;
  refreshActive: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  clearError: () => void;
};

const STORAGE_KEYS = {
  token: 'localpool.token',
  user: 'localpool.user',
  mode: 'localpool.mode',
};

const AppContext = createContext<AppContextValue | null>(null);

const POLL_MS = 3000;

function readableError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'network_error') return 'Could not reach the server. Is it running?';
    return e.code.replace(/_/g, ' ');
  }
  return (e as Error)?.message ?? 'Something went wrong';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ServerSelfUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mode, setModeState] = useState<Mode>('rider');
  const [screen, setScreen] = useState<Screen>('welcome');
  const [screenParams, setScreenParams] = useState<ScreenParams>({});
  const [active, setActive] = useState<ActivePayload>(null);
  const [lastCompletedTripId, setLastCompletedTripId] = useState<string | null>(null);
  const [history, setHistory] = useState<ServerHistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const modeRef = useRef<Mode>('rider');

  tokenRef.current = token;
  modeRef.current = mode;

  const fetchActive = useCallback(async (t: string, m: Mode) => {
    try {
      if (m === 'rider') {
        const res = await api.riderActive(t);
        setActive((prev) => {
          const next = res.active ? { kind: 'rider' as const, data: res.active } : null;
          // Detect rider-side ride end: had an in_progress trip, now nothing.
          // Only auto-route to rating if the trip actually completed; if the
          // driver cancelled mid-ride, the rider's request is now `cancelled`
          // and they wouldn't be allowed to rate.
          if (
            !next &&
            prev?.kind === 'rider' &&
            prev.data.request.status === 'in_progress' &&
            prev.data.trip
          ) {
            const tripId = prev.data.trip.id;
            api
              .participants(t, tripId)
              .then((p) => {
                if (p.trip.status === 'completed') {
                  setLastCompletedTripId(tripId);
                  setScreen('rate_participants');
                  setScreenParams({ trip_id: tripId, back_to: 'home' });
                } else {
                  setScreen('home');
                }
              })
              .catch(() => {
                // Driver cancelled cascade revoked our participation — just
                // go home. Server will surface no error worth blocking on.
                setScreen('home');
              });
          }
          return next;
        });
      } else {
        const res = await api.driverActive(t);
        setActive(res.active ? { kind: 'driver', data: res.active } : null);
      }
    } catch {
      // swallow polling errors so the UI doesn't flap
    }
  }, []);

  const refreshActive = useCallback(async () => {
    if (!tokenRef.current) return;
    await fetchActive(tokenRef.current, modeRef.current);
  }, [fetchActive]);

  const refreshHistory = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const res = await api.history(tokenRef.current);
      setHistory(res.history);
    } catch (e) {
      setError(readableError(e));
    }
  }, []);

  // Load persisted state
  useEffect(() => {
    (async () => {
      try {
        const [t, u, m] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.token),
          AsyncStorage.getItem(STORAGE_KEYS.user),
          AsyncStorage.getItem(STORAGE_KEYS.mode),
        ]);
        if (m === 'rider' || m === 'driver') setModeState(m);
        if (t && u) {
          // Verify token by hitting /me
          try {
            const res = await api.me(t);
            setToken(t);
            setUser(res.user);
            setScreen('home');
            await fetchActive(t, m === 'driver' ? 'driver' : 'rider');
          } catch {
            await AsyncStorage.removeItem(STORAGE_KEYS.token);
            await AsyncStorage.removeItem(STORAGE_KEYS.user);
          }
        }
      } finally {
        setLoaded(true);
      }
    })();
  }, [fetchActive]);

  // Poll active ride while one exists
  useEffect(() => {
    if (!token || !active) return;
    const status = active.kind === 'rider' ? active.data.request.status : active.data.trip.status;
    if (status === 'completed' || status === 'cancelled') return;
    const i = setInterval(() => {
      fetchActive(token, modeRef.current).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(i);
  }, [token, active, fetchActive]);

  const persistAuth = useCallback(async (t: string | null, u: ServerUser | null) => {
    if (t && u) {
      await AsyncStorage.setItem(STORAGE_KEYS.token, t);
      await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(u));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.token);
      await AsyncStorage.removeItem(STORAGE_KEYS.user);
    }
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, phone: string, password: string) => {
      try {
        const res = await api.signup({ name, email, phone, password });
        setToken(res.token);
        setUser(res.user);
        await persistAuth(res.token, res.user);
        setScreen('home');
        setError(null);
      } catch (e) {
        setError(readableError(e));
        throw e;
      }
    },
    [persistAuth],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await api.signin({ email, password });
        setToken(res.token);
        setUser(res.user);
        await persistAuth(res.token, res.user);
        setScreen('home');
        setError(null);
        await fetchActive(res.token, modeRef.current);
      } catch (e) {
        setError(readableError(e));
        throw e;
      }
    },
    [persistAuth, fetchActive],
  );

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    setActive(null);
    setHistory([]);
    setScreen('welcome');
    await persistAuth(null, null);
  }, [persistAuth]);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<ServerUser, 'vehicle' | 'seats' | 'name' | 'phone' | 'bio'>>) => {
      if (!token) return;
      try {
        const res = await api.updateMe(token, patch);
        setUser(res.user);
        await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(res.user));
      } catch (e) {
        setError(readableError(e));
        throw e;
      }
    },
    [token],
  );

  const setMode = useCallback(
    (m: Mode) => {
      setModeState(m);
      AsyncStorage.setItem(STORAGE_KEYS.mode, m).catch(() => {});
      if (token) fetchActive(token, m).catch(() => {});
    },
    [token, fetchActive],
  );

  const navigate = useCallback((s: Screen, params?: ScreenParams) => {
    setScreen(s);
    setScreenParams(params ?? {});
  }, []);
  const clearLastCompletedTrip = useCallback(() => setLastCompletedTripId(null), []);

  const wrap = useCallback(
    async <T,>(fn: (t: string) => Promise<T>): Promise<T> => {
      if (!token) throw new ApiError(401, 'unauthorized');
      try {
        const result = await fn(token);
        await fetchActive(token, modeRef.current);
        return result;
      } catch (e) {
        setError(readableError(e));
        throw e;
      }
    },
    [token, fetchActive],
  );

  const riderRequest = useCallback(
    async (pickup: Location, dropoff: Location, seats: number) => {
      await wrap((t) => api.riderRequest(t, { pickup, dropoff, seats }));
      setScreen('rider_matches');
    },
    [wrap],
  );

  const riderJoin = useCallback(
    async (tripId: string) => {
      await wrap((t) => api.riderJoin(t, tripId));
      setScreen('active_ride');
    },
    [wrap],
  );

  const riderCancel = useCallback(async () => {
    await wrap((t) => api.riderCancel(t));
    setActive(null);
    setScreen('home');
    await refreshHistory();
  }, [wrap, refreshHistory]);

  const driverTrip = useCallback(
    async (pickup: Location, dropoff: Location, seats: number) => {
      await wrap((t) => api.driverTrip(t, { pickup, dropoff, seats }));
      setScreen('driver_requests');
    },
    [wrap],
  );

  const driverAccept = useCallback(
    async (requestId: string) => {
      await wrap((t) => api.driverAccept(t, requestId));
    },
    [wrap],
  );

  const driverStart = useCallback(async () => {
    await wrap((t) => api.driverStart(t));
    setScreen('active_ride');
  }, [wrap]);

  const driverComplete = useCallback(async () => {
    const tripId = active?.kind === 'driver' ? active.data.trip.id : null;
    await wrap((t) => api.driverComplete(t));
    setActive(null);
    if (tripId) {
      setLastCompletedTripId(tripId);
      setScreen('rate_participants');
      setScreenParams({ trip_id: tripId, back_to: 'home' });
    } else {
      setScreen('home');
    }
    await refreshHistory();
  }, [wrap, refreshHistory, active]);

  const driverCancel = useCallback(async () => {
    await wrap((t) => api.driverCancel(t));
    setActive(null);
    setScreen('home');
    await refreshHistory();
  }, [wrap, refreshHistory]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      token,
      mode,
      screen,
      screenParams,
      active,
      lastCompletedTripId,
      history,
      loaded,
      error,
      signUp,
      signIn,
      signOut,
      updateProfile,
      setMode,
      navigate,
      clearLastCompletedTrip,
      riderRequest,
      riderJoin,
      riderCancel,
      driverTrip,
      driverAccept,
      driverStart,
      driverComplete,
      driverCancel,
      refreshActive,
      refreshHistory,
      clearError,
    }),
    [
      user,
      token,
      mode,
      screen,
      screenParams,
      active,
      lastCompletedTripId,
      history,
      loaded,
      error,
      signUp,
      signIn,
      signOut,
      updateProfile,
      setMode,
      navigate,
      clearLastCompletedTrip,
      riderRequest,
      riderJoin,
      riderCancel,
      driverTrip,
      driverAccept,
      driverStart,
      driverComplete,
      driverCancel,
      refreshActive,
      refreshHistory,
      clearError,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
