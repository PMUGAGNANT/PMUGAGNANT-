import { NextResponse } from "next/server";
import { formatDateToPmu, getParisNow, parsePmuDate, toIsoDate } from "@/lib/date-utils";
import {
  buildLiveStatsSnapshotFromPredictions,
  createLiveStatsSnapshot,
} from "@/lib/live-stats";
import { listPredictionsBetween } from "@/lib/prediction-store";

export const revalidate = 300;

function getThirtyDayRange() {
  const endDateStr = formatDateToPmu(getParisNow());
  const startDate = parsePmuDate(endDateStr);
  startDate.setUTCDate(startDate.getUTCDate() - 29);
  const startDateStr = formatDateToPmu(startDate);

  return {
    startIso: toIsoDate(startDateStr),
    endIso: toIsoDate(endDateStr),
    todayIso: toIsoDate(endDateStr),
  };
}

export async function GET() {
  try {
    const { startIso, endIso, todayIso } = getThirtyDayRange();
    const rows = await listPredictionsBetween(startIso, endIso);
    const payload = buildLiveStatsSnapshotFromPredictions(rows, todayIso);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json(
      createLiveStatsSnapshot({
        lastUpdated: new Date().toISOString(),
      }),
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=300",
        },
      }
    );
  }
}
