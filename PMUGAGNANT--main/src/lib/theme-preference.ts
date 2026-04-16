export type PmuTheme = "dark" | "warm";

export const THEME_STORAGE_KEY = "pmu-theme-v2";

export function isPmuTheme(value: string | null): value is PmuTheme {
  return value === "dark" || value === "warm";
}
