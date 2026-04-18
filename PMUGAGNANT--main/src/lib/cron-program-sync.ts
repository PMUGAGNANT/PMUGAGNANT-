import { toIsoDate } from "@/lib/date-utils";
import { getAllRaces } from "@/lib/pmu-api";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { RaceSummary } from "@/lib/types";

interface CourseMirrorRow {
  date: string;
  reunion: number;
  course: number;
  hippodrome: string;
  nom_course: string;
  heure_depart: string;
  discipline: string;
  allocation: number;
  distance: number;
  nombre_partants: number;
  terrain: string | null;
  meteo: string | null;
  lisibilite: null;
  score_lisibilite: null;
  coefficient_lisibilite: null;
  decision_course: null;
  updated_at: string;
}

export interface ProgramSyncSummary {
  date: string;
  racesFetched: number;
  racesUpserted: number;
  coursesUpserted: number;
  runnersFetched: number;
  runnersUpserted: number;
  runnerFetchErrors: number;
  supabaseSkipped: boolean;
}

function raceToCourseRow(
  dateStr: string,
  race: RaceSummary,
  updatedAt: string
): CourseMirrorRow {
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
    lisibilite: null,
    score_lisibilite: null,
    coefficient_lisibilite: null,
    decision_course: null,
    updated_at: updatedAt,
  };
}

async function upsertCourseRows(rows: CourseMirrorRow[]) {
  if (rows.length === 0) {
    return;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return;
  }

  const { error } = await admin.from("courses").upsert(rows, {
    onConflict: "date,reunion,course",
  });

  if (error) {
    throw new Error(`Course upsert failed during cron program sync: ${error.message}`);
  }
}

export async function syncProgramToSupabase(dateStr: string): Promise<ProgramSyncSummary> {
  const admin = getSupabaseAdminClient();
  const updatedAt = new Date().toISOString();
  const races = await getAllRaces(dateStr);

  if (admin) {
    await upsertCourseRows(races.map((race) => raceToCourseRow(dateStr, race, updatedAt)));
  }

  return {
    date: dateStr,
    racesFetched: races.length,
    racesUpserted: admin ? races.length : 0,
    coursesUpserted: admin ? races.length : 0,
    runnersFetched: 0,
    runnersUpserted: 0,
    runnerFetchErrors: 0,
    supabaseSkipped: !admin,
  };
}
