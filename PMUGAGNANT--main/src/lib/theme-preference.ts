export type PmuTheme = "dark" | "warm" | "cream";

export const THEME_STORAGE_KEY = "pmu-theme-v2";

export function isPmuTheme(value: string | null): value is PmuTheme {
  return value === "dark" || value === "warm" || value === "cream";
}
