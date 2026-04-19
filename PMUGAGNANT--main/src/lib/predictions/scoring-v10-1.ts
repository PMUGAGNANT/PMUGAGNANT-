import { toIsoDate } from "@/lib/date-utils";
import { logger } from "@/lib/server-logger";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Participant, RaceSummary } from "@/lib/types";
import {
  getScoreV10Decision,
  loadScoringV10History,
  scoreValueOdds,
  type ScoreV10Breakdown,
  type ScoringV10Decision,
  type ScoringV10History,
  type ScoringV10HistoryEntry,
} from "@/lib/predictions/scoring-v10";
import type { RaceRoleV10Key } from "@/lib/predictions/roles-v10";

export interface ScoringV101Weights {
  c1_forme: number;
  c2_cote: number;
  c3_jockey: number;
  c4_distance: number;
  updated_at?: string;
  sample_size?: number;
}

export interface ScoringV101Config {
  globalWeights: ScoringV101Weights;
  roleWeights: Partial<Record<RaceRoleV10Key, ScoringV101Weights>>;
  hippodromeWeights: Record<string, ScoringV101Weights>;
}

export interface ScoreV101Breakdown extends ScoreV10Breakdown {
  scoreV101: number;
  decisionV101: ScoringV10Decision;
  weightsApplied: ScoringV101Weights;
  hippodromeWeightKey: string;
  temporal: {
    recentWeight: number;
    jockeyWeight: number;
    distanceWeight: number;
  };
  terrainEffect: "BONUS" | "MALUS" | "NEUTRE";
  jockeyMomentum: "BONUS" | "MALUS" | "NEUTRE";
  crowdEffect: "BONUS" | "MALUS" | "NEUTRE";
  crowdRatio: number | null;
  trackMemory: "BONUS" | "NEUTRE";
}

export const DEFAULT_SCORING_V101_WEIGHTS: ScoringV101Weights = {
  c1_forme: 25,
  c2_cote: 25,
  c3_jockey: 25,
  c4_distance: 25,
};

