import type { AlgoParameters, Participant, SegmentKey } from "@/lib/types";

export const BANKROLL_BASE_EUROS = 100;
export const MAX_KELLY_BANKROLL_PCT = 0.05;
export const VALUE_CONFIRMATION_MULTIPLIER = 1.15;

export const ELITE_DRIVERS_TROT: Record<string, number> = {
  bazire: 10,
  duvaldestin: 10,
  abrivard: 9,
  nivard: 9,
  raffin: 9,
  lagadeuc: 8,
  thomain: 8,
};

export const ELITE_JOCKEYS_FLAT: Record<string, number> = {
  lemaire: 10,
  soumillon: 10,
  demuro: 9,
  guyon: 9,
  barzalona: 9,
  pasquier: 8,
  perrault: 7,
  purton: 9,
  moreira: 10,
};

export const ELITE_TRAINERS: Record<string, number> = {
  fabre: 10,
  graffard: 9,
  rohaut: 8,
  head: 8,
  brandt: 8,
  abrivard: 8,
  bazire: 8,
  duvaldestin: 8,
  bigeon: 7,
};

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

export function kellyFraction(
  probability: number,
  odds: number | null | undefined
) {
  if (!odds || !Number.isFinite(odds) || odds <= 1 || probability <= 0) {
    return 0;
  }

  const raw = (probability * odds - 1) / (odds - 1);
  return clamp(raw, 0, MAX_KELLY_BANKROLL_PCT);
}

export function getProbabilityCalibrationMultiplier(
  probability: number,
  parameters: AlgoParameters,
  segmentKey?: SegmentKey | null
) {
  const segmentBins =
    (segmentKey
      ? parameters.probabilityCalibration?.segments?.[segmentKey]?.bins
      : null) ?? null;
  const bins = segmentBins ?? parameters.probabilityCalibration?.bins ?? [];
  const match = bins.find(
    (bin) => probability >= bin.min && (probability < bin.max || bin.max >= 1)
  );

  return match ? clamp(match.multiplier, 0.5, 1.8) : 1;
}

export function getEliteScore(
  target: string,
  eliteMap: Record<string, number>
) {
  const normalized = normalizeKey(target);
  if (!normalized) return 0;

  let best = 0;
  for (const [name, score] of Object.entries(eliteMap)) {
    if (normalized.includes(name)) {
      best = Math.max(best, score);
    }
  }

  return best;
}

export function getHumanReference(
  participant: Participant,
  estPlat: boolean
) {
  return estPlat
    ? participant.jockey || participant.driver || participant.entraineur
    : participant.driver || participant.jockey || participant.entraineur;
}
