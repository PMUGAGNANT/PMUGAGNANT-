import { NextRequest, NextResponse } from "next/server";
import { ensureCronAuthorized } from "@/lib/cron-auth";
import { getTodayDateStr } from "@/lib/pmu-api";
import { runMorningAnalysis, runPreRaceSecondPass, runResultSync } from "@/lib/prediction-pipeline";
import { runWeeklyReport } from "@/lib/weekly-reports";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Unified cron dispatcher — runs every 5 minutes.
 * Decides which tasks to execute based on the current time (Europe/Paris).
 *
 * Schedule logic:
 *   - morning   : once at ~07:00
 *   - prerace   : every 5 min (always)
 *   - results   : every 10 min (on the :00, :10, :20, :30, :40, :50)
 *   - weekly    : Sunday at ~19:00
 */
export async function GET(request: NextRequest) {
  const unauthorized = ensureCronAuthorized(request);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const paris = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(paris.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(paris.find((p) => p.type === "minute")?.value ?? 0);
  const weekday = paris.find((p) => p.type === "weekday")?.value ?? "";

  const date = getTodayDateStr();
  const results: Record<string, unknown> = { dispatched_at: now.toISOString(), paris_time: `${hour}:${String(minute).padStart(2, "0")}` };

  // --- Morning scan: 07:00–07:04 window ---
  if (hour === 7 && minute < 5) {
    try {
      results.morning = await runMorningAnalysis(date);
    } catch (e) {
      results.morning = { error: e instanceof Error ? e.message : "morning failed" };
    }
  }

  // --- Pre-race: every call (every 5 min) ---
  try {
    results.prerace = await runPreRaceSecondPass(date, { reunion: null, course: null });
  } catch (e) {
    results.prerace = { error: e instanceof Error ? e.message : "prerace failed" };
  }

  // --- Results sync: every 10 min (minute divisible by 10) ---
  if (minute % 10 < 5) {
    try {
      results.results = await runResultSync(date, { reunion: null, course: null });
    } catch (e) {
      results.results = { error: e instanceof Error ? e.message : "results failed" };
    }
  }

  // --- Weekly report: Sunday 19:00–19:04 window ---
  if (weekday === "Sun" && hour === 19 && minute < 5) {
    try {
      results.weekly = await runWeeklyReport();
    } catch (e) {
      results.weekly = { error: e instanceof Error ? e.message : "weekly failed" };
    }
  }

  return NextResponse.json({ success: true, ...results });
}