const ROLE_KEYS: RaceRoleV10Key[] = ["CHOIX", "PEPITE", "CHASSEUR", "PODIUM", "OUTSIDER"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeHorse(value: string | null | undefined) {
  return normalizeText(value).replace(/\s+/g, "");
}

export function normalizeScoringV101ParamKey(value: string) {
  return normalizeText(value).replace(/\s+/g, "_");
}

function toReferenceIsoDate(dateStr: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : toIsoDate(dateStr);
}

function daysBetween(referenceIso: string, entryIso: string) {
  const reference = new Date(`${referenceIso}T12:00:00.000Z`).getTime();
  const entry = new Date(`${entryIso}T12:00:00.000Z`).getTime();
  return Math.max(0, Math.floor((reference - entry) / 86_400_000));
}

export function getTemporalCoefficient(ageDays: number) {
  if (ageDays < 30) return 1;
  if (ageDays < 90) return 0.8;
  if (ageDays < 180) return 0.6;
  if (ageDays <= 365) return 0.3;
  return 0.1;
}

function weightedTop3Score(entries: ScoringV10HistoryEntry[], referenceIso: string) {
  if (entries.length === 0) {
    return { score: 8, totalWeight: 0 };
  }

  const totalWeight = entries.reduce(
    (sum, entry) => sum + getTemporalCoefficient(daysBetween(referenceIso, entry.date)),
    0
  );
  const top3Weight = entries.reduce((sum, entry) => {
    const top3 = entry.place || (entry.ordreArrivee !== null && entry.ordreArrivee <= 3);
    return sum + (top3 ? getTemporalCoefficient(daysBetween(referenceIso, entry.date)) : 0);
  }, 0);
  const ratio = totalWeight > 0 ? top3Weight / totalWeight : 0;

  if (ratio >= 0.95) return { score: 25, totalWeight };
  if (ratio >= 0.6) return { score: 18, totalWeight };
  if (ratio > 0) return { score: 10, totalWeight };
  return { score: 0, totalWeight };
}

function weightedWinRate(entries: ScoringV10HistoryEntry[], referenceIso: string) {
  if (entries.length === 0) return null;
  let totalWeight = 0;
  let winWeight = 0;

  for (const entry of entries) {
    const weight = getTemporalCoefficient(daysBetween(referenceIso, entry.date));
    totalWeight += weight;
    if (entry.gagnant || entry.ordreArrivee === 1) {
      winWeight += weight;
    }
  }

  return totalWeight > 0 ? winWeight / totalWeight : null;
}

function scoreJockeyWeighted(winRate: number | null, sampleSize: number) {
  if (sampleSize < 3 || winRate === null) return 8;
  if (winRate >= 0.25) return 25;
  if (winRate >= 0.15) return 20;
  if (winRate >= 0.1) return 14;
  if (winRate >= 0.05) return 8;
  return 3;
}

function getCurrentJockey(participant: Participant) {
  return participant.jockey || participant.driver || null;
}

function getCurrentOdds(participant: Participant) {
  const cote = participant.coteMatin ?? participant.cote ?? participant.coteDepart ?? null;
  return typeof cote === "number" && Number.isFinite(cote) && cote > 0 ? cote : null;
}

function normalizeTerrain(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (normalized.includes("LOURD") || normalized.includes("COLLANT")) return "LOURD";
  if (normalized.includes("SOUPLE") || normalized.includes("TRES SOUPLE")) return "SOUPLE";
  if (normalized.includes("BON") || normalized.includes("LEGER")) return "BON";
  return normalized || "INCONNU";
}

function applyTerrainEffect(scoreC1: number, horseHistory: ScoringV10HistoryEntry[], race: RaceSummary) {
  const terrain = normalizeTerrain(race.terrain);
  if (terrain === "INCONNU" || horseHistory.length === 0) {
    return { score: scoreC1, effect: "NEUTRE" as const };
  }

  const terrainRuns = horseHistory.filter((entry) => normalizeTerrain(entry.terrain) === terrain);
  if (terrainRuns.length === 0) {
    return { score: clamp(scoreC1 * 0.9, 0, 25), effect: "MALUS" as const };
  }

  const hasTop3 = terrainRuns.some(
    (entry) => entry.place || (entry.ordreArrivee !== null && entry.ordreArrivee <= 3)
  );
  if (hasTop3) {
    return { score: clamp(scoreC1 * 1.15, 0, 25), effect: "BONUS" as const };
  }

  return { score: scoreC1, effect: "NEUTRE" as const };
}

function applyJockeyMomentum(
  scoreC3: number,
  jockeyEntries: ScoringV10HistoryEntry[],
  referenceIso: string
) {
  const recentWins = jockeyEntries.filter(
    (entry) =>
      daysBetween(referenceIso, entry.date) <= 7 &&
      (entry.gagnant || entry.ordreArrivee === 1)
  ).length;

  if (recentWins >= 3) {
    return { score: clamp(scoreC3 * 1.2, 0, 25), momentum: "BONUS" as const };
  }

  if (recentWins === 0 && jockeyEntries.length > 0) {
    return { score: clamp(scoreC3 * 0.9, 0, 25), momentum: "MALUS" as const };
  }

  return { score: scoreC3, momentum: "NEUTRE" as const };
}

function applyCrowdEffect(scoreC2: number, cote: number | null, probaCalibrated: number | null) {
  if (!cote || !probaCalibrated || cote <= 1) {
    return { score: scoreC2, effect: "NEUTRE" as const, ratio: null };
  }

  const probability = probaCalibrated > 1 ? probaCalibrated / 100 : probaCalibrated;
  const implied = 1 / cote;
  const ratio = implied > 0 ? probability / implied : null;

  if (ratio !== null && ratio < 0.7) {
    return { score: clamp(scoreC2 * 0.85, 0, 25), effect: "MALUS" as const, ratio };
  }

  if (ratio !== null && ratio > 1.3) {
    return { score: clamp(scoreC2 * 1.2, 0, 25), effect: "BONUS" as const, ratio };
  }

  return { score: scoreC2, effect: "NEUTRE" as const, ratio };
}

function getTrackMemoryMultiplier(
  horseHistory: ScoringV10HistoryEntry[],
  race: RaceSummary,
  referenceIso: string
) {
  const track = normalizeText(race.hippodrome);
  const recentTrackRuns = horseHistory.filter(
    (entry) => normalizeText(entry.hippodrome) === track && daysBetween(referenceIso, entry.date) <= 30
  );
  const hasRecentTop3 = recentTrackRuns.some(
    (entry) => entry.place || (entry.ordreArrivee !== null && entry.ordreArrivee <= 3)
  );

  return hasRecentTop3 ? { multiplier: 1.15, effect: "BONUS" as const } : { multiplier: 1, effect: "NEUTRE" as const };
}

function normalizeWeights(weights: ScoringV101Weights): ScoringV101Weights {
  const total =
    weights.c1_forme + weights.c2_cote + weights.c3_jockey + weights.c4_distance;
  if (!Number.isFinite(total) || total <= 0) {
    return DEFAULT_SCORING_V101_WEIGHTS;
  }

  const factor = 100 / total;
  return {
    c1_forme: Math.round(weights.c1_forme * factor * 10) / 10,
    c2_cote: Math.round(weights.c2_cote * factor * 10) / 10,
    c3_jockey: Math.round(weights.c3_jockey * factor * 10) / 10,
    c4_distance: Math.round(weights.c4_distance * factor * 10) / 10,
    updated_at: weights.updated_at,
    sample_size: weights.sample_size,
  };
}

function parseWeights(value: unknown): ScoringV101Weights | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const weights = {
    c1_forme: Number(record.c1_forme),
    c2_cote: Number(record.c2_cote),
    c3_jockey: Number(record.c3_jockey),
    c4_distance: Number(record.c4_distance),
    updated_at: typeof record.updated_at === "string" ? record.updated_at : undefined,
    sample_size:
      typeof record.sample_size === "number" && Number.isFinite(record.sample_size)
        ? record.sample_size
        : undefined,
  };

  if (
    !Number.isFinite(weights.c1_forme) ||
    !Number.isFinite(weights.c2_cote) ||
    !Number.isFinite(weights.c3_jockey) ||
    !Number.isFinite(weights.c4_distance)
  ) {
    return null;
  }

  return normalizeWeights(weights);
}

