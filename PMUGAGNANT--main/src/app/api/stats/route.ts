import { NextResponse } from "next/server";
import {
  getIsoRange,
  getRaceKey,
  joinPredictionsWithOutcomes,
  round2,
  summarizeSettledPredictions,
} from "@/lib/public-performance";
import {
  listPredictionsBetween,
  listRunnerOutcomesBetween,
} from "@/lib/prediction-store";
import { serverError } from "@/lib/api-response";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

async function buildRangeStats(days: number) {
  const range = getIsoRange(days);
  const [predictions, outcomes] = await Promise.all([
    listPredictionsBetween(range.startIso, range.endIso),
    listRunnerOutcomesBetween(range.startIso, range.endIso),
  ]);
  const settled = joinPredictionsWithOutcomes(predictions, outcomes, { selectedOnly: true });

  return {
    ...range,
    ...summarizeSettledPredictions(settled),
  };
}

function findBestRaceOfMonth(
  settled: ReturnType<typeof joinPredictionsWithOutcomes>
) {
  const byRace = new Map<
    string,
    {
      date: string;
      reunion: number;
      course: number;
      hippodrome: string;
      gain: number;
      stake: number;
      profit: number;
    }
  >();

  for (const row of settled) {
    const key = getRaceKey(row.prediction);
    const current =
      byRace.get(key) ??
      {
        date: row.prediction.date,
        reunion: row.prediction.reunion,
        course: row.prediction.course,
        hippodrome: row.prediction.hippodrome,
        gain: 0,
        stake: 0,
        profit: 0,
      };
    current.gain = round2(current.gain + row.gain);
    current.stake = round2(current.stake + row.stake);
    current.profit = round2(current.profit + row.profit);
    byRace.set(key, current);
  }

  return [...byRace.values()].sort((left, right) => right.profit - left.profit)[0] ?? null;
}

export async function GET() {
  try {
    const [week, month, quarter] = await Promise.all([
      buildRangeStats(7),
      buildRangeStats(30),
      buildRangeStats(90),
    ]);
    const monthRange = getIsoRange(30);
    const [monthPredictions, monthOutcomes] = await Promise.all([
      listPredictionsBetween(monthRange.startIso, monthRange.endIso),
      listRunnerOutcomesBetween(monthRange.startIso, monthRange.endIso),
    ]);
    const monthSettled = joinPredictionsWithOutcomes(monthPredictions, monthOutcomes, {
      selectedOnly: true,
    });

    return NextResponse.json(
      {
        success: true,
        generatedAt: new Date().toISOString(),
        ranges: {
          "7d": week,
          "30d": month,
          "90d": quarter,
        },
        totalPronostics: quarter.totalPredictions,
        bestRaceOfMonth: findBestRaceOfMonth(monthSettled),
      },
      {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error) {
    return serverError("Echec du chargement des stats publiques.", error);
  }
}
