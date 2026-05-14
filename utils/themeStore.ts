import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark';

const STORAGE_KEY = 'app.theme-preference.v1';

type ThemeState = {
  /** Active theme. Defaults to 'light' so first paint never flashes dark. */
  preference: ThemePreference;
  /** Becomes true once the persisted value has been read from AsyncStorage. */
  hydrated: boolean;
  setPreference: (next: ThemePreference) => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'light',
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        set({ preference: stored, hydrated: true });
        return;
      }
    } catch {
      // ignore — fall through to default
    }
    set({ hydrated: true });
  },
  setPreference: async (next) => {
    set({ preference: next });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // best-effort persistence; in-memory value still takes effect
    }
  },
}));
