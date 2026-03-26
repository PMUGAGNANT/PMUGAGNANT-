import { NextRequest, NextResponse } from "next/server";
import { ensureCronAuthorized } from "@/lib/cron-auth";
import { getTodayDateStr } from "@/lib/pmu-api";
import { runMorningAnalysis } from "@/lib/prediction-pipeline";
import { badRequest, serverError } from "@/lib/api-response";
import { normalizeRequestedDate } from "@/lib/request-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const date = normalizeRequestedDate(url.searchParams.get("date"), getTodayDateStr());
  if (!date) {
    return badRequest("Invalid date format. Expected DDMMYYYY.");
  }

  try {
    const summary = await runMorningAnalysis(date);
    return NextResponse.json(summary);
  } catch (error) {
    return serverError("Morning cron failed", error, { date });
  }
}
