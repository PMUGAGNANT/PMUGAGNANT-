import { NextRequest, NextResponse } from "next/server";
import { ensureCronAuthorized } from "@/lib/cron-auth";
import { runWeeklyReport } from "@/lib/weekly-reports";
import { badRequest, serverError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const parsedDate = date ? new Date(date) : undefined;
  if (parsedDate && Number.isNaN(parsedDate.getTime())) {
    return badRequest("Invalid date format. Expected ISO date.");
  }

  try {
    const summary = await runWeeklyReport(parsedDate);
    return NextResponse.json(summary);
  } catch (error) {
    return serverError("Weekly cron failed", error, { date });
  }
}
