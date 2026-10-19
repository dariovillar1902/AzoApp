import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_SOURCE_IDS } from "../benefits/sources";
import type { UserProfile } from "../benefits/eligibility";
import { STORE_IDS } from "../stores/registry";
import type { StoreId } from "../types";

export interface Settings extends UserProfile {
  audiences: string[];
  stores: StoreId[];
  /** Prefer fewer store visits over saving a few pesos. */
  fewerStops: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  sources: DEFAULT_SOURCE_IDS,
  audiences: [],
  stores: STORE_IDS,
  fewerStops: true,
};

const STORAGE_KEY = "azoapp.settings.v1";

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({ settings: DEFAULT_SETTINGS, update: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }))
      .catch(() => {});
  }, []);

  const update = (patch: Partial<Settings>) =>
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>;
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
