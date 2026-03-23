import { toIsoDate } from "@/lib/date-utils";
import { getSupabaseAdminClient, getSupabaseAdminConfigError } from "@/lib/supabase";
import type {
  CourseRecordRow,
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
