import { NextRequest, NextResponse } from "next/server";
import { ensureCronAuthorized } from "@/lib/cron-auth";
import { runWeeklyReport } from "@/lib/weekly-reports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");

  try {
    const summary = await runWeeklyReport(date ? new Date(date) : undefined);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Weekly cron failed",
      },
      { status: 500 }
    );
  }
}
