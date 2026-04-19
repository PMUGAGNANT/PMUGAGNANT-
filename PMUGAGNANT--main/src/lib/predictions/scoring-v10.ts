import { toIsoDate } from "@/lib/date-utils";
import { logger } from "@/lib/server-logger";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Participant, RaceSummary } from "@/lib/types";

export type ScoringV10Decision = "JOUER" | "SURVEILLER" | "PASSER";

export interface ScoreV10Breakdown {
  chevalNum: number;
  chevalNom: string;
  jockey: string | null;
  cote: number | null;
  scoreC1: number;
  scoreC2: number;
  scoreC3: number;
  scoreC4: number;
  scoreV10: number;
  decision: ScoringV10Decision;
  recentTop3Count: number | null;
  recentSample: number;
  jockeyWinRate: number | null;
  jockeySample: number;
  distanceSample: number;
  distanceTop3: boolean;
}

export interface ScoringV10CourseRow {
  date: string;
  reunion: number;
  course: number;
  hippodrome: string;
  discipline: string;
  distance: number | null;
  terrain?: string | null;
}

export interface ScoringV10OutcomeRow {
  date: string;
  reunion: number;
  course: number;
  cheval_num: number;
  ordre_arrivee?: number | null;
  resultat_gagnant?: boolean | null;
  resultat_place?: boolean | null;
  non_partant?: boolean | null;
}

export interface ScoringV10FeatureRow {
  date: string;
  reunion: number;
  course: number;
  cheval_num: number;
  cheval_nom: string;
  payload: Record<string, unknown> | null;
}

export interface ScoringV10HistoryEntry {
  date: string;
  reunion: number;
  course: number;
  chevalNum: number;
  chevalNom: string;
  jockey: string | null;
  hippodrome: string;
  discipline: string;
  distance: number | null;
  terrain: string | null;
  ordreArrivee: number | null;
  gagnant: boolean;
  place: boolean;
}

export interface ScoringV10History {
  entries: ScoringV10HistoryEntry[];
}

const PAGE_SIZE = 1000;

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

function toReferenceIsoDate(dateStr: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : toIsoDate(dateStr);
}

