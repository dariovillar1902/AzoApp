import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_SOURCE_IDS } from "../benefits/sources";
import type { CapUsage, UserProfile } from "../benefits/eligibility";
import { STORE_IDS } from "../stores/registry";
import type { StoreId } from "../types";

export interface Settings extends UserProfile {
  audiences: string[];
  stores: StoreId[];
  /** Prefer fewer store visits over saving a few pesos. */
  fewerStops: boolean;
  /** ARS already used of each promo's monthly/weekly cap, keyed by capPeriodKey. */
  capUsage: CapUsage;
  /** Corrections to automatic matches, keyed by the normalized item text. */
  refinements: Record<string, Refinement>;
  /** Scheduled weekly notification ids per promo id. */
  promoReminders: Record<string, string[]>;
  /** Last position the user shared, to show nearby branches. */
  location: { lat: number; lon: number } | null;
  /** Stores that existed when settings were last saved, so chains added later start switched on. */
  knownStores: StoreId[];
}

export interface Refinement {
  excludedOfferIds?: string[];
  queryBySite?: Partial<Record<StoreId, string>>;
}

const DEFAULT_SETTINGS: Settings = {
  sources: DEFAULT_SOURCE_IDS,
  audiences: [],
  stores: STORE_IDS,
  fewerStops: true,
  capUsage: {},
  refinements: {},
  promoReminders: {},
  location: null,
  knownStores: STORE_IDS,
};

/** Stores before knownStores existed. */
const LEGACY_STORES: StoreId[] = STORE_IDS.filter((id) => id !== "mercadolibre");

function migrate(saved: Partial<Settings>): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...saved };
  const known = saved.knownStores ?? LEGACY_STORES;
  const added = STORE_IDS.filter((id) => !known.includes(id));
  return { ...merged, stores: [...merged.stores.filter((id) => STORE_IDS.includes(id)), ...added], knownStores: STORE_IDS };
}

const STORAGE_KEY = "azoapp.settings.v1";

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  /** Re-reads settings from storage (after restoring a backup). */
  reload: () => void;
}

const SettingsContext = createContext<SettingsContextValue>({ settings: DEFAULT_SETTINGS, update: () => {}, reload: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const reload = () => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setSettings(migrate(JSON.parse(raw))))
      .catch(() => {});
  };

  useEffect(reload, []);

  const update = (patch: Partial<Settings>) =>
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

  return <SettingsContext.Provider value={{ settings, update, reload }}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);

/** Like useState, but remembered across launches (best-effort). */
export function usePersistentState(key: string, initial: string): [string, (value: string) => void] {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((stored) => stored !== null && setValue(stored))
      .catch(() => {});
  }, [key]);
  const set = (next: string) => {
    setValue(next);
    AsyncStorage.setItem(key, next).catch(() => {});
  };
  return [value, set];
}

/** JSON value remembered across launches (best-effort). */
export function usePersistentJson<T>(key: string, initial: T): [T, (update: (prev: T) => T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((stored) => stored !== null && setValue(JSON.parse(stored)))
      .catch(() => {});
  }, [key]);
  const update = (fn: (prev: T) => T) =>
    setValue((prev) => {
      const next = fn(prev);
      AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
      return next;
    });
  return [value, update];
}
