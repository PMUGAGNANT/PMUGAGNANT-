import { toIsoDate } from "@/lib/date-utils";
import { ENGINE_V6_VERSION, getEngineConfigVersion, getRaceSegmentKey } from "@/lib/engine-v6";
import { getSupabaseAdminClient, getSupabaseAdminConfigError } from "@/lib/supabase";
import type {
  AlgoParameters,
  CourseRecordRow,
  EngineCandidateMetricRow,
  EngineCandidateRow,
  EnginePromotionRow,
  Participant,
  PredictionRow,
  RaceAnalysis,
  RaceEngineRunRow,
  RaceSummary,
  RunnerFeatureSnapshotRow,
  RunnerMarketSnapshotRow,
  RunnerOutcomeRow,
  RunnerScoreSnapshotRow,
  SegmentCalibrationRow,
  SegmentLearningStateRow,
  ScoreStage,
} from "@/lib/types";

function getAdmin() {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error(getSupabaseAdminConfigError());
  }

  return admin;
}

function nowIso() {
  return new Date().toISOString();
}

export function buildPredictionRows(
  dateStr: string,
  race: RaceSummary,
  analysis: RaceAnalysis,
  stage: ScoreStage = "MATIN"
): PredictionRow[] {
  const date = toIsoDate(dateStr);
  const updatedAt = nowIso();

  return analysis.ranking.map((runner) => ({
    date,
    reunion: race.reunion,
    course: race.course,
    hippodrome: race.hippodrome,
    cheval_num: runner.numPmu,
    cheval_nom: runner.nom,
    score_cheval: runner.prediction.scoreCheval,
    score_final_pari: runner.prediction.scoreFinalPari,
    coefficient_lisibilite: analysis.prediction.coefficientLisibilite,
    confiance: runner.prediction.confiance,
    qualite: runner.prediction.qualite,
    lisibilite: analysis.prediction.lisibilite,
    value: runner.prediction.valueEffective,
    cote_matin: runner.coteMatin ?? runner.cote ?? null,
    cote_depart: stage === "T10" || stage === "RESULTAT" ? runner.cote ?? null : null,
    variation_cote: runner.variationCote ?? null,
    signal_variation: runner.signalVariation ?? null,
    ferrure_ref: runner.ferrure ?? null,
    ferrure_t10: stage === "T10" || stage === "RESULTAT" ? runner.ferrure ?? null : null,
    non_partant: Boolean(runner.nonPartant),
    decision: runner.prediction.decision,
    pari_conseille: runner.prediction.typePariConseille,
    outsider: runner.prediction.outsider,
    mise_simulee: runner.prediction.miseConseillee,
    resultat_place: null,
    resultat_gagnant: null,
    rapport_place: null,
    rapport_gagnant: null,
    gain_simule: null,
    stage,
    updated_at: updatedAt,
  }));
}

export function buildCourseRecord(
  dateStr: string,
  race: RaceSummary,
  analysis: RaceAnalysis
): CourseRecordRow {
  return {
    date: toIsoDate(dateStr),
    reunion: race.reunion,
    course: race.course,
    hippodrome: race.hippodrome,
    nom_course: race.nomCourse,
    heure_depart: race.heureDepart,
    discipline: race.discipline,
    allocation: race.allocation,
    distance: race.distance,
    nombre_partants: race.nombrePartants,
    terrain: race.terrain ?? null,
    meteo: race.meteo ?? null,
    lisibilite: analysis.prediction.lisibilite,
    score_lisibilite: analysis.prediction.scoreLisibilite,
    coefficient_lisibilite: analysis.prediction.coefficientLisibilite,
    decision_course: analysis.prediction.decisionCourse,
    updated_at: nowIso(),
  };
}

function normalizeErrorMessage(message: string) {
  return message.trim().slice(0, 1000);
}

function uniqReasonCodes(reasonCodes: string[]) {
  return [...new Set(reasonCodes.filter((value) => value.length > 0))];
}

