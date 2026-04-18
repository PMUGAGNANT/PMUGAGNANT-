import { NextRequest } from "next/server";
import { runCronRoute } from "@/lib/cron-execution";
import { runProbabilityCalibration } from "@/lib/probability-calibration";
import { parsePositiveInteger } from "@/lib/request-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return runCronRoute(request, "/api/cron/calibration", async () => {
    const { searchParams } = new URL(request.url);
    const daysRaw = searchParams.get("days");
    const dateRaw = searchParams.get("date");
    const days = daysRaw ? parsePositiveInteger(daysRaw) : 90;

    if (!days || days < 1 || days > 120) {
      throw new Error("Invalid days parameter. Expected 1-120.");
    }

    const referenceDate = dateRaw ? new Date(dateRaw) : new Date();
    if (Number.isNaN(referenceDate.getTime())) {
      throw new Error("Invalid date parameter. Expected ISO date.");
    }

    return runProbabilityCalibration(days, referenceDate);
  });
}