function startIsoDate(referenceIso: string) {
  const start = new Date(`${referenceIso}T12:00:00.000Z`);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  return start.toISOString().slice(0, 10);
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getStringField(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function getParticipantPayload(payload: Record<string, unknown> | null) {
  return getRecord(payload?.participant);
}

function getFeatureJockey(row: ScoringV10FeatureRow) {
  const participant = getParticipantPayload(row.payload);
  return (
    getStringField(participant, "jockey") ??
    getStringField(participant, "driver") ??
    null
  );
}

function getCurrentJockey(participant: Participant) {
  return participant.jockey || participant.driver || null;
}

function getCurrentOdds(participant: Participant) {
  const cote =
    participant.coteMatin ??
    participant.cote ??
    participant.coteDepart ??
    null;
  return typeof cote === "number" && Number.isFinite(cote) && cote > 0 ? cote : null;
}

function isTop3(entry: ScoringV10HistoryEntry) {
  return entry.place || (entry.ordreArrivee !== null && entry.ordreArrivee <= 3);
}

function isWinner(entry: ScoringV10HistoryEntry) {
  return entry.gagnant || entry.ordreArrivee === 1;
}

export function scoreRecentForm(top3Count: number | null, sampleSize: number) {
  if (sampleSize <= 0 || top3Count === null) return 8;
  if (top3Count >= 3) return 25;
  if (top3Count === 2) return 18;
  if (top3Count === 1) return 10;
  return 0;
}

export function scoreValueOdds(cote: number | null | undefined) {
  if (typeof cote !== "number" || !Number.isFinite(cote) || cote <= 0) return 10;
  if (cote < 2) return 5;
  if (cote < 3.5) return 12;
  if (cote < 6) return 20;
  if (cote < 10) return 25;
  if (cote <= 15) return 18;
  return 8;
}

export function scoreJockeyTrack(winRate: number | null, sampleSize: number) {
  if (sampleSize < 3 || winRate === null) return 8;
  if (winRate >= 0.25) return 25;
  if (winRate >= 0.15) return 20;
  if (winRate >= 0.1) return 14;
  if (winRate >= 0.05) return 8;
  return 3;
}

export function scoreDistance(input: {
  horseSample: number;
  exactDistanceSample: number;
  exactDistanceTop3: boolean;
  closeDistanceSample: number;
}) {
  if (input.horseSample <= 0) return 8;
  if (input.exactDistanceTop3) return 25;
  if (input.exactDistanceSample > 0) return 10;
  if (input.closeDistanceSample > 0) return 8;
  return 5;
}

export function getScoreV10Decision(scoreV10: number): ScoringV10Decision {
  if (scoreV10 >= 70) return "JOUER";
  if (scoreV10 >= 50) return "SURVEILLER";
  return "PASSER";
}

async function fetchPaged<T>(
  fetchPage: (from: number, to: number) => Promise<{
    data: T[] | null;
    error: { message: string } | null;
  }>
) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

export async function loadScoringV10History(dateStr: string): Promise<ScoringV10History> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { entries: [] };
  }

  const endIso = toReferenceIsoDate(dateStr);
  const startIso = startIsoDate(endIso);

  try {
    const [courses, outcomes, features] = await Promise.all([
      fetchPaged<ScoringV10CourseRow>(async (from, to) =>
        admin
          .from("courses")
          .select("date,reunion,course,hippodrome,discipline,distance,terrain")
          .gte("date", startIso)
          .lt("date", endIso)
          .range(from, to)
      ),
      fetchPaged<ScoringV10OutcomeRow>(async (from, to) =>
        admin
          .from("runner_outcomes")
          .select("date,reunion,course,cheval_num,ordre_arrivee,resultat_gagnant,resultat_place,non_partant")
          .gte("date", startIso)
          .lt("date", endIso)
          .range(from, to)
      ),
      fetchPaged<ScoringV10FeatureRow>(async (from, to) =>
        admin
          .from("runner_feature_snapshots")
          .select("date,reunion,course,cheval_num,cheval_nom,payload")
          .gte("date", startIso)
          .lt("date", endIso)
          .range(from, to)
      ),
    ]);

    return buildScoringV10History(courses, outcomes, features);
  } catch (error) {
    logger.warn("scoring_v10.history_load_failed", {
      dateStr,
      error: error instanceof Error ? error.message : String(error),
    });
    return { entries: [] };
  }
}

export function buildScoringV10History(
  courses: ScoringV10CourseRow[],
  outcomes: ScoringV10OutcomeRow[],
  features: ScoringV10FeatureRow[]
): ScoringV10History {
  const courseByKey = new Map(
    courses.map((course) => [
      `${course.date}-${course.reunion}-${course.course}`,
      course,
    ])
  );
  const featureByKey = new Map(
    features.map((feature) => [
      `${feature.date}-${feature.reunion}-${feature.course}-${feature.cheval_num}`,
      feature,
    ])
  );

  const entries = outcomes
    .filter((outcome) => !outcome.non_partant)
    .map((outcome) => {
      const course = courseByKey.get(`${outcome.date}-${outcome.reunion}-${outcome.course}`);
      const feature = featureByKey.get(
        `${outcome.date}-${outcome.reunion}-${outcome.course}-${outcome.cheval_num}`
      );

      if (!course || !feature) {
        return null;
      }

      const ordreArrivee =
        typeof outcome.ordre_arrivee === "number" && Number.isFinite(outcome.ordre_arrivee)
          ? outcome.ordre_arrivee
          : null;

      return {
        date: outcome.date,
        reunion: outcome.reunion,
        course: outcome.course,
        chevalNum: outcome.cheval_num,
        chevalNom: feature.cheval_nom,
        jockey: getFeatureJockey(feature),
        hippodrome: course.hippodrome,
        discipline: course.discipline,
        terrain: course.terrain ?? null,
        distance:
          typeof course.distance === "number" && Number.isFinite(course.distance)
            ? course.distance
            : null,
        ordreArrivee,
        gagnant: Boolean(outcome.resultat_gagnant ?? ordreArrivee === 1),
        place: Boolean(outcome.resultat_place ?? (ordreArrivee !== null && ordreArrivee <= 3)),
      } satisfies ScoringV10HistoryEntry;
    })
    .filter((entry): entry is ScoringV10HistoryEntry => entry !== null);

  return { entries };
}