export function buildRaceEngineRunRow(
  dateStr: string,
  race: RaceSummary,
  stage: ScoreStage,
  parameters: AlgoParameters,
  runnerCount: number
): RaceEngineRunRow {
  return {
    date: toIsoDate(dateStr),
    reunion: race.reunion,
    course: race.course,
    stage,
    segment_key: getRaceSegmentKey(race),
    engine_version: ENGINE_V6_VERSION,
    config_version: getEngineConfigVersion(parameters),
    runner_count: runnerCount,
    started_at: nowIso(),
    status: "RUNNING",
    lisibilite: null,
    score_lisibilite: null,
    decision_course: null,
    finished_at: null,
    error_message: null,
  };
}

export function buildRunnerFeatureSnapshots(
  runId: string,
  dateStr: string,
  race: RaceSummary,
  stage: ScoreStage,
  participants: Participant[],
  analysis: RaceAnalysis
): RunnerFeatureSnapshotRow[] {
  const date = toIsoDate(dateStr);
  const segmentKey = getRaceSegmentKey(race);
  const createdAt = nowIso();
  const participantByHorse = new Map(
    participants.map((participant) => [participant.numPmu, participant] as const)
  );

  return analysis.ranking.map((runner) => {
    const participant = participantByHorse.get(runner.numPmu);
    return {
      run_id: runId,
      date,
      reunion: race.reunion,
      course: race.course,
      stage,
      segment_key: segmentKey,
      cheval_num: runner.numPmu,
      cheval_nom: runner.nom,
      payload: {
        course: {
          hippodrome: race.hippodrome,
          discipline: race.discipline,
          distance: race.distance,
          allocation: race.allocation,
          nombrePartants: race.nombrePartants,
          estTrot: race.estTrot,
          estPlat: race.estPlat,
          estQuinte: race.estQuinte,
          terrain: race.terrain ?? null,
          meteo: race.meteo ?? null,
        },
        participant: participant
          ? {
              age: participant.age,
              sexe: participant.sexe,
              cote: participant.cote,
              coteMatin: participant.coteMatin ?? null,
              coteDepart: participant.coteDepart ?? null,
              variationCote: participant.variationCote ?? null,
              ferrure: participant.ferrure ?? null,
              poids: participant.poids ?? null,
              placeCorde: participant.placeCorde ?? null,
              stalle: participant.stalle ?? null,
              nombreCourses: participant.nombreCourses,
              nombreVictoires: participant.nombreVictoires,
              nombrePlaces: participant.nombrePlaces,
              gainCarriere: participant.gainCarriere,
              nombreSuiveurs: participant.nombreSuiveurs,
              daysSinceLastRun: participant.daysSinceLastRun ?? null,
              tauxFaute: participant.tauxFaute ?? null,
              terrainPreference: participant.terrainPreference ?? null,
              meteoPreference: participant.meteoPreference ?? null,
            }
          : null,
        musicStats: runner.musicStats,
        signaux: runner.signaux,
        expertPrediction: {
          scoreCheval: runner.prediction.scoreCheval,
          qualite: runner.prediction.qualite,
          confiance: runner.prediction.confiance,
          scoreFinalPari: runner.prediction.scoreFinalPari,
          top3Potential: runner.prediction.top3Potential,
          top5Potential: runner.prediction.top5Potential,
          objective: runner.prediction.objective,
          outsider: runner.prediction.outsider,
          valueBet: runner.prediction.valueBet,
          marketEdge: runner.prediction.marketEdge,
          kellyFraction: runner.prediction.kellyFraction,
          bankrollPct: runner.prediction.bankrollPct,
          miseBase100: runner.prediction.miseBase100,
          typePariConseille: runner.prediction.typePariConseille,
          topFacteurs: runner.prediction.topFacteurs,
        },
      },
      created_at: createdAt,
    };
  });
}

