import { toIsoDate } from "@/lib/date-utils";
import { getAllRaces, getParticipants } from "@/lib/pmu-api";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/server-logger";
import type { Participant, RaceSummary } from "@/lib/types";

const SYNC_BATCH_SIZE = 4;

interface RaceMirrorRow {
  race_date: string;
  date_str: string;
  reunion: number;
  course: number;
  hippodrome: string;
  pays: string;
  nom_course: string;
  heure_depart: string;
  discipline: string;
  est_trot: boolean;
  est_plat: boolean;
  est_quinte: boolean;
  allocation: number;
  distance: number;
  nombre_partants: number;
  terrain: string | null;
  meteo: string | null;
  updated_at: string;
}

interface RunnerMirrorRow {
  race_date: string;
  date_str: string;
  reunion: number;
  course: number;
  cheval_num: number;
  cheval_nom: string;
  jockey: string | null;
  driver: string | null;
  entraineur: string | null;
  age: number | null;
  sexe: string | null;
  cote: number | null;
  cote_matin: number | null;
  musique: string | null;
  statut: string | null;
  non_partant: boolean;
  updated_at: string;
}

export interface ProgramSyncSummary {
  date: string;
  racesFetched: number;
  racesUpserted: number;
  runnersFetched: number;
  runnersUpserted: number;
  runnerFetchErrors: number;
  supabaseSkipped: boolean;
}

function raceToRow(dateStr: string, race: RaceSummary, updatedAt: string): RaceMirrorRow {
  return {
    race_date: toIsoDate(dateStr),
    date_str: dateStr,
    reunion: race.reunion,
    course: race.course,
    hippodrome: race.hippodrome,
    pays: race.pays,
    nom_course: race.nomCourse,
    heure_depart: race.heureDepart,
    discipline: race.discipline,
    est_trot: race.estTrot,
    est_plat: race.estPlat,
    est_quinte: race.estQuinte,
    allocation: race.allocation,
    distance: race.distance,
    nombre_partants: race.nombrePartants,
    terrain: race.terrain ?? null,
    meteo: race.meteo ?? null,
    updated_at: updatedAt,
  };
}

function runnerToRow(
  dateStr: string,
  race: RaceSummary,
  participant: Participant,
  updatedAt: string
): RunnerMirrorRow {
  return {
    race_date: toIsoDate(dateStr),
    date_str: dateStr,
    reunion: race.reunion,
    course: race.course,
    cheval_num: participant.numPmu,
    cheval_nom: participant.nom,
    jockey: participant.jockey || null,
    driver: participant.driver || null,
    entraineur: participant.entraineur || null,
    age: Number.isFinite(participant.age) ? participant.age : null,
    sexe: participant.sexe || null,
    cote: participant.cote ?? participant.coteDepart ?? null,
    cote_matin: participant.coteMatin ?? participant.cote ?? null,
    musique: participant.musique || null,
    statut: participant.statut || null,
    non_partant: Boolean(participant.nonPartant),
    updated_at: updatedAt,
  };
}

async function upsertRaceRows(rows: RaceMirrorRow[]) {
  if (rows.length === 0) {
    return;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return;
  }

  const { error } = await admin.from("races").upsert(rows, {
    onConflict: "race_date,reunion,course",
  });

  if (error) {
    throw new Error(`Race mirror upsert failed: ${error.message}`);
  }
}

async function upsertRunnerRows(rows: RunnerMirrorRow[]) {
  if (rows.length === 0) {
    return;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return;
  }

  const { error } = await admin.from("runners").upsert(rows, {
    onConflict: "race_date,reunion,course,cheval_num",
  });

  if (error) {
    throw new Error(`Runner mirror upsert failed: ${error.message}`);
  }
}

export async function syncProgramToSupabase(dateStr: string): Promise<ProgramSyncSummary> {
  const admin = getSupabaseAdminClient();
  const updatedAt = new Date().toISOString();
  const races = await getAllRaces(dateStr);

  if (admin) {
    await upsertRaceRows(races.map((race) => raceToRow(dateStr, race, updatedAt)));
  }

  let runnersFetched = 0;
  let runnerFetchErrors = 0;

  for (let index = 0; index < races.length; index += SYNC_BATCH_SIZE) {
    const batch = races.slice(index, index + SYNC_BATCH_SIZE);
    const batchRows = await Promise.all(
      batch.map(async (race) => {
        try {
          const participants = await getParticipants(dateStr, race.reunion, race.course);
          runnersFetched += participants.length;
          return participants.map((participant) =>
            runnerToRow(dateStr, race, participant, updatedAt)
          );
        } catch (error) {
          runnerFetchErrors += 1;
          logger.error("cron.program_sync.runners_failed", error, {
            dateStr,
            reunion: race.reunion,
            course: race.course,
          });
          return [] as RunnerMirrorRow[];
        }
      })
    );

    if (admin) {
      await upsertRunnerRows(batchRows.flat());
    }
  }

  return {
    date: dateStr,
    racesFetched: races.length,
    racesUpserted: admin ? races.length : 0,
    runnersFetched,
    runnersUpserted: admin ? runnersFetched : 0,
    runnerFetchErrors,
    supabaseSkipped: !admin,
  };
}
