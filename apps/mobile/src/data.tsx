// App-wide state: server data (facilities, listings), this device's push token, watches and
// settings, and local favorites. Screens read it through useData().

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  deleteWatch,
  fetchFacilities,
  fetchListings,
  myWatches,
  quietEnabled,
  saveWatch,
  setQuiet,
  type Facility,
  type Listing,
  type Watch,
  type WatchInput,
} from './api';
import { ALL_EVENTS, isSimpleWatch } from './format';
import { registerForPush } from './push';

const FAVORITES_KEY = 'favorites';

type PushState = 'pending' | 'ready' | 'off';

interface Data {
  facilities: Facility[];
  facilityById: Map<string, Facility>;
  listingsByFacility: Map<string, Listing[]>;
  updatedAt: string | undefined;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;

  token: string | null;
  push: PushState;
  enablePush: () => Promise<void>;
  watches: Watch[];
  reloadWatches: () => Promise<void>;
  upsertWatch: (id: string | null, w: WatchInput) => Promise<void>;
  removeWatch: (id: string) => Promise<void>;
  simpleWatch: (facilityId: string) => Watch | undefined;
  toggleSimpleWatch: (facilityId: string) => Promise<void>;
  quiet: boolean;
  toggleQuiet: (value: boolean) => Promise<void>;

  favorites: Set<string>;
  toggleFavorite: (facilityId: string) => void;
}

const Ctx = createContext<Data | null>(null);

export function useData(): Data {
  const v = useContext(Ctx);
  if (!v) throw new Error('DataProvider missing');
  return v;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function DataProvider({ children }: { children: ReactNode }) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [push, setPush] = useState<PushState>('pending');
  const [watches, setWatches] = useState<Watch[]>([]);
  const [quiet, setQuietState] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const load = useCallback(
    () =>
      Promise.all([fetchFacilities(), fetchListings()])
        .then(([f, l]) => {
          setFacilities(f);
          setListings(l);
          setError(null);
        })
        .catch((e) => setError(message(e)))
        .finally(() => setLoading(false)),
    [],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  const reloadWatches = useCallback(async () => {
    if (!token) return;
    setWatches(await myWatches(token));
  }, [token]);

  const enablePush = useCallback(
    () =>
      registerForPush()
        .then(async (t) => {
          setToken(t);
          setPush(t ? 'ready' : 'off');
          if (!t) return;
          const [w, q] = await Promise.all([myWatches(t), quietEnabled(t)]);
          setWatches(w);
          setQuietState(q);
        })
        .catch((e) => {
          setPush('off');
          setError(`알림 등록 실패: ${message(e)}`);
        }),
    [],
  );

  useEffect(() => {
    load();
    enablePush();
    AsyncStorage.getItem(FAVORITES_KEY)
      .then((v) => v && setFavorites(new Set(JSON.parse(v) as string[])))
      .catch(() => {});
  }, [load, enablePush]);

  const upsertWatch = useCallback(
    async (id: string | null, w: WatchInput) => {
      if (!token) throw new Error('알림 권한이 필요합니다');
      await saveWatch(token, id, w);
      await reloadWatches();
    },
    [token, reloadWatches],
  );

  const removeWatch = useCallback(
    async (id: string) => {
      if (!token) return;
      await deleteWatch(token, id);
      setWatches((ws) => ws.filter((w) => w.id !== id));
    },
    [token],
  );

  const simpleWatch = useCallback(
    (facilityId: string) => watches.find((w) => isSimpleWatch(w, facilityId)),
    [watches],
  );

  const toggleSimpleWatch = useCallback(
    async (facilityId: string) => {
      const existing = simpleWatch(facilityId);
      if (existing) return removeWatch(existing.id);
      await upsertWatch(null, {
        facility_ids: [facilityId],
        court_ids: null,
        day_types: null,
        time_bands: null,
        events: ALL_EVENTS,
        enabled: true,
      });
    },
    [simpleWatch, removeWatch, upsertWatch],
  );

  const toggleQuiet = useCallback(
    async (value: boolean) => {
      if (!token) return;
      setQuietState(value);
      await setQuiet(token, value).catch(() => setQuietState(!value));
    },
    [token],
  );

  const toggleFavorite = useCallback((facilityId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (!next.delete(facilityId)) next.add(facilityId);
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<Data>(() => {
    const listingsByFacility = new Map<string, Listing[]>();
    for (const l of listings) {
      const arr = listingsByFacility.get(l.facility_id) ?? [];
      arr.push(l);
      listingsByFacility.set(l.facility_id, arr);
    }
    return {
      facilities,
      facilityById: new Map(facilities.map((f) => [f.id, f])),
      listingsByFacility,
      updatedAt: listings.reduce<string | undefined>((a, l) => (!a || l.updated_at > a ? l.updated_at : a), undefined),
      loading,
      error,
      reload,
      token,
      push,
      enablePush,
      watches,
      reloadWatches,
      upsertWatch,
      removeWatch,
      simpleWatch,
      toggleSimpleWatch,
      quiet,
      toggleQuiet,
      favorites,
      toggleFavorite,
    };
  }, [
    facilities, listings, loading, error, reload, token, push, enablePush, watches, reloadWatches,
    upsertWatch, removeWatch, simpleWatch, toggleSimpleWatch, quiet, toggleQuiet, favorites, toggleFavorite,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
