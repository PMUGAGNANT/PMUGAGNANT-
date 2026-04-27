import { NextResponse } from "next/server";
import { getTodayDateStr } from "@/lib/date-utils";
import { listPredictionsByDate } from "@/lib/prediction-store";
import { getRequestSubscriptionState } from "@/lib/subscription";
import { serverError } from "@/lib/api-response";
import type { PredictionRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function getRaceKey(row: Pick<PredictionRow, "reunion" | "course">) {
  return `${row.reunion}-${row.course}`;
}

function getSelectionPriority(row: PredictionRow) {
  if (row.decision === "VALIDE") return 3;
  if (row.decision === "SURVEILLANCE") return 2;
  return 1;
}

function getSelectionScore(row: PredictionRow) {
  return row.score_blended ?? row.score_cheval ?? row.score_final_pari ?? 0;
}

function sortSelections(left: PredictionRow, right: PredictionRow) {
  const priorityDiff = getSelectionPriority(right) - getSelectionPriority(left);
  if (priorityDiff !== 0) return priorityDiff;
  return getSelectionScore(right) - getSelectionScore(left);
}

function getVerdict(rows: PredictionRow[]) {
  const best = rows.find((prediction) => prediction.decision !== "REJET");
  if (!best) return "SURVEILLER";
  if (best.decision === "VALIDE") return "JOUER";
  if (best.decision === "SURVEILLANCE") return "SURVEILLER";
  return "PASSER";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? getTodayDateStr();
    const { state } = await getRequestSubscriptionState(request.headers.get("authorization"));

    if (!state.isSubscribed) {
      return NextResponse.json(
        {
          success: true,
          date,
          signals: {},
          paywall: {
            required: true,
            message: "Selections, mises et verdicts reserves aux membres Premium.",
          },
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const predictions = await listPredictionsByDate(date).catch(() => []);
    const byRace = new Map<string, PredictionRow[]>();

    for (const row of predictions) {
      if (row.non_partant) continue;
      const key = getRaceKey(row);
      const current = byRace.get(key) ?? [];
      current.push(row);
      byRace.set(key, current);
    }

    const signals = Object.fromEntries(
      [...byRace.entries()].map(([key, rows]) => {
        const sorted = [...rows]
          .filter((prediction) => prediction.decision !== "REJET")
          .sort(sortSelections);
        const stake =
          sorted.find((prediction) => (prediction.mise_simulee ?? 0) > 0)?.mise_simulee ??
          null;

        return [
          key,
          {
            topNumbers: sorted
              .map((prediction) => prediction.cheval_num)
              .filter((value) => Number.isFinite(value))
              .slice(0, 3),
            verdict: getVerdict(sorted),
            stake,
          },
        ];
      })
    );

    return NextResponse.json(
      { success: true, date, signals, paywall: null },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return serverError("Echec du chargement des signaux Premium.", error);
  }
}
