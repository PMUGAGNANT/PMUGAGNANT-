import { NextRequest } from "next/server";
import { runCronRoute } from "@/lib/cron-execution";
import { runWeeklyReport } from "@/lib/weekly-reports";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return runCronRoute(request, "/api/cron/weekly", async () => {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const parsedDate = date ? new Date(date) : undefined;

    if (parsedDate && Number.isNaN(parsedDate.getTime())) {
      throw new Error("Invalid date format. Expected ISO date.");
    }

    return runWeeklyReport(parsedDate);
  });
}