export function buildRunnerScoreSnapshots(
  runId: string,
  rows: PredictionRow[],
  analysis: RaceAnalysis
): RunnerScoreSnapshotRow[] {
  const createdAt = nowIso();
  const rankedByHorse = new Map(
    analysis.ranking.map((runner) => [runner.numPmu, runner] as const)
  );

  return rows.map((row) => {
    const runner = rankedByHorse.get(row.cheval_num);
    const value = analysis.valueTop5[row.cheval_num];
    const reasonCodes = uniqReasonCodes([
      row.decision,
      row.pari_conseille ?? "PLACE",
      row.lisibilite,
      row.outsider ? "OUTSIDER" : "",
      ...(runner?.prediction.topFacteurs ?? []).map((factor) =>
        factor
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^A-Za-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .toUpperCase()
      ),
    ]);

    return {
      run_id: runId,
      cheval_num: row.cheval_num,
      score_expert: row.score_cheval,
      score_lisibilite_adjusted: row.score_final_pari ?? row.score_cheval,
      proba_raw: runner?.prediction.probaEstimee ?? null,
      proba_calibrated: runner?.prediction.probaEstimee ?? null,
      market_edge: runner?.prediction.marketEdge ?? null,
      confidence_score: row.confiance ?? runner?.prediction.confiance ?? null,
      value_index: value?.valueIndex ?? row.value ?? null,
      decision: row.decision,
      bet_type: row.pari_conseille ?? runner?.prediction.typePariConseille ?? "PLACE",
      stake_base: runner?.prediction.miseBase100 ?? row.mise_simulee,
      stake_final: row.mise_simulee,
      blend_payload: {
        scoreCheval: row.score_cheval,
        scoreFinalPari: row.score_final_pari ?? null,
        lisibilite: row.lisibilite,
        coefficientLisibilite: row.coefficient_lisibilite ?? null,
        scoreConfiance: analysis.scoreConfiance?.score ?? null,
        recommendation: analysis.recommandation?.decision ?? null,
        topFacteurs: runner?.prediction.topFacteurs ?? [],
        valueLabel: value?.label ?? null,
        market: {
          coteMatin: row.cote_matin,
          coteDepart: row.cote_depart,
          variation: row.variation_cote,
          signalVariation: row.signal_variation,
        },
      },
      reason_codes: reasonCodes,
      created_at: createdAt,
    };
  });
}

export function buildRunnerMarketSnapshots(
  dateStr: string,
  race: RaceSummary,
  stage: ScoreStage,
  participants: Participant[]
): RunnerMarketSnapshotRow[] {
  const date = toIsoDate(dateStr);
  const createdAt = nowIso();

  return participants.map((participant) => ({
    date,
    reunion: race.reunion,
    course: race.course,
    cheval_num: participant.numPmu,
    snapshot_stage: stage,
    cote: participant.cote ?? participant.coteDepart ?? null,
    cote_reference: participant.coteMatin ?? participant.cote ?? null,
    variation_pct: participant.variationCote ?? null,
    signal_variation: participant.signalVariation ?? null,
    ferrure: participant.ferrure ?? null,
    created_at: createdAt,
  }));
}

export function buildRunnerOutcomeRows(
  dateStr: string,
  race: RaceSummary,
  participants: Participant[],
  reports: {
    simpleGagnant: Record<number, number | null | undefined>;
    simplePlace: Record<number, number | null | undefined>;
  }
): RunnerOutcomeRow[] {
  const date = toIsoDate(dateStr);
  const createdAt = nowIso();

  return participants.map((participant) => {
    const ordreArrivee =
      typeof participant.ordreArrivee === "number" ? participant.ordreArrivee : null;

    return {
      date,
      reunion: race.reunion,
      course: race.course,
      cheval_num: participant.numPmu,
      ordre_arrivee: ordreArrivee,
      resultat_gagnant: ordreArrivee === 1,
      resultat_place: ordreArrivee !== null && ordreArrivee <= 3,
      rapport_gagnant: reports.simpleGagnant[participant.numPmu] ?? null,
      rapport_place: reports.simplePlace[participant.numPmu] ?? null,
      non_partant: Boolean(participant.nonPartant),
      created_at: createdAt,
    };
  });
}

