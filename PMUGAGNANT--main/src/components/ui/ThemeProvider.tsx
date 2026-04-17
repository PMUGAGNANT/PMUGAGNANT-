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
import { THEME_STORAGE_KEY, type PmuTheme } from "@/lib/theme-preference";

function applyThemeToDocument() {
  document.documentElement.dataset.theme = "warm";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, "warm");
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
  return "warm";
}

function getServerSnapshot(): PmuTheme {
  return "warm";
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
    applyThemeToDocument();
  }, [theme]);

  const setTheme = useCallback((next: PmuTheme) => {
    void next;
    applyThemeToDocument();
    emitChange();
  }, []);

  const toggleTheme = useCallback(() => {
    applyThemeToDocument();
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
