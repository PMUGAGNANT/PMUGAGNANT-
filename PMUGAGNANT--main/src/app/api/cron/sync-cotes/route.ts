import { NextRequest } from "next/server";
import { getMinutesUntilStart } from "@/lib/date-utils";
import { runCronRoute } from "@/lib/cron-execution";
import {
  getAllRaces,
  getCotesDirectes,
  getParticipants,
  getTodayDateStr,
} from "@/lib/pmu-api";
import {
  buildRunnerMarketSnapshots,
  upsertRunnerMarketSnapshots,
} from "@/lib/prediction-store";
import { normalizeRequestedDate } from "@/lib/request-utils";
import { logger } from "@/lib/server-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isLiveOddsCandidate(race: { heureDepart: string; dateStr: string }) {
  const minutesUntilStart = getMinutesUntilStart(race.heureDepart, race.dateStr);
  return minutesUntilStart >= 0 && minutesUntilStart <= 120;
}

export async function GET(request: NextRequest) {
  return runCronRoute(request, "/api/cron/sync-cotes", async () => {
    const url = new URL(request.url);
    const date = normalizeRequestedDate(url.searchParams.get("date"), getTodayDateStr());
    if (!date) throw new Error("Invalid date format. Expected DDMMYYYY.");

    const races = (await getAllRaces(date)).filter(isLiveOddsCandidate);
    const results = [];
    let snapshotsStored = 0;

    for (const race of races) {
      try {
        const [participants, liveOdds] = await Promise.all([
          getParticipants(date, race.reunion, race.course),
          getCotesDirectes(date, race.reunion, race.course),
        ]);
        const participantsWithLiveOdds = liveOdds
          ? participants.map((participant) => ({
              ...participant,
              cote: liveOdds.get(participant.numPmu) ?? participant.cote,
            }))
          : participants;
        const snapshots = buildRunnerMarketSnapshots(
          date,
          race,
          "T10",
          participantsWithLiveOdds
        );
        await upsertRunnerMarketSnapshots(snapshots);
        snapshotsStored += snapshots.length;
        results.push({
          reunion: race.reunion,
          course: race.course,
          hippodrome: race.hippodrome,
          snapshots: snapshots.length,
        });
      } catch (error) {
        logger.warn("cron.sync_cotes.race_failed", {
          date,
          reunion: race.reunion,
          course: race.course,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      date,
      coursesConsidered: races.length,
      coursesUpdated: results.length,
      snapshotsStored,
      results,
    };
  });
}
