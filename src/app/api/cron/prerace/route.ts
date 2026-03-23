import { NextRequest, NextResponse } from "next/server";
import { ensureCronAuthorized } from "@/lib/cron-auth";
import { getTodayDateStr } from "@/lib/pmu-api";
import { runPreRaceSecondPass } from "@/lib/prediction-pipeline";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || getTodayDateStr();
  const reunion = url.searchParams.get("reunion");
  const course = url.searchParams.get("course");

  try {
    const summary = await runPreRaceSecondPass(date, {
      reunion: reunion ? Number.parseInt(reunion, 10) : null,
      course: course ? Number.parseInt(course, 10) : null,
    });
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Pre-race cron failed",
      },
      { status: 500 }
    );
  }
}
