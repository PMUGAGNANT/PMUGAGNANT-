import { NextRequest, NextResponse } from "next/server";
import { ensureCronAuthorized } from "@/lib/cron-auth";
import { runEngineLearning } from "@/lib/engine-learning";
import { badRequest, serverError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(request.url);
  const dateRaw = searchParams.get("date");

  const referenceDate = dateRaw ? new Date(dateRaw) : new Date();
  if (Number.isNaN(referenceDate.getTime())) {
    return badRequest("Invalid date parameter. Expected ISO date.");
  }

  try {
    const result = await runEngineLearning(referenceDate);
    return NextResponse.json(result);
  } catch (error) {
    return serverError("Learning cron failed", error, {
      date: dateRaw ?? null,
    });
  }
}
