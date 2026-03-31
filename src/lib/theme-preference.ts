export type PmuTheme = "dark" | "warm";

export const THEME_STORAGE_KEY = "pmu-theme";

export function isPmuTheme(value: string | null): value is PmuTheme {
  return value === "dark" || value === "warm";
}
