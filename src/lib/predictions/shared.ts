export const BANKROLL_BASE_EUROS = 100;
export const MAX_KELLY_BANKROLL_PCT = 0.05;
export const VALUE_CONFIRMATION_MULTIPLIER = 1.15;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function normalizeKey(value?: string | null) {
  return (value ?? "").toLowerCase().trim();
}

export function safeRate(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  if (value > 1) {
    return clamp(value / 100, 0, 1);
  }

  return clamp(value, 0, 1);
}

export function marketProbabilityFromOdds(odds: number | null | undefined) {
  if (!odds || !Number.isFinite(odds) || odds <= 1) {
    return 0;
  }

  return 1 / odds;
}

export function kellyFraction(probability: number, odds: number | null | undefined) {
  if (!odds || !Number.isFinite(odds) || odds <= 1 || probability <= 0) {
    return 0;
  }

  const raw = (probability * odds - 1) / (odds - 1);
  return clamp(raw, 0, MAX_KELLY_BANKROLL_PCT);
}
