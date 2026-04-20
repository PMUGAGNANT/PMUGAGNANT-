import { NextRequest, NextResponse } from "next/server";
import { formatRaceAnalysisId } from "@/features/vmax/vmax-model";
import {
  getIsoRange,
  getPredictionOdds,
  joinPredictionsWithOutcomes,
} from "@/lib/public-performance";
import {
  listPredictionsBetween,
  listRunnerOutcomesBetween,
} from "@/lib/prediction-store";
import { serverError } from "@/lib/api-response";

export const revalidate = 600;
export const dynamic = "force-dynamic";

function parseDays(value: string | null) {
  const parsed = Number.parseInt(value ?? "30", 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(parsed, 365));
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const range = getIsoRange(parseDays(url.searchParams.get("days")));
    const [predictions, outcomes] = await Promise.all([
      listPredictionsBetween(range.startIso, range.endIso),
      listRunnerOutcomesBetween(range.startIso, range.endIso),
    ]);
    const historique = joinPredictionsWithOutcomes(predictions, outcomes, {
      selectedOnly: true,
      includeNonPartants: true,
    })
      .map((row) => ({
        date: row.prediction.date,
        course: formatRaceAnalysisId(row.prediction.reunion, row.prediction.course),
        reunion: row.prediction.reunion,
        courseNum: row.prediction.course,
        hippodrome: row.prediction.hippodrome,
        chevalNum: row.prediction.cheval_num,
        cheval: row.prediction.cheval_nom,
        cote: getPredictionOdds(row.prediction),
        mise: row.stake,
        gain: row.gain,
        resultat: row.result,
      }))
      .sort((left, right) => {
        const dateDelta = right.date.localeCompare(left.date);
        if (dateDelta !== 0) return dateDelta;
        return right.course.localeCompare(left.course);
      });

    return NextResponse.json(
      { success: true, generatedAt: new Date().toISOString(), range, historique },
      {
        headers: {
          "Cache-Control": "s-maxage=600, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    return serverError("Echec du chargement de l'historique.", error);
  }
}
