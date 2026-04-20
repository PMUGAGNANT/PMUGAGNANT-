import { NextResponse } from "next/server";
import {
  getIsoRange,
  joinPredictionsWithOutcomes,
  round2,
} from "@/lib/public-performance";
import {
  listPredictionsBetween,
  listRunnerOutcomesBetween,
} from "@/lib/prediction-store";
import { serverError } from "@/lib/api-response";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const range = getIsoRange(90);
    const [predictions, outcomes] = await Promise.all([
      listPredictionsBetween(range.startIso, range.endIso),
      listRunnerOutcomesBetween(range.startIso, range.endIso),
    ]);
    const settled = joinPredictionsWithOutcomes(predictions, outcomes, { selectedOnly: true });
    const groups = new Map<
      string,
      {
        hippodrome: string;
        courses: number;
        success: number;
        stake: number;
        gain: number;
      }
    >();

    for (const row of settled) {
      const key = row.prediction.hippodrome.trim().toUpperCase() || "INCONNU";
      const current =
        groups.get(key) ??
        {
          hippodrome: row.prediction.hippodrome || "Inconnu",
          courses: 0,
          success: 0,
          stake: 0,
          gain: 0,
        };
      current.courses += 1;
      current.success += row.won || row.placed ? 1 : 0;
      current.stake = round2(current.stake + row.stake);
      current.gain = round2(current.gain + row.gain);
      groups.set(key, current);
    }

    const hippodromes = [...groups.values()]
      .map((row) => {
        const profit = round2(row.gain - row.stake);
        return {
          hippodrome: row.hippodrome,
          tauxReussiteIa: row.courses > 0 ? round2((row.success / row.courses) * 100) : null,
          nombreCoursesAnalysees: row.courses,
          roiMoyen: row.stake > 0 ? round2((profit / row.stake) * 100) : null,
        };
      })
      .sort((left, right) => {
        const rateDelta = (right.tauxReussiteIa ?? 0) - (left.tauxReussiteIa ?? 0);
        if (rateDelta !== 0) return rateDelta;
        return right.nombreCoursesAnalysees - left.nombreCoursesAnalysees;
      });

    return NextResponse.json(
      { success: true, generatedAt: new Date().toISOString(), range, hippodromes },
      {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error) {
    return serverError("Echec des statistiques hippodromes.", error);
  }
}