export async function loadScoringV101Config(): Promise<ScoringV101Config> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      globalWeights: DEFAULT_SCORING_V101_WEIGHTS,
      roleWeights: {},
      hippodromeWeights: {},
    };
  }

  const { data, error } = await admin.from("parametres").select("key,value_json");
  if (error) {
    logger.warn("scoring_v10_1.config_load_failed", { error: error.message });
    return {
      globalWeights: DEFAULT_SCORING_V101_WEIGHTS,
      roleWeights: {},
      hippodromeWeights: {},
    };
  }

  const roleWeights: Partial<Record<RaceRoleV10Key, ScoringV101Weights>> = {};
  const hippodromeWeights: Record<string, ScoringV101Weights> = {};
  let globalWeights = DEFAULT_SCORING_V101_WEIGHTS;

  for (const row of data ?? []) {
    const key = typeof row.key === "string" ? row.key : "";
    const weights = parseWeights(row.value_json);
    if (!weights) continue;

    if (key === "scoring_v10_1_weights_global") {
      globalWeights = weights;
      continue;
    }

    for (const role of ROLE_KEYS) {
      if (key === `scoring_v10_weights_${role}` || key === `scoring_v10_1_weights_${role}`) {
        roleWeights[role] = weights;
      }
    }

    if (key.startsWith("scoring_v10_weights_") || key.startsWith("scoring_v10_1_weights_")) {
      const suffix = key
        .replace("scoring_v10_1_weights_", "")
        .replace("scoring_v10_weights_", "");
      if (!ROLE_KEYS.includes(suffix as RaceRoleV10Key) && (weights.sample_size ?? 0) >= 50) {
        hippodromeWeights[suffix] = weights;
      }
    }
  }

  return { globalWeights, roleWeights, hippodromeWeights };
}

function getWeightsForRace(race: RaceSummary, config: ScoringV101Config) {
  const key = normalizeScoringV101ParamKey(race.hippodrome);
  return {
    key,
    weights: config.hippodromeWeights[key] ?? config.globalWeights,
  };
}

function weightedScore(
  criteria: {
    c1: number;
    c2: number;
    c3: number;
    c4: number;
  },
  weights: ScoringV101Weights
) {
  return clamp(
    (criteria.c1 / 25) * weights.c1_forme +
      (criteria.c2 / 25) * weights.c2_cote +
      (criteria.c3 / 25) * weights.c3_jockey +
      (criteria.c4 / 25) * weights.c4_distance,
    0,
    100
  );
}

