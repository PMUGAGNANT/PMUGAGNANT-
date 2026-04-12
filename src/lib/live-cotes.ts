import { getRaceTimestamp, toIsoDate } from "@/lib/date-utils";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Participant, RaceSummary } from "@/lib/types";

const MAX_LIVE_LINES = 5;
const SNAPSHOT_INTERVAL_MINUTES = 15;
const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

export interface LiveCotePoint {
  captured_at: string;
  cote: number;
}

export interface LiveCotesSeries {
  cheval_num: number;
  cheval_nom: string;
  points: LiveCotePoint[];
}

interface CoteSnapshotRow {
  cheval_num: number;
  cote: number;
  captured_at: string;
}

function getParticipantCote(participant: Participant) {
  const cote = participant.cote ?? participant.coteDepart ?? participant.coteMatin ?? null;
  return typeof cote === "number" && Number.isFinite(cote) && cote > 0 ? cote : null;
}

function getTopHorseNumbers(participants: Participant[], topHorseNums?: number[]) {
  const requested = (topHorseNums ?? [])
    .filter((value) => Number.isInteger(value) && value > 0)
    .slice(0, MAX_LIVE_LINES);

  if (requested.length > 0) {
    return requested;
  }

  return participants
    .filter((participant) => !participant.nonPartant && getParticipantCote(participant) !== null)
    .sort(
      (left, right) =>
        (getParticipantCote(left) ?? Number.POSITIVE_INFINITY) -
          (getParticipantCote(right) ?? Number.POSITIVE_INFINITY) ||
        left.numPmu - right.numPmu
    )
    .slice(0, MAX_LIVE_LINES)
    .map((participant) => participant.numPmu);
}

export async function snapshotLiveCotes(
  dateStr: string,
  race: RaceSummary,
  participants: Participant[],
  capturedAt = new Date()
) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { inserted: 0, skipped: true };
  }

  const date = toIsoDate(dateStr);
  const recentlyCapturedAfter = new Date(
    capturedAt.getTime() - (SNAPSHOT_INTERVAL_MINUTES - 1) * 60_000
  ).toISOString();

  const { data: recentSnapshots, error: lookupError } = await admin
    .from("cotes_snapshots")
    .select("id")
    .eq("date", date)
    .eq("reunion", race.reunion)
    .eq("course", race.course)
    .gte("captured_at", recentlyCapturedAfter)
    .limit(1);

  if (lookupError) {
    throw new Error(`Live odds snapshot lookup failed: ${lookupError.message}`);
  }

  if ((recentSnapshots ?? []).length > 0) {
    return { inserted: 0, skipped: true };
  }

  const captured_at = capturedAt.toISOString();
  const rows = participants
    .filter((participant) => !participant.nonPartant)
    .map((participant) => {
      const cote = getParticipantCote(participant);
      return cote === null
        ? null
        : {
            date,
            reunion: race.reunion,
            course: race.course,
            cheval_num: participant.numPmu,
            cote,
            captured_at,
          };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) {
    return { inserted: 0, skipped: true };
  }

  const { error } = await admin.from("cotes_snapshots").insert(rows);
  if (error) {
    throw new Error(`Live odds snapshot insert failed: ${error.message}`);
  }

  return { inserted: rows.length, skipped: false };
}

export async function getLiveCotesSeries(
  dateStr: string,
  race: RaceSummary,
  participants: Participant[],
  topHorseNums?: number[]
): Promise<LiveCotesSeries[]> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return [];
  }

  const horseNums = getTopHorseNumbers(participants, topHorseNums);
  if (horseNums.length === 0) {
    return [];
  }

  const raceTime = getRaceTimestamp(dateStr, race.heureDepart);
  const windowStart = new Date(raceTime.getTime() - LIVE_WINDOW_MS);
  const participantByNumber = new Map(
    participants.map((participant) => [participant.numPmu, participant] as const)
  );

  const { data, error } = await admin
    .from("cotes_snapshots")
    .select("cheval_num,cote,captured_at")
    .eq("date", toIsoDate(dateStr))
    .eq("reunion", race.reunion)
    .eq("course", race.course)
    .in("cheval_num", horseNums)
    .gte("captured_at", windowStart.toISOString())
    .lte("captured_at", raceTime.toISOString())
    .order("captured_at", { ascending: true });

  if (error) {
    throw new Error(`Live odds series fetch failed: ${error.message}`);
  }

  const grouped = new Map<number, LiveCotePoint[]>();
  for (const row of (data ?? []) as CoteSnapshotRow[]) {
    const points = grouped.get(row.cheval_num) ?? [];
    points.push({
      captured_at: row.captured_at,
      cote: row.cote,
    });
    grouped.set(row.cheval_num, points);
  }

  return horseNums
    .map((cheval_num) => ({
      cheval_num,
      cheval_nom: participantByNumber.get(cheval_num)?.nom ?? `Cheval ${cheval_num}`,
      points: grouped.get(cheval_num) ?? [],
    }))
    .filter((serie) => serie.points.length > 0);
}
