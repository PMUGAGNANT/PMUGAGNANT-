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

function applyThemeToDocument(theme: PmuTheme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
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
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isPmuTheme(stored)) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  const fromDom = document.documentElement.dataset.theme;
  if (fromDom === "warm" || fromDom === "dark") {
    return fromDom;
  }
  return "dark";
}

function getServerSnapshot(): PmuTheme {
  return "dark";
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
    const next: PmuTheme = theme === "dark" ? "warm" : "dark";
    applyThemeToDocument(next);
    emitChange();
  }, [theme]);

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
