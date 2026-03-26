import { NextRequest, NextResponse } from "next/server";
import { ensureCronAuthorized } from "@/lib/cron-auth";
import { getTodayDateStr } from "@/lib/pmu-api";
import { runPreRaceSecondPass } from "@/lib/prediction-pipeline";
import { badRequest, serverError } from "@/lib/api-response";
import { normalizeRequestedDate, parsePositiveInteger } from "@/lib/request-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const date = normalizeRequestedDate(url.searchParams.get("date"), getTodayDateStr());
  const reunion = parsePositiveInteger(url.searchParams.get("reunion"));
  const course = parsePositiveInteger(url.searchParams.get("course"));

  if (!date) {
    return badRequest("Invalid date format. Expected DDMMYYYY.");
  }

  try {
    const summary = await runPreRaceSecondPass(date, {
      reunion,
      course,
    });
    return NextResponse.json(summary);
  } catch (error) {
    return serverError("Pre-race cron failed", error, { date, reunion, course });
  }
}
