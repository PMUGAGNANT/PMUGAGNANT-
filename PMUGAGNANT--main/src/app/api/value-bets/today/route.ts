import { NextResponse } from "next/server";
import { buildValueBets, formatRaceAnalysisId } from "@/features/vmax/vmax-model";
import { getTodayDateStr } from "@/lib/date-utils";
import { getPredictionOdds, getPredictionScore } from "@/lib/public-performance";
import { listPredictionsByDate } from "@/lib/prediction-store";
import { serverError } from "@/lib/api-response";
import type { PredictionRow } from "@/lib/types";

export const revalidate = 300;
export const dynamic = "force-dynamic";

function getRaceKey(row: PredictionRow) {
  return `${row.date}-${row.reunion}-${row.course}`;
}

export async function GET() {
  try {
    const date = getTodayDateStr();
    const rows = (await listPredictionsByDate(date)).filter(
      (row) => (row.value ?? 0) > 0.1 && !row.non_partant
    );
    const byRace = new Map<string, PredictionRow[]>();

    for (const row of rows) {
      const key = getRaceKey(row);
      const current = byRace.get(key) ?? [];
      current.push(row);
      byRace.set(key, current);
    }

    const valueBets = [...byRace.values()]
      .flatMap((raceRows) => {
        const first = raceRows[0];
        if (!first) return [];

        const predictionByHorse = new Map(
          raceRows.map((row) => [row.cheval_num, row] as const)
        );

        return buildValueBets(
          raceRows.map((row) => ({
            numero: row.cheval_num,
            cheval: row.cheval_nom,
            cote: getPredictionOdds(row),
            scoreIa: getPredictionScore(row),
            raison: row.avis_texte,
          })),
          20
        )
          .filter((bet) => bet.edgePct > 10)
          .map((bet) => {
            const prediction = predictionByHorse.get(bet.numero);
            return {
              date: first.date,
              race: formatRaceAnalysisId(first.reunion, first.course),
              reunion: first.reunion,
              course: first.course,
              hippodrome: first.hippodrome,
              chevalNum: bet.numero,
              cheval: bet.cheval,
              cotePmu: bet.coteActuelle,
              coteEstimee: bet.coteFair,
              edge: bet.edgePct,
              miseConseillee: prediction?.mise_simulee ?? null,
            };
          });
      })
      .sort((left, right) => right.edge - left.edge);

    return NextResponse.json(
      { success: true, generatedAt: new Date().toISOString(), date, valueBets },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    return serverError("Echec du chargement des value bets du jour.", error);
  }
}
