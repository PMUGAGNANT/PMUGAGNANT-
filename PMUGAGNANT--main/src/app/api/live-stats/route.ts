import { NextResponse } from "next/server";
import { formatDateToPmu, getParisNow, parsePmuDate, toIsoDate } from "@/lib/date-utils";
import {
  buildLiveStatsSnapshotFromPredictions,
  createLiveStatsSnapshot,
} from "@/lib/live-stats";
import { listPredictionsBetween } from "@/lib/prediction-store";
import { getSupabaseAdminClient } from "@/lib/supabase";

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

async function countActiveSubscribersThisMonth() {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return 0;
  }

  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_subscribed", true);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export async function GET() {
  try {
    const { startIso, endIso, todayIso } = getThirtyDayRange();
    const [rows, activeSubscribersThisMonth] = await Promise.all([
      listPredictionsBetween(startIso, endIso),
      countActiveSubscribersThisMonth(),
    ]);
    const payload = createLiveStatsSnapshot({
      ...buildLiveStatsSnapshotFromPredictions(rows, todayIso),
      activeSubscribersThisMonth,
    });

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