export function computeScoreV101ForParticipant(
  participant: Participant,
  race: RaceSummary,
  history: ScoringV10History,
  config: ScoringV101Config,
  probaCalibrated: number | null = null
): ScoreV101Breakdown {
  const referenceIso = toReferenceIsoDate(race.dateStr);
  const horseKey = normalizeHorse(participant.nom);
  const raceDiscipline = normalizeText(race.discipline);
  const raceTrack = normalizeText(race.hippodrome);
  const jockey = getCurrentJockey(participant);
  const jockeyKey = normalizeText(jockey);
  const cote = getCurrentOdds(participant);
  const { key: hippodromeWeightKey, weights } = getWeightsForRace(race, config);

  const horseHistory = history.entries
    .filter((entry) => normalizeHorse(entry.chevalNom) === horseKey)
    .sort((left, right) => right.date.localeCompare(left.date));
  const recentSameDiscipline = horseHistory
    .filter((entry) => normalizeText(entry.discipline) === raceDiscipline)
    .slice(0, 3);
  const recentScore = weightedTop3Score(recentSameDiscipline, referenceIso);
  const terrainAdjusted = applyTerrainEffect(recentScore.score, horseHistory, race);

  const scoreC2Base = scoreValueOdds(cote);
  const crowdAdjusted = applyCrowdEffect(scoreC2Base, cote, probaCalibrated);

  const jockeyTrackRuns =
    jockeyKey === ""
      ? []
      : history.entries.filter(
          (entry) =>
            normalizeText(entry.jockey) === jockeyKey &&
            normalizeText(entry.hippodrome) === raceTrack
        );
  const jockeyWinRate = weightedWinRate(jockeyTrackRuns, referenceIso);
  const jockeyBaseScore = scoreJockeyWeighted(jockeyWinRate, jockeyTrackRuns.length);
  const jockeyAdjusted = applyJockeyMomentum(jockeyBaseScore, jockeyTrackRuns, referenceIso);

  const exactDistanceRuns = horseHistory.filter(
    (entry) =>
      entry.distance !== null &&
      race.distance > 0 &&
      Math.abs(entry.distance - race.distance) <= 200
  );
  const closeDistanceRuns = horseHistory.filter(
    (entry) =>
      entry.distance !== null &&
      race.distance > 0 &&
      Math.abs(entry.distance - race.distance) > 200 &&
      Math.abs(entry.distance - race.distance) <= 400
  );
  const distanceTop3Weight = exactDistanceRuns.reduce((sum, entry) => {
    const top3 = entry.place || (entry.ordreArrivee !== null && entry.ordreArrivee <= 3);
    return sum + (top3 ? getTemporalCoefficient(daysBetween(referenceIso, entry.date)) : 0);
  }, 0);
  const scoreC4 =
    horseHistory.length <= 0
      ? 8
      : distanceTop3Weight > 0
        ? 25
        : exactDistanceRuns.length > 0
          ? 10
          : closeDistanceRuns.length > 0
            ? 8
            : 5;

  const trackMemory = getTrackMemoryMultiplier(horseHistory, race, referenceIso);
  const rawScore = weightedScore(
    {
      c1: terrainAdjusted.score,
      c2: crowdAdjusted.score,
      c3: jockeyAdjusted.score,
      c4: scoreC4,
    },
    weights
  );
  const scoreV101 = Math.round(clamp(rawScore * trackMemory.multiplier, 0, 100));

  return {
    chevalNum: participant.numPmu,
    chevalNom: participant.nom,
    jockey,
    cote,
    scoreC1: Math.round(terrainAdjusted.score * 10) / 10,
    scoreC2: Math.round(crowdAdjusted.score * 10) / 10,
    scoreC3: Math.round(jockeyAdjusted.score * 10) / 10,
    scoreC4,
    scoreV10: scoreV101,
    scoreV101,
    decision: getScoreV10Decision(scoreV101),
    decisionV101: getScoreV10Decision(scoreV101),
    recentTop3Count:
      recentSameDiscipline.length > 0
        ? recentSameDiscipline.filter(
            (entry) => entry.place || (entry.ordreArrivee !== null && entry.ordreArrivee <= 3)
          ).length
        : null,
    recentSample: recentSameDiscipline.length,
    jockeyWinRate,
    jockeySample: jockeyTrackRuns.length,
    distanceSample: exactDistanceRuns.length,
    distanceTop3: distanceTop3Weight > 0,
    weightsApplied: weights,
    hippodromeWeightKey,
    temporal: {
      recentWeight: Math.round(recentScore.totalWeight * 100) / 100,
      jockeyWeight: Math.round(
        jockeyTrackRuns.reduce(
          (sum, entry) => sum + getTemporalCoefficient(daysBetween(referenceIso, entry.date)),
          0
        ) * 100
      ) / 100,
      distanceWeight: Math.round(
        exactDistanceRuns.reduce(
          (sum, entry) => sum + getTemporalCoefficient(daysBetween(referenceIso, entry.date)),
          0
        ) * 100
      ) / 100,
    },
    terrainEffect: terrainAdjusted.effect,
    jockeyMomentum: jockeyAdjusted.momentum,
    crowdEffect: crowdAdjusted.effect,
    crowdRatio: crowdAdjusted.ratio === null ? null : Math.round(crowdAdjusted.ratio * 100) / 100,
    trackMemory: trackMemory.effect,
  };
}

export function computeRaceScoresV101(
  race: RaceSummary,
  participants: Participant[],
  history: ScoringV10History,
  config: ScoringV101Config,
  probaCalibratedByHorse: Map<number, number | null> = new Map()
) {
  return participants
    .filter((participant) => !participant.nonPartant)
    .map((participant) =>
      computeScoreV101ForParticipant(
        participant,
        race,
        history,
        config,
        probaCalibratedByHorse.get(participant.numPmu) ?? null
      )
    )
    .sort((left, right) => {
      if (right.scoreV101 !== left.scoreV101) return right.scoreV101 - left.scoreV101;
      return (left.cote ?? 999) - (right.cote ?? 999);
    });
}

export async function loadScoringV101Inputs(dateStr: string) {
  const [history, config] = await Promise.all([
    loadScoringV10History(dateStr),
    loadScoringV101Config(),
  ]);

  return { history, config };
}
