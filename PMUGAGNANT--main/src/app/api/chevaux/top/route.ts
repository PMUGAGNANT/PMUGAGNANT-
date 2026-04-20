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

export const revalidate = 1800;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const range = getIsoRange(30);
    const [predictions, outcomes] = await Promise.all([
      listPredictionsBetween(range.startIso, range.endIso),
      listRunnerOutcomesBetween(range.startIso, range.endIso),
    ]);
    const settled = joinPredictionsWithOutcomes(predictions, outcomes);
    const groups = new Map<
      string,
      {
        nom: string;
        courses: number;
        victoires: number;
        places: number;
        stake: number;
        gain: number;
      }
    >();

    for (const row of settled) {
      const key = row.prediction.cheval_nom.trim().toUpperCase();
      const current =
        groups.get(key) ??
        {
          nom: row.prediction.cheval_nom,
          courses: 0,
          victoires: 0,
          places: 0,
          stake: 0,
          gain: 0,
        };
      current.courses += 1;
      current.victoires += row.won ? 1 : 0;
      current.places += row.placed ? 1 : 0;
      current.stake = round2(current.stake + row.stake);
      current.gain = round2(current.gain + row.gain);
      groups.set(key, current);
    }

    const chevaux = [...groups.values()]
      .map((row) => {
        const profit = round2(row.gain - row.stake);
        return {
          nom: row.nom,
          nombreCourses: row.courses,
          victoires: row.victoires,
          places: row.places,
          tauxReussite: row.courses > 0 ? round2((row.victoires / row.courses) * 100) : null,
          tauxPlace: row.courses > 0 ? round2((row.places / row.courses) * 100) : null,
          roiMoyen: row.stake > 0 ? round2((profit / row.stake) * 100) : null,
        };
      })
      .filter((row) => row.nombreCourses > 0)
      .sort((left, right) => {
        const winDelta = (right.tauxReussite ?? 0) - (left.tauxReussite ?? 0);
        if (winDelta !== 0) return winDelta;
        return right.nombreCourses - left.nombreCourses;
      })
      .slice(0, 10);

    return NextResponse.json(
      { success: true, generatedAt: new Date().toISOString(), range, chevaux },
      {
        headers: {
          "Cache-Control": "s-maxage=1800, stale-while-revalidate=1800",
        },
      }
    );
  } catch (error) {
    return serverError("Echec du classement chevaux.", error);
  }
}
