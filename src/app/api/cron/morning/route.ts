import { NextRequest, NextResponse } from "next/server";
import { ensureCronAuthorized } from "@/lib/cron-auth";
import { getTodayDateStr } from "@/lib/pmu-api";
import { runMorningAnalysis } from "@/lib/prediction-pipeline";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || getTodayDateStr();

  try {
    const summary = await runMorningAnalysis(date);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Morning cron failed",
      },
      { status: 500 }
    );
  }
}
