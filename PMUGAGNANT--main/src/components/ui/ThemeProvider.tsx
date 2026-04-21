"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { isPmuTheme, THEME_STORAGE_KEY, type PmuTheme } from "@/lib/theme-preference";

const DEFAULT_THEME: PmuTheme = "warm";

function normalizeTheme(value: string | null): PmuTheme {
  if (value === "dark") return DEFAULT_THEME;
  return isPmuTheme(value) ? value : DEFAULT_THEME;
}

function applyThemeToDocument(theme: PmuTheme) {
  const normalized = normalizeTheme(theme);
  document.documentElement.dataset.theme = normalized;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }
}

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY || e.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function emitChange() {
  listeners.forEach((l) => l());
}

function getThemeFromStorage(): PmuTheme {
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

function getServerSnapshot(): PmuTheme {
  return DEFAULT_THEME;
}

type ThemeContextValue = {
  theme: PmuTheme;
  setTheme: (next: PmuTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getThemeFromStorage, getServerSnapshot);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setTheme = useCallback((next: PmuTheme) => {
    applyThemeToDocument(next);
    emitChange();
  }, []);

  const toggleTheme = useCallback(() => {
    applyThemeToDocument(getThemeFromStorage() === "cream" ? "warm" : "cream");
    emitChange();
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