export async function createRaceEngineRun(row: RaceEngineRunRow) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("race_engine_runs")
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Race engine run insert failed: ${error?.message ?? "unknown error"}`);
  }

  return data as RaceEngineRunRow;
}

export async function completeRaceEngineRun(runId: string, analysis: RaceAnalysis) {
  const admin = getAdmin();
  const { error } = await admin
    .from("race_engine_runs")
    .update({
      lisibilite: analysis.prediction.lisibilite,
      score_lisibilite: analysis.prediction.scoreLisibilite,
      decision_course: analysis.prediction.decisionCourse,
      runner_count: analysis.ranking.length,
      status: "COMPLETED",
      finished_at: nowIso(),
      error_message: null,
    })
    .eq("id", runId);

  if (error) {
    throw new Error(`Race engine run completion failed: ${error.message}`);
  }
}

export async function failRaceEngineRun(runId: string, errorMessage: string) {
  const admin = getAdmin();
  const { error } = await admin
    .from("race_engine_runs")
    .update({
      status: "FAILED",
      finished_at: nowIso(),
      error_message: normalizeErrorMessage(errorMessage),
    })
    .eq("id", runId);

  if (error) {
    throw new Error(`Race engine run failure update failed: ${error.message}`);
  }
}

export async function upsertRunnerFeatureSnapshots(rows: RunnerFeatureSnapshotRow[]) {
  if (rows.length === 0) return;

  const admin = getAdmin();
  const { error } = await admin
    .from("runner_feature_snapshots")
    .upsert(rows, { onConflict: "run_id,cheval_num" });

  if (error) {
    throw new Error(`Runner feature snapshot upsert failed: ${error.message}`);
  }
}

export async function upsertRunnerScoreSnapshots(rows: RunnerScoreSnapshotRow[]) {
  if (rows.length === 0) return;

  const admin = getAdmin();
  const { error } = await admin
    .from("runner_score_snapshots")
    .upsert(rows, { onConflict: "run_id,cheval_num" });

  if (error) {
    throw new Error(`Runner score snapshot upsert failed: ${error.message}`);
  }
}

export async function upsertRunnerMarketSnapshots(rows: RunnerMarketSnapshotRow[]) {
  if (rows.length === 0) return;

  const admin = getAdmin();
  const { error } = await admin
    .from("runner_market_snapshots")
    .upsert(rows, {
      onConflict: "date,reunion,course,cheval_num,snapshot_stage",
    });

  if (error) {
    throw new Error(`Runner market snapshot upsert failed: ${error.message}`);
  }
}

export async function upsertRunnerOutcomes(rows: RunnerOutcomeRow[]) {
  if (rows.length === 0) return;

  const admin = getAdmin();
  const { error } = await admin
    .from("runner_outcomes")
    .upsert(rows, { onConflict: "date,reunion,course,cheval_num" });

  if (error) {
    throw new Error(`Runner outcomes upsert failed: ${error.message}`);
  }
}

export async function upsertPredictions(rows: PredictionRow[]) {
  if (rows.length === 0) return;

  const admin = getAdmin();
  const { error } = await admin
    .from("predictions")
    .upsert(rows, { onConflict: "date,reunion,course,cheval_num" });

  if (error) {
    throw new Error(`Prediction upsert failed: ${error.message}`);
  }
}

export async function upsertCourseRecord(row: CourseRecordRow) {
  const admin = getAdmin();
  const { error } = await admin.from("courses").upsert(row, {
    onConflict: "date,reunion,course",
  });

  if (error) {
    throw new Error(`Course upsert failed: ${error.message}`);
  }
}

export async function getRacePredictions(dateStr: string, reunion: number, course: number) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("predictions")
    .select("*")
    .eq("date", toIsoDate(dateStr))
    .eq("reunion", reunion)
    .eq("course", course)
    .order("score_final_pari", { ascending: false });

  if (error) {
    throw new Error(`Race prediction fetch failed: ${error.message}`);
  }

  return (data ?? []) as PredictionRow[];
}

export async function getCourseRecord(dateStr: string, reunion: number, course: number) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("courses")
    .select("*")
    .eq("date", toIsoDate(dateStr))
    .eq("reunion", reunion)
    .eq("course", course)
    .maybeSingle();

  if (error) {
    throw new Error(`Course fetch failed: ${error.message}`);
  }

  return (data ?? null) as CourseRecordRow | null;
}

export async function listPredictionsByDate(dateStr: string) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("predictions")
    .select("*")
    .eq("date", toIsoDate(dateStr))
    .order("reunion", { ascending: true })
    .order("course", { ascending: true })
    .order("score_final_pari", { ascending: false });

  if (error) {
    throw new Error(`Prediction list fetch failed: ${error.message}`);
  }

  return (data ?? []) as PredictionRow[];
}

export async function listPredictionsBetween(startIso: string, endIso: string) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("predictions")
    .select("*")
    .gte("date", startIso)
    .lte("date", endIso)
    .order("date", { ascending: true })
    .order("reunion", { ascending: true })
    .order("course", { ascending: true });

  if (error) {
    throw new Error(`Prediction range fetch failed: ${error.message}`);
  }

  return (data ?? []) as PredictionRow[];
}

export async function listCourseRecordsBetween(startIso: string, endIso: string) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("courses")
    .select("*")
    .gte("date", startIso)
    .lte("date", endIso)
    .order("date", { ascending: true })
    .order("reunion", { ascending: true })
    .order("course", { ascending: true });

  if (error) {
    throw new Error(`Course range fetch failed: ${error.message}`);
  }

  return (data ?? []) as CourseRecordRow[];
}

export async function replaceActiveSegmentCalibration(row: SegmentCalibrationRow) {
  const admin = getAdmin();

  const { error: deactivateError } = await admin
    .from("segment_calibrations")
    .update({ is_active: false })
    .eq("segment_key", row.segment_key)
    .eq("stage", row.stage)
    .eq("is_active", true);

  if (deactivateError) {
    throw new Error(
      `Segment calibration deactivate failed: ${deactivateError.message}`
    );
  }

  const insertRow = {
    ...row,
    is_active: true,
    created_at: row.created_at ?? nowIso(),
  };

  const { data, error } = await admin
    .from("segment_calibrations")
    .insert(insertRow)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Segment calibration insert failed: ${error?.message ?? "unknown error"}`
    );
  }

  return data as SegmentCalibrationRow;
}

