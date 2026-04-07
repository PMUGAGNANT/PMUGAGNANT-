import { toIsoDate } from "@/lib/date-utils";
import { getSupabaseAdminClient, getSupabaseAdminConfigError } from "@/lib/supabase";
import type {
  CourseRecordRow,
  PredictionStageSnapshotRow,
  PredictionRow,
  RaceAnalysis,
  RaceSummary,
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

function isMissingRelationError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) {
    return false;
  }

  return error.code === "42P01" || error.message?.toLowerCase().includes("prediction_stage_snapshots") === true;
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

export function buildPredictionStageSnapshot(
  dateStr: string,
  race: RaceSummary,
  analysis: RaceAnalysis,
  rows: PredictionRow[],
  stage: ScoreStage,
  notes: string[] = []
): PredictionStageSnapshotRow {
  const ranking = analysis.ranking ?? [];
  const selection =
    rows.find((row) => row.decision === "VALIDE") ??
    rows.find((row) => row.decision === "SURVEILLANCE") ??
    rows[0] ??
    null;
  const favori = analysis.favori ?? ranking[0] ?? null;
  const marketFavorite = rows
    .filter((row) => {
      const currentOdds = row.cote_depart ?? row.cote_matin;
      return currentOdds !== null && Number.isFinite(currentOdds) && currentOdds > 0;
    })
    .slice()
    .sort((left, right) => (left.cote_depart ?? left.cote_matin ?? 999) - (right.cote_depart ?? right.cote_matin ?? 999))[0] ?? null;

  return {
    date: toIsoDate(dateStr),
    reunion: race.reunion,
    course: race.course,
    stage,
    hippodrome: race.hippodrome,
    lisibilite: analysis.prediction.lisibilite,
    score_lisibilite: analysis.prediction.scoreLisibilite,
    coefficient_lisibilite: analysis.prediction.coefficientLisibilite,
    decision_course: analysis.prediction.decisionCourse,
    selection_num: selection?.cheval_num ?? null,
    selection_nom: selection?.cheval_nom ?? null,
    selection_decision: selection?.decision ?? null,
    selection_confiance: selection?.confiance ?? null,
    selection_pari: selection?.pari_conseille ?? null,
    selection_cote: selection?.cote_depart ?? selection?.cote_matin ?? null,
    favori_num: favori?.numPmu ?? null,
    favori_nom: favori?.nom ?? null,
    favori_cote: favori?.cote ?? favori?.coteMatin ?? null,
    market_favorite_num: marketFavorite?.cheval_num ?? null,
    market_favorite_nom: marketFavorite?.cheval_nom ?? null,
    market_favorite_cote: marketFavorite?.cote_depart ?? marketFavorite?.cote_matin ?? null,
    notes: notes.length > 0 ? notes : null,
    updated_at: nowIso(),
  };
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

export async function upsertPredictionStageSnapshot(row: PredictionStageSnapshotRow) {
  const admin = getAdmin();
  const { error } = await admin.from("prediction_stage_snapshots").upsert(row, {
    onConflict: "date,reunion,course,stage",
  });

  if (isMissingRelationError(error)) {
    return;
  }

  if (error) {
    throw new Error(`Prediction stage snapshot upsert failed: ${error.message}`);
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

export async function listPredictionStageSnapshots(dateStr: string, reunion: number, course: number) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("prediction_stage_snapshots")
    .select("*")
    .eq("date", toIsoDate(dateStr))
    .eq("reunion", reunion)
    .eq("course", course)
    .order("updated_at", { ascending: true });

  if (isMissingRelationError(error)) {
    return [] as PredictionStageSnapshotRow[];
  }

  if (error) {
    throw new Error(`Prediction stage snapshot fetch failed: ${error.message}`);
  }

  return (data ?? []) as PredictionStageSnapshotRow[];
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
