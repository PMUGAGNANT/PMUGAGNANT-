import { NextRequest } from "next/server";
import { runCronRoute } from "@/lib/cron-execution";
import { syncProgramToSupabase } from "@/lib/cron-program-sync";
import { getAllRaces, getParticipants, getTodayDateStr } from "@/lib/pmu-api";
import {
  buildRunnerMarketSnapshots,
  upsertRunnerMarketSnapshots,
} from "@/lib/prediction-store";
import { runPreRaceSecondPass } from "@/lib/prediction-pipeline";
import { normalizeRequestedDate } from "@/lib/request-utils";
import { logger } from "@/lib/server-logger";
import type { RaceSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function processParticipantBatch(date: string, races: RaceSummary[]) {
  const results = await Promise.allSettled(
    races.map(async (race) => {
      const participants = await getParticipants(date, race.reunion, race.course);
      const snapshots = buildRunnerMarketSnapshots(date, race, "MATIN", participants);
      await upsertRunnerMarketSnapshots(snapshots);
      return {
        reunion: race.reunion,
        course: race.course,
        hippodrome: race.hippodrome,
        participants: participants.length,
      };
    })
  );

  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

export async function GET(request: NextRequest) {
  return runCronRoute(request, "/api/cron/sync-programme", async () => {
    const url = new URL(request.url);
    const date = normalizeRequestedDate(url.searchParams.get("date"), getTodayDateStr());
    if (!date) throw new Error("Invalid date format. Expected DDMMYYYY.");

    const [program, races] = await Promise.all([
      syncProgramToSupabase(date),
      getAllRaces(date),
    ]);

    const participantResults = [];
    const batchSize = 4;
    for (let index = 0; index < races.length; index += batchSize) {
      participantResults.push(
        ...(await processParticipantBatch(date, races.slice(index, index + batchSize)))
      );
    }

    const quinteRaces = races.filter((race) => race.estQuinte);
    const scoredQuintes = [];
    for (const race of quinteRaces) {
      try {
        const summary = await runPreRaceSecondPass(date, {
          reunion: race.reunion,
          course: race.course,
        });
        scoredQuintes.push({
          reunion: race.reunion,
          course: race.course,
          hippodrome: race.hippodrome,
          summary,
        });
      } catch (error) {
        logger.warn("cron.sync_programme.quinte_scoring_failed", {
          date,
          reunion: race.reunion,
          course: race.course,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      date,
      coursesProcessed: races.length,
      programme: program,
      participantsStored: participantResults.reduce((sum, row) => sum + row.participants, 0),
      participantResults,
      quinteRaces: quinteRaces.length,
      quintesScored: scoredQuintes.length,
      scoredQuintes,
      races: races.map((race) => ({
        reunion: race.reunion,
        course: race.course,
        hippodrome: race.hippodrome,
        nomCourse: race.nomCourse,
        heureDepart: race.heureDepart,
        estQuinte: race.estQuinte,
      })),
    };
  });
}