export function computeScoreV10ForParticipant(
  participant: Participant,
  race: RaceSummary,
  history: ScoringV10History
): ScoreV10Breakdown {
  const horseKey = normalizeHorse(participant.nom);
  const raceDiscipline = normalizeText(race.discipline);
  const raceTrack = normalizeText(race.hippodrome);
  const currentJockey = getCurrentJockey(participant);
  const jockeyKey = normalizeText(currentJockey);
  const cote = getCurrentOdds(participant);

  const horseHistory = history.entries
    .filter((entry) => normalizeHorse(entry.chevalNom) === horseKey)
    .sort((left, right) => right.date.localeCompare(left.date));

  const recentSameDiscipline = horseHistory
    .filter((entry) => normalizeText(entry.discipline) === raceDiscipline)
    .slice(0, 3);
  const recentTop3Count = recentSameDiscipline.filter(isTop3).length;
  const scoreC1 = scoreRecentForm(
    recentSameDiscipline.length > 0 ? recentTop3Count : null,
    recentSameDiscipline.length
  );

  const scoreC2 = scoreValueOdds(cote);

  const jockeyTrackRuns =
    jockeyKey === ""
      ? []
      : history.entries.filter(
          (entry) =>
            normalizeText(entry.jockey) === jockeyKey &&
            normalizeText(entry.hippodrome) === raceTrack
        );
  const jockeyWins = jockeyTrackRuns.filter(isWinner).length;
  const jockeyWinRate =
    jockeyTrackRuns.length > 0 ? jockeyWins / jockeyTrackRuns.length : null;
  const scoreC3 = scoreJockeyTrack(jockeyWinRate, jockeyTrackRuns.length);

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
  const exactDistanceTop3 = exactDistanceRuns.some(isTop3);
  const scoreC4 = scoreDistance({
    horseSample: horseHistory.length,
    exactDistanceSample: exactDistanceRuns.length,
    exactDistanceTop3,
    closeDistanceSample: closeDistanceRuns.length,
  });

  const scoreV10 = scoreC1 + scoreC2 + scoreC3 + scoreC4;

  return {
    chevalNum: participant.numPmu,
    chevalNom: participant.nom,
    jockey: currentJockey,
    cote,
    scoreC1,
    scoreC2,
    scoreC3,
    scoreC4,
    scoreV10,
    decision: getScoreV10Decision(scoreV10),
    recentTop3Count: recentSameDiscipline.length > 0 ? recentTop3Count : null,
    recentSample: recentSameDiscipline.length,
    jockeyWinRate,
    jockeySample: jockeyTrackRuns.length,
    distanceSample: exactDistanceRuns.length,
    distanceTop3: exactDistanceTop3,
  };
}

export function computeRaceScoresV10(
  race: RaceSummary,
  participants: Participant[],
  history: ScoringV10History
) {
  return participants
    .filter((participant) => !participant.nonPartant)
    .map((participant) => computeScoreV10ForParticipant(participant, race, history))
    .sort((left, right) => {
      if (right.scoreV10 !== left.scoreV10) return right.scoreV10 - left.scoreV10;
      return (left.cote ?? 999) - (right.cote ?? 999);
    });
}