export async function listActiveSegmentCalibrations(stage: ScoreStage = "MATIN") {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("segment_calibrations")
    .select("*")
    .eq("stage", stage)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Active segment calibration fetch failed: ${error.message}`);
  }

  return (data ?? []) as SegmentCalibrationRow[];
}

export async function listRaceEngineRunsBetween(
  startIso: string,
  endIso: string,
  stage: ScoreStage = "MATIN"
) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("race_engine_runs")
    .select("*")
    .eq("stage", stage)
    .eq("status", "COMPLETED")
    .gte("date", startIso)
    .lte("date", endIso)
    .order("date", { ascending: true })
    .order("reunion", { ascending: true })
    .order("course", { ascending: true });

  if (error) {
    throw new Error(`Race engine runs range fetch failed: ${error.message}`);
  }

  return (data ?? []) as RaceEngineRunRow[];
}

export async function listRunnerScoreSnapshotsByRunIds(runIds: string[]) {
  if (runIds.length === 0) {
    return [] as RunnerScoreSnapshotRow[];
  }

  const admin = getAdmin();
  const chunkSize = 200;
  const rows: RunnerScoreSnapshotRow[] = [];

  for (let index = 0; index < runIds.length; index += chunkSize) {
    const chunk = runIds.slice(index, index + chunkSize);
    const { data, error } = await admin
      .from("runner_score_snapshots")
      .select("*")
      .in("run_id", chunk)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Runner score snapshots by run ids fetch failed: ${error.message}`);
    }

    rows.push(...((data ?? []) as RunnerScoreSnapshotRow[]));
  }

  rows.sort((left, right) => {
    if ((left.created_at ?? "") < (right.created_at ?? "")) return -1;
    if ((left.created_at ?? "") > (right.created_at ?? "")) return 1;
    return 0;
  });

  return rows;
}

export async function listRunnerOutcomesBetween(startIso: string, endIso: string) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("runner_outcomes")
    .select("*")
    .gte("date", startIso)
    .lte("date", endIso)
    .order("date", { ascending: true })
    .order("reunion", { ascending: true })
    .order("course", { ascending: true });

  if (error) {
    throw new Error(`Runner outcomes range fetch failed: ${error.message}`);
  }

  return (data ?? []) as RunnerOutcomeRow[];
}

export async function upsertSegmentLearningState(row: SegmentLearningStateRow) {
  const admin = getAdmin();
  const payload = {
    ...row,
    updated_at: row.updated_at ?? nowIso(),
  };

  const { error } = await admin.from("segment_learning_state").upsert(payload, {
    onConflict: "segment_key,stage",
  });

  if (error) {
    throw new Error(`Segment learning state upsert failed: ${error.message}`);
  }
}

