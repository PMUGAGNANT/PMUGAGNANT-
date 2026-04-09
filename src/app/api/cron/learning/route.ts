import { NextRequest, NextResponse } from "next/server";
import { ensureCronAuthorized } from "@/lib/cron-auth";
import { runEngineLearning } from "@/lib/engine-learning";
import { badRequest, serverError } from "@/lib/api-response";
import { parsePositiveInteger } from "@/lib/request-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(request.url);
  const daysRaw = searchParams.get("days");
  const dateRaw = searchParams.get("date");
  const days = daysRaw ? parsePositiveInteger(daysRaw) : 90;

  if (!days || days < 1 || days > 120) {
    return badRequest("Invalid days parameter. Expected 1-120.");
  }

  const referenceDate = dateRaw ? new Date(dateRaw) : new Date();
  if (Number.isNaN(referenceDate.getTime())) {
    return badRequest("Invalid date parameter. Expected ISO date.");
  }

  try {
    const result = await runEngineLearning(days, referenceDate);
    return NextResponse.json(result);
  } catch (error) {
    return serverError("Learning cron failed", error, {
      days,
      date: dateRaw ?? null,
    });
  }
}
