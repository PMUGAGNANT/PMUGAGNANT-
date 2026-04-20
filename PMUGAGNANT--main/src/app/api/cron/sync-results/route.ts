import { NextRequest } from "next/server";
import { getMinutesUntilStart } from "@/lib/date-utils";
import { runCronRoute } from "@/lib/cron-execution";
import {
  getAllRaces,
  getArriveeCourse,
  getRapportsCourse,
  getTodayDateStr,
} from "@/lib/pmu-api";
import { saveRunnerOutcome } from "@/lib/prediction-store";
import { normalizeRequestedDate } from "@/lib/request-utils";
import { logger } from "@/lib/server-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isRecentFinishedRace(race: { heureDepart: string; dateStr: string }) {
  const minutesUntilStart = getMinutesUntilStart(race.heureDepart, race.dateStr);
  return minutesUntilStart <= -10 && minutesUntilStart >= -120;
}

export async function GET(request: NextRequest) {
  return runCronRoute(request, "/api/cron/sync-results", async () => {
    const url = new URL(request.url);
    const date = normalizeRequestedDate(url.searchParams.get("date"), getTodayDateStr());
    if (!date) throw new Error("Invalid date format. Expected DDMMYYYY.");

    const races = (await getAllRaces(date)).filter(isRecentFinishedRace);
    const processed = [];
    let outcomesStored = 0;

    for (const race of races) {
      try {
        const [arrivee, reports] = await Promise.all([
          getArriveeCourse(date, race.reunion, race.course),
          getRapportsCourse(date, race.reunion, race.course),
        ]);
        const saved = await saveRunnerOutcome(
          date,
          race.reunion,
          race.course,
          arrivee,
          reports
        );
        outcomesStored += saved.saved;
        processed.push({
          reunion: race.reunion,
          course: race.course,
          hippodrome: race.hippodrome,
          outcomes: saved.saved,
        });
      } catch (error) {
        logger.warn("cron.sync_results.race_failed", {
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
      coursesProcessed: processed.length,
      outcomesStored,
      processed,
    };
  });
}
