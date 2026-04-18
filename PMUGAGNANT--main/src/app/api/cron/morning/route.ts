import { NextRequest } from "next/server";
import { runCronRoute } from "@/lib/cron-execution";
import { getTodayDateStr } from "@/lib/pmu-api";
import { runCronMorningJob } from "@/lib/cron-jobs";
import { normalizeRequestedDate } from "@/lib/request-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return runCronRoute(request, "/api/cron/morning", async () => {
    const url = new URL(request.url);
    const date = normalizeRequestedDate(url.searchParams.get("date"), getTodayDateStr());

    if (!date) {
      throw new Error("Invalid date format. Expected DDMMYYYY.");
    }

    return runCronMorningJob(date);
  });
}
