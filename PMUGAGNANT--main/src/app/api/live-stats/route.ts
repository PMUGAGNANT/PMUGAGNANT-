import { NextResponse } from "next/server";
import { formatDateToPmu, getParisNow, parsePmuDate, toIsoDate } from "@/lib/date-utils";
import {
  createLiveStatsSnapshot,
  type LiveStatsSnapshot,
} from "@/lib/live-stats";
import { listPredictionsBetween } from "@/lib/prediction-store";
import type { PredictionRow } from "@/lib/types";

export const revalidate = 300;

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function isWinningPrediction(row: PredictionRow) {
  return row.resultat_place === true || row.resultat_gagnant === true;
}

function isLiveRow(row: PredictionRow) {
  return row.decision === "VALIDE" && row.stage === "RESULTAT";
}

function sortByNewest(left: PredictionRow, right: PredictionRow) {
  return (
    right.date.localeCompare(left.date) ||
    right.reunion - left.reunion ||
    right.course - left.course ||
    (right.updated_at ?? "").localeCompare(left.updated_at ?? "") ||
    right.cheval_num - left.cheval_num
  );
}

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

function calculateBestStreak(rows: PredictionRow[]) {
  let bestStreak = 0;
  let current = 0;

  for (const row of rows) {
    if (isWinningPrediction(row)) {
      current += 1;
      if (current > bestStreak) {
        bestStreak = current;
      }
      continue;
    }

    current = 0;
  }

  return bestStreak;
}

function calculateCurrentStreak(rows: PredictionRow[]) {
  let streak = 0;

  for (const row of rows) {
    if (!isWinningPrediction(row)) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function buildPayload(rows: PredictionRow[], todayIso: string): LiveStatsSnapshot {
  const liveRows = rows.filter(isLiveRow);

  if (liveRows.length === 0) {
    return createLiveStatsSnapshot({
      lastUpdated: new Date().toISOString(),
    });
  }

  const totalPredictions = liveRows.length;
  const winCount = liveRows.filter(isWinningPrediction).length;
  const totalStake = liveRows.reduce((sum, row) => sum + (row.mise_simulee ?? 0), 0);
  const totalGain = liveRows.reduce((sum, row) => sum + (row.gain_simule ?? 0), 0);
  const todayRows = liveRows.filter((row) => row.date === todayIso);
  const newestFirst = [...liveRows].sort(sortByNewest);

  return createLiveStatsSnapshot({
    available: true,
    totalPredictions,
    winCount,
    winRate: round1((winCount / totalPredictions) * 100),
    currentStreak: calculateCurrentStreak(newestFirst),
    bestStreak: calculateBestStreak(liveRows),
    roi30d: totalStake > 0 ? round2(((totalGain - totalStake) / totalStake) * 100) : 0,
    todayPredictions: todayRows.length,
    todayWins: todayRows.filter(isWinningPrediction).length,
    lastUpdated: new Date().toISOString(),
  });
}

export async function GET() {
  try {
    const { startIso, endIso, todayIso } = getThirtyDayRange();
    const rows = await listPredictionsBetween(startIso, endIso);
    const payload = buildPayload(rows, todayIso);

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