export async function upsertEngineCandidate(row: EngineCandidateRow) {
  const admin = getAdmin();
  const payload = {
    ...row,
    summary: row.summary ?? {},
  };

  const { data, error } = await admin
    .from("engine_candidates")
    .upsert(payload, { onConflict: "segment_key,stage,engine_version" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Engine candidate upsert failed: ${error?.message ?? "unknown error"}`);
  }

  return data as EngineCandidateRow;
}

export async function upsertEngineCandidateMetrics(rows: EngineCandidateMetricRow[]) {
  if (rows.length === 0) return;

  const admin = getAdmin();
  const { error } = await admin.from("engine_candidate_metrics").upsert(rows, {
    onConflict: "candidate_id,dataset_role,window_start,window_end",
  });

  if (error) {
    throw new Error(`Engine candidate metrics upsert failed: ${error.message}`);
  }
}

export async function listEngineCandidatesByStatus(
  status: EngineCandidateRow["status"],
  stage: ScoreStage = "MATIN"
) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("engine_candidates")
    .select("*")
    .eq("status", status)
    .eq("stage", stage)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Engine candidates by status fetch failed: ${error.message}`);
  }

  return (data ?? []) as EngineCandidateRow[];
}

export async function listEngineCandidateMetricsByCandidateIds(candidateIds: string[]) {
  if (candidateIds.length === 0) {
    return [] as EngineCandidateMetricRow[];
  }

  const admin = getAdmin();
  const { data, error } = await admin
    .from("engine_candidate_metrics")
    .select("*")
    .in("candidate_id", candidateIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Engine candidate metrics fetch failed: ${error.message}`);
  }

  return (data ?? []) as EngineCandidateMetricRow[];
}

export async function updateEngineCandidateStatus(
  candidateId: string,
  status: EngineCandidateRow["status"],
  promotedAt?: string | null
) {
  const admin = getAdmin();
  const payload: Record<string, unknown> = { status };
  if (promotedAt !== undefined) {
    payload.promoted_at = promotedAt;
  }

  const { error } = await admin
    .from("engine_candidates")
    .update(payload)
    .eq("id", candidateId);

  if (error) {
    throw new Error(`Engine candidate status update failed: ${error.message}`);
  }
}

export async function insertEnginePromotion(row: EnginePromotionRow) {
  const admin = getAdmin();
  const payload = {
    ...row,
    decided_at: row.decided_at ?? nowIso(),
  };

  const { error } = await admin.from("engine_promotions").insert(payload);
  if (error) {
    throw new Error(`Engine promotion insert failed: ${error.message}`);
  }
}

export async function getLatestActiveSegmentCalibration(
  segmentKey: SegmentCalibrationRow["segment_key"],
  stage: ScoreStage = "MATIN"
) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("segment_calibrations")
    .select("*")
    .eq("segment_key", segmentKey)
    .eq("stage", stage)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (error) {
    throw new Error(`Latest active segment calibration fetch failed: ${error.message}`);
  }

  return (data ?? null) as SegmentCalibrationRow | null;
}

/** Fenêtre glissante pour le dashboard historique du bilan (évite listPredictionsBetween sur des décennies). */
export const BILAN_DASHBOARD_HISTORY_DAYS_DEFAULT = 548;
/** @deprecated alias — utiliser BILAN_DASHBOARD_HISTORY_DAYS_DEFAULT */
export const BILAN_DASHBOARD_HISTORY_DAYS = BILAN_DASHBOARD_HISTORY_DAYS_DEFAULT;
export const BILAN_DASHBOARD_HISTORY_DAYS_MIN = 30;
export const BILAN_DASHBOARD_HISTORY_DAYS_MAX = 1095;

export function getBilanDashboardHistoryRange(
  now: Date = new Date(),
  requestedDays: number = BILAN_DASHBOARD_HISTORY_DAYS_DEFAULT
): { startIso: string; endIso: string; historyDaysUsed: number } {
  const historyDaysUsed = Math.min(
    BILAN_DASHBOARD_HISTORY_DAYS_MAX,
    Math.max(BILAN_DASHBOARD_HISTORY_DAYS_MIN, Math.floor(Math.abs(requestedDays)))
  );
  const endIso = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime());
  start.setUTCDate(start.getUTCDate() - historyDaysUsed);
  const startIso = start.toISOString().slice(0, 10);
  return { startIso, endIso, historyDaysUsed };
}
