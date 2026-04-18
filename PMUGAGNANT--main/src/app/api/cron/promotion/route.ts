import { NextRequest } from "next/server";
import { runCronRoute } from "@/lib/cron-execution";
import { runEnginePromotion } from "@/lib/engine-promotion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return runCronRoute(request, "/api/cron/promotion", async () => {
    const { searchParams } = new URL(request.url);
    const dateRaw = searchParams.get("date");
    const referenceDate = dateRaw ? new Date(dateRaw) : new Date();

    if (Number.isNaN(referenceDate.getTime())) {
      throw new Error("Invalid date parameter. Expected ISO date.");
    }

    return runEnginePromotion(referenceDate);
  });
}
