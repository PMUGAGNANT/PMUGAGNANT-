import { NextRequest } from "next/server";
import { runCronRoute } from "@/lib/cron-execution";
import { runCronMorningJob, runCronPreRaceJob, runCronResultsJob } from "@/lib/cron-jobs";
import { runEngineLearning } from "@/lib/engine-learning";
import { runEnginePromotion } from "@/lib/engine-promotion";
import { getTodayDateStr } from "@/lib/pmu-api";
import { runWeeklyReport } from "@/lib/weekly-reports";
import { logger } from "@/lib/server-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getParisScheduleParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);

  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
    weekday: parts.find((part) => part.type === "weekday")?.value ?? "",
  };
}

async function captureStep<T>(
  name: string,
  results: Record<string, unknown>,
  worker: () => Promise<T>
) {
  try {
    results[name] = await worker();
  } catch (error) {
    logger.error(`cron.dispatch.${name}_failed`, error);
    results[name] = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(request: NextRequest) {
  return runCronRoute(request, "/api/cron", async () => {
    const now = new Date();
    const { hour, minute, weekday } = getParisScheduleParts(now);
    const date = getTodayDateStr();
    const results: Record<string, unknown> = {
      dispatchedAt: now.toISOString(),
      parisTime: `${hour}:${String(minute).padStart(2, "0")}`,
    };

    if (hour === 7 && minute < 5) {
      await captureStep("morning", results, () => runCronMorningJob(date));
    }

    await captureStep("preRace", results, () => runCronPreRaceJob(date));

    if (minute % 10 < 5) {
      await captureStep("results", results, () => runCronResultsJob(date));
    }

    if (hour === 4 && minute < 5) {
      await captureStep("learning", results, () => runEngineLearning(now));
      if (
        typeof results.learning === "object" &&
        results.learning !== null &&
        (results.learning as Record<string, unknown>).success === false
      ) {
        results.promotion = {
          skipped: true,
          reason: "learning-failed",
        };
      } else {
        await captureStep("promotion", results, () => runEnginePromotion(now));
      }
    }

    if (weekday === "Sun" && hour === 19 && minute < 5) {
      await captureStep("weekly", results, () => runWeeklyReport());
    }

    return {
      coursesProcessed:
        typeof (results.preRace as Record<string, unknown> | undefined)?.coursesProcessed ===
        "number"
          ? ((results.preRace as Record<string, unknown>).coursesProcessed as number)
          : 0,
      results,
    };
  });
}
