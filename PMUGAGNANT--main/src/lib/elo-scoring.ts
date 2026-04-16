/**
 * Système ELO simplifié (cheval / jockey / entraîneur).
 * La fiche partant (API PMU) alimente le cheval ; jockey & entraineur via taux si dispo.
 * Une variante « programme » estime depuis la confiance pick quand le détail partant manque.
 */

export type EloProfile = {
  eloCheval: number;
  eloJockey: number;
  eloEntraineur: number;
  /** Fiabilité 0–100 % selon volumétrie carrière (courses cheval) */
  sigma: number;
  eloGlobal: number;
};

const ELO_BASE = 1000;
const ELO_MIN = 600;
const ELO_MAX = 1600;

/** Baseline taux turf (approx. champ moyen). */
const BASE_WIN = 0.12;
const BASE_PLACE = 0.38;

export function computeSigmaFromRunCount(totalRuns: number): number {
  if (!Number.isFinite(totalRuns) || totalRuns < 5) return 20;
  if (totalRuns <= 20) return 60;
  return 100;
}

function clampElo(value: number): number {
  return Math.min(ELO_MAX, Math.max(ELO_MIN, Math.round(value)));
}

/**
 * ELO cheval depuis carrière PMU (victoires / placés / courses).
 */
export function eloChevalFromCareer(victoires: number, places: number, courses: number): number {
  const n = Math.max(0, Math.floor(courses));
  if (n <= 0) {
    return ELO_BASE;
  }
  const w = Math.min(victoires, n);
  const pl = Math.min(Math.max(places, w), n);
  const winRate = w / n;
  const placeOnly = Math.max(0, pl - w) / n;
  const winDelta = (winRate - BASE_WIN) * 900;
  const placeDelta = (placeOnly - (BASE_PLACE - BASE_WIN)) * 350;
  return clampElo(ELO_BASE + winDelta + placeDelta);
}

/**
 * ELO jockey ou entraîneur depuis taux de réussite 0–1 (proxy 90 j / carrière si pas de découpe).
 */
export function eloHumainFromWinRate(rate: number | null | undefined): number {
  if (rate == null || !Number.isFinite(rate)) {
    return ELO_BASE;
  }
  const r = Math.min(0.45, Math.max(0.03, rate));
  return clampElo(ELO_BASE + (r - BASE_WIN) * 700);
}

export function computeEloGlobal(eloCheval: number, eloJockey: number, eloEntraineur: number): number {
  const g = eloCheval * 0.5 + eloJockey * 0.3 + eloEntraineur * 0.2;
  return Math.round(g * 10) / 10;
}

export function buildEloProfile(input: {
  coursesCheval: number;
  victoiresCheval: number;
  placesCheval: number;
  jockeyWinRate?: number | null;
  trainerWinRate?: number | null;
}): EloProfile {
  const eloCheval = eloChevalFromCareer(
    input.victoiresCheval,
    input.placesCheval,
    input.coursesCheval
  );
  const eloJockey = eloHumainFromWinRate(input.jockeyWinRate);
  const eloEntraineur = eloHumainFromWinRate(input.trainerWinRate ?? input.jockeyWinRate);
  const sigma = computeSigmaFromRunCount(input.coursesCheval);
  const eloGlobal = computeEloGlobal(eloCheval, eloJockey, eloEntraineur);
  return { eloCheval, eloJockey, eloEntraineur, sigma, eloGlobal };
}

export type ParticipantEloInput = {
  nombreCourses: number;
  nombreVictoires: number;
  nombrePlaces: number;
  jockeyWinRate?: number | null;
  trainerTrackWinRate?: number | null;
};

export function buildEloProfileFromParticipant(p: ParticipantEloInput): EloProfile {
  return buildEloProfile({
    coursesCheval: p.nombreCourses,
    victoiresCheval: p.nombreVictoires,
    placesCheval: p.nombrePlaces,
    jockeyWinRate: p.jockeyWinRate,
    trainerWinRate: p.trainerTrackWinRate ?? p.jockeyWinRate,
  });
}

/**
 * Estimation légère pour la liste programme (pas de fiche complète) : dérive depuis la confiance pick 0–10.
 * À remplacer par agrégats Supabase quand une table historique sera branchée.
 */
export function estimateEloProfileForProgrammeCard(pickConfidence: number | null | undefined): EloProfile {
  const c =
    pickConfidence != null && Number.isFinite(Number(pickConfidence)) ? Number(pickConfidence) : 5;
  const spread = 18;
  const center = ELO_BASE + (c - 5) * 28;
  const eloCheval = clampElo(center + spread * 0.5);
  const eloJockey = clampElo(center - spread * 0.2);
  const eloEntraineur = clampElo(center - spread * 0.3);
  const sigma = c >= 7 ? 40 : c >= 4 ? 35 : 25;
  return {
    eloCheval,
    eloJockey,
    eloEntraineur,
    sigma,
    eloGlobal: computeEloGlobal(eloCheval, eloJockey, eloEntraineur),
  };
}

export type EloBadgeStyle = {
  label: string;
  color: string;
  bg: string;
};

/** >1200 élite, 1000–1200 bon, <1000 faible */
export function getEloGlobalBadgeStyle(eloGlobal: number): EloBadgeStyle {
  if (eloGlobal > 1200) {
    return { label: "Élite", color: "#00c853", bg: "color-mix(in srgb, #00c853 18%, transparent)" };
  }
  if (eloGlobal >= 1000) {
    return { label: "Bon", color: "#ff9800", bg: "color-mix(in srgb, #ff9800 16%, transparent)" };
  }
  return { label: "Faible", color: "#9e9e9e", bg: "color-mix(in srgb, #9e9e9e 14%, transparent)" };
}

export function normalizeEloBar(elo: number): number {
  return Math.min(100, Math.max(0, ((elo - ELO_MIN) / (ELO_MAX - ELO_MIN)) * 100));
}
