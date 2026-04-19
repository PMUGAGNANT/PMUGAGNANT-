import { toIsoDate } from "@/lib/date-utils";
import { logger } from "@/lib/server-logger";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { RaceRoleV10Key } from "@/lib/predictions/roles-v10";
import {
  DEFAULT_SCORING_V101_WEIGHTS,
  normalizeScoringV101ParamKey,
  type ScoringV101Weights,
} from "@/lib/predictions/scoring-v10-1";

type LearningCriterion = "c1_forme" | "c2_cote" | "c3_jockey" | "c4_distance";

interface LearningRunRow {
  id: string;
  date: string;
  reunion: number;
  course: number;
}

interface LearningScoreRow {
  run_id: string;
  cheval_num: number;
  score_expert: number;
  score_v10?: number | null;
  score_v10_1?: number | null;
  bet_type: "GAGNANT" | "PLACE";
  blend_payload: Record<string, unknown>;
}

interface LearningOutcomeRow {
  date: string;
  reunion: number;
  course: number;
  cheval_num: number;
  resultat_gagnant: boolean;
  resultat_place: boolean;
}

interface LearningCourseRow {
  date: string;
  reunion: number;
  course: number;
  hippodrome: string;
}

interface LearningSample {
  role: RaceRoleV10Key;
  hippodrome: string;
  criteria: Record<LearningCriterion, number>;
  success: boolean;
}

interface LearningGroupResult {
  key: string;
  weights: ScoringV101Weights;
  sampleSize: number;
  successes: number;
}

