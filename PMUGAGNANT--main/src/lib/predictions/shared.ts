import type { Lisibilite } from "@/lib/types";

export const BANKROLL_BASE_EUROS = 100;
export const MAX_KELLY_BANKROLL_PCT = 0.05;
export const SCORING_ALGO_VERSION = "v9.2";
export const VALUE_CONFIRMATION_MULTIPLIER = 1.15;
export const VALUE_CONFIRMATION_MULTIPLIER_BY_READABILITY_V92: Record<Lisibilite, number> = {
  LISIBLE: 1.1,
  COMPLEXE: 1.25,
  LOTERIE: 1,
};

export const BASE_HORSE_SCORE_WEIGHTS_V92 = {
  baseScore: 32,
  highRiskThreshold: 12,
  elevatedRiskThreshold: 8,
  highRiskMultiplier: 0.7,
  elevatedRiskMultiplier: 0.85,
} as const;

export const LOW_CONFIDENCE_VALIDATION_FLOOR_V92 = 5.5;
export const STRONG_SIGNAL_MIN_V92 = 6;

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

export function getValueConfirmationMultiplier(lisibilite: Lisibilite) {
  return VALUE_CONFIRMATION_MULTIPLIER_BY_READABILITY_V92[lisibilite];
}

export function kellyFraction(probability: number, odds: number | null | undefined) {
  if (!odds || !Number.isFinite(odds) || odds <= 1 || probability <= 0) {
    return 0;
  }

  const raw = (probability * odds - 1) / (odds - 1);
  return clamp(raw, 0, MAX_KELLY_BANKROLL_PCT);
}