const ROLE_KEYS: RaceRoleV10Key[] = ["CHOIX", "PEPITE", "CHASSEUR", "PODIUM", "OUTSIDER"];
const CRITERIA: LearningCriterion[] = ["c1_forme", "c2_cote", "c3_jockey", "c4_distance"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRole(value: unknown): RaceRoleV10Key | null {
  return ROLE_KEYS.includes(value as RaceRoleV10Key) ? (value as RaceRoleV10Key) : null;
}

function startIsoDate(dateStr: string, daysBack: number) {
  const endIso = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : toIsoDate(dateStr);
  const start = new Date(`${endIso}T12:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - daysBack);
  return start.toISOString().slice(0, 10);
}

function endIsoDate(dateStr: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : toIsoDate(dateStr);
}

function extractV101Sample(
  score: LearningScoreRow,
  run: LearningRunRow,
  course: LearningCourseRow | undefined,
  outcome: LearningOutcomeRow | undefined
): LearningSample | null {
  const payload = getRecord(score.blend_payload);
  const v101 = getRecord(payload?.v101);
  const criteria = getRecord(v101?.criteria);
  const role = getRole(v101?.role);

  if (!role || !criteria || !course || !outcome) {
    return null;
  }

  const parsedCriteria = {
    c1_forme: getNumber(criteria.forme) ?? 0,
    c2_cote: getNumber(criteria.value) ?? 0,
    c3_jockey: getNumber(criteria.jockeyHippodrome) ?? 0,
    c4_distance: getNumber(criteria.distance) ?? 0,
  };
  const success = role === "PODIUM" ? outcome.resultat_place : outcome.resultat_gagnant;

  return {
    role,
    hippodrome: course.hippodrome,
    criteria: parsedCriteria,
    success,
  };
}

function normalizeWeights(raw: Record<LearningCriterion, number>, sampleSize: number): ScoringV101Weights {
  const total = CRITERIA.reduce((sum, key) => sum + raw[key], 0);
  if (!Number.isFinite(total) || total <= 0) {
    return {
      ...DEFAULT_SCORING_V101_WEIGHTS,
      sample_size: sampleSize,
      updated_at: new Date().toISOString().slice(0, 10),
    };
  }

  const factor = 100 / total;
  return {
    c1_forme: Math.round(clamp(raw.c1_forme * factor, 10, 40)),
    c2_cote: Math.round(clamp(raw.c2_cote * factor, 10, 40)),
    c3_jockey: Math.round(clamp(raw.c3_jockey * factor, 10, 40)),
    c4_distance: Math.round(clamp(raw.c4_distance * factor, 10, 40)),
    updated_at: new Date().toISOString().slice(0, 10),
    sample_size: sampleSize,
  };
}

function computeWeightsForGroup(key: string, samples: LearningSample[]): LearningGroupResult {
  const successes = samples.filter((sample) => sample.success);
  const raw = { ...DEFAULT_SCORING_V101_WEIGHTS };

  if (samples.length > 0 && successes.length > 0) {
    for (const criterion of CRITERIA) {
      const allAvg =
        samples.reduce((sum, sample) => sum + sample.criteria[criterion], 0) / samples.length;
      const successAvg =
        successes.reduce((sum, sample) => sum + sample.criteria[criterion], 0) / successes.length;
      const lift = allAvg > 0 ? clamp((successAvg - allAvg) / 25, -0.3, 0.3) : 0;
      raw[criterion] = DEFAULT_SCORING_V101_WEIGHTS[criterion] * (1 + lift);
    }
  }

  return {
    key,
    weights: normalizeWeights(raw, samples.length),
    sampleSize: samples.length,
    successes: successes.length,
  };
}

async function fetchLearningRows(dateStr: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { runs: [], scores: [], outcomes: [], courses: [] };
  }

  const startIso = startIsoDate(dateStr, 60);
  const endIso = endIsoDate(dateStr);
  const [{ data: runs, error: runsError }, { data: outcomes, error: outcomesError }, { data: courses, error: coursesError }] =
    await Promise.all([
      admin
        .from("race_engine_runs")
        .select("id,date,reunion,course")
        .gte("date", startIso)
        .lte("date", endIso)
        .eq("status", "COMPLETED"),
      admin
        .from("runner_outcomes")
        .select("date,reunion,course,cheval_num,resultat_gagnant,resultat_place")
        .gte("date", startIso)
        .lte("date", endIso),
      admin
        .from("courses")
        .select("date,reunion,course,hippodrome")
        .gte("date", startIso)
        .lte("date", endIso),
    ]);

  if (runsError) throw new Error(`Learning runs fetch failed: ${runsError.message}`);
  if (outcomesError) throw new Error(`Learning outcomes fetch failed: ${outcomesError.message}`);
  if (coursesError) throw new Error(`Learning courses fetch failed: ${coursesError.message}`);

  const runRows = (runs ?? []) as LearningRunRow[];
  const scores: LearningScoreRow[] = [];
  const adminClient = admin;
  for (let index = 0; index < runRows.length; index += 200) {
    const chunk = runRows.slice(index, index + 200).map((run) => run.id);
    const { data, error } = await adminClient
      .from("runner_score_snapshots")
      .select("run_id,cheval_num,score_expert,score_v10,score_v10_1,bet_type,blend_payload")
      .in("run_id", chunk);
    if (error) throw new Error(`Learning scores fetch failed: ${error.message}`);
    scores.push(...((data ?? []) as LearningScoreRow[]));
  }

  return {
    runs: runRows,
    scores,
    outcomes: (outcomes ?? []) as LearningOutcomeRow[],
    courses: (courses ?? []) as LearningCourseRow[],
  };
}

async function saveLearningWeights(results: LearningGroupResult[]) {
  const admin = getSupabaseAdminClient();
  if (!admin || results.length === 0) {
    return;
  }

  const rows = results.map((result) => ({
    key: result.key,
    value_json: result.weights,
  }));
  const { error } = await admin.from("parametres").upsert(rows, { onConflict: "key" });
  if (error) {
    throw new Error(`Learning weights upsert failed: ${error.message}`);
  }
}

async function logAutoLearning(dateStr: string, results: LearningGroupResult[], error?: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from("cron_logs").insert({
    route: "/api/cron/results:auto-learning-v10.1",
    status: error ? "FAILED" : "SUCCESS",
    duration_ms: 0,
    courses_processed: results.length,
    errors: error ?? `date=${dateStr}`,
  });
}

export function formatScoringV101AutoLearningTelegram(results: LearningGroupResult[]) {
  const roleLines = ROLE_KEYS.map((role) =>
    results.find((result) => result.key === `scoring_v10_weights_${role}`)
  )
    .filter((result): result is LearningGroupResult => Boolean(result))
    .map(
      (result) =>
        `${result.key.replace("scoring_v10_weights_", "")}: C1=${result.weights.c1_forme} C2=${result.weights.c2_cote} C3=${result.weights.c3_jockey} C4=${result.weights.c4_distance}`
    );

  return ["📊 AUTO-LEARNING : poids mis à jour", ...roleLines].join("\n");
}

export async function runScoringV101AutoLearning(dateStr: string) {
  const results: LearningGroupResult[] = [];

  try {
    const { runs, scores, outcomes, courses } = await fetchLearningRows(dateStr);
    const runById = new Map(runs.map((run) => [run.id, run] as const));
    const courseByKey = new Map(
      courses.map((course) => [`${course.date}-${course.reunion}-${course.course}`, course] as const)
    );
    const outcomeByKey = new Map(
      outcomes.map((outcome) => [
        `${outcome.date}-${outcome.reunion}-${outcome.course}-${outcome.cheval_num}`,
        outcome,
      ] as const)
    );
    const samples = scores
      .map((score) => {
        const run = runById.get(score.run_id);
        if (!run) return null;
        const course = courseByKey.get(`${run.date}-${run.reunion}-${run.course}`);
        const outcome = outcomeByKey.get(
          `${run.date}-${run.reunion}-${run.course}-${score.cheval_num}`
        );
        return extractV101Sample(score, run, course, outcome);
      })
      .filter((sample): sample is LearningSample => sample !== null);

    for (const role of ROLE_KEYS) {
      results.push(
        computeWeightsForGroup(
          `scoring_v10_weights_${role}`,
          samples.filter((sample) => sample.role === role)
        )
      );
    }

    const samplesByTrack = new Map<string, LearningSample[]>();
    for (const sample of samples) {
      const key = normalizeScoringV101ParamKey(sample.hippodrome);
      samplesByTrack.set(key, [...(samplesByTrack.get(key) ?? []), sample]);
    }

    for (const [trackKey, trackSamples] of samplesByTrack) {
      if (trackSamples.length >= 50) {
        results.push(computeWeightsForGroup(`scoring_v10_weights_${trackKey}`, trackSamples));
      }
    }

    await saveLearningWeights(results);
    await logAutoLearning(dateStr, results);

    logger.info("scoring_v10_1.auto_learning_completed", {
      dateStr,
      samples: samples.length,
      weightsUpdated: results.length,
    });

    return {
      success: true,
      date: dateStr,
      samples: samples.length,
      weightsUpdated: results.length,
      results,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logAutoLearning(dateStr, results, message);
    logger.error("scoring_v10_1.auto_learning_failed", error, { dateStr });
    throw error;
  }
}
