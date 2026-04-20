import { getTodayDateStr, toIsoDate } from "@/lib/date-utils";
import type { PredictionRow, RunnerOutcomeRow } from "@/lib/types";

export type PredictionResultStatus = "GAGNANT" | "PLACE" | "PERDU" | "NON_PARTANT";

export interface SettledPrediction {
  prediction: PredictionRow;
  outcome: RunnerOutcomeRow;
  stake: number;
  gain: number;
  profit: number;
  won: boolean;
  placed: boolean;
  result: PredictionResultStatus;
}

export interface PerformanceSummary {
  totalPredictions: number;
  totalStake: number;
  totalGain: number;
  profit: number;
  roi: number | null;
  winRate: number | null;
  placeRate: number | null;
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function getIsoRange(days: number) {
  const safeDays = Math.max(1, Math.floor(days));
  const endIso = toIsoDate(getTodayDateStr());
  const start = new Date(`${endIso}T12:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (safeDays - 1));

  return {
    days: safeDays,
    startIso: start.toISOString().slice(0, 10),
    endIso,
  };
}

export function getRaceKey(row: Pick<PredictionRow | RunnerOutcomeRow, "date" | "reunion" | "course">) {
  return `${row.date}-${row.reunion}-${row.course}`;
}

export function getRunnerKey(
  row: Pick<PredictionRow | RunnerOutcomeRow, "date" | "reunion" | "course" | "cheval_num">
) {
  return `${getRaceKey(row)}-${row.cheval_num}`;
}

export function getPredictionScore(row: PredictionRow) {
  return row.score_final_pari ?? row.score_blended ?? row.score_cheval ?? 0;
}

function getSelectionPriority(row: PredictionRow) {
  if (row.decision === "VALIDE") return 3;
  if (row.decision === "SURVEILLANCE") return 2;
  return 1;
}

export function isPlayablePrediction(row: PredictionRow) {
  return row.decision !== "REJET" && !row.non_partant && (row.mise_simulee ?? 0) > 0;
}

export function getSelectedPredictions(rows: PredictionRow[]) {
  const byRace = new Map<string, PredictionRow[]>();

  for (const row of rows) {
    if (!isPlayablePrediction(row)) continue;

    const key = getRaceKey(row);
    const current = byRace.get(key) ?? [];
    current.push(row);
    byRace.set(key, current);
  }

  return [...byRace.values()].flatMap((raceRows) => {
    const selected = [...raceRows].sort((left, right) => {
      const priorityDiff = getSelectionPriority(right) - getSelectionPriority(left);
      if (priorityDiff !== 0) return priorityDiff;
      return getPredictionScore(right) - getPredictionScore(left);
    })[0];

    return selected ? [selected] : [];
  });
}

export function getPredictionOdds(row: PredictionRow) {
  return row.cote_depart ?? row.cote_matin ?? null;
}

export function getRealGain(row: PredictionRow, outcome: RunnerOutcomeRow) {
  if (outcome.non_partant) return 0;

  const stake = row.mise_simulee ?? 0;
  const betType = row.pari_conseille ?? "GAGNANT";

  if (betType === "PLACE") {
    if (!outcome.resultat_place) return 0;
    return stake * (outcome.rapport_place ?? row.rapport_place ?? 1);
  }

  if (!outcome.resultat_gagnant) return 0;
  return stake * (outcome.rapport_gagnant ?? row.rapport_gagnant ?? 1);
}

export function joinPredictionsWithOutcomes(
  predictions: PredictionRow[],
  outcomes: RunnerOutcomeRow[],
  options: { selectedOnly?: boolean; includeNonPartants?: boolean } = {}
) {
  const outcomesByRunner = new Map(
    outcomes.map((outcome) => [getRunnerKey(outcome), outcome] as const)
  );
  const rows = options.selectedOnly ? getSelectedPredictions(predictions) : predictions.filter(isPlayablePrediction);

  return rows.flatMap((prediction): SettledPrediction[] => {
    const outcome = outcomesByRunner.get(getRunnerKey(prediction));
    if (!outcome || (outcome.non_partant && !options.includeNonPartants)) {
      return [];
    }

    const stake = outcome.non_partant ? 0 : prediction.mise_simulee ?? 0;
    const gain = getRealGain(prediction, outcome);
    const won = Boolean(outcome.resultat_gagnant);
    const placed = Boolean(outcome.resultat_place);
    const result: PredictionResultStatus = outcome.non_partant
      ? "NON_PARTANT"
      : won
        ? "GAGNANT"
        : placed
          ? "PLACE"
          : "PERDU";

    return [
      {
        prediction,
        outcome,
        stake: round2(stake),
        gain: round2(gain),
        profit: round2(gain - stake),
        won,
        placed,
        result,
      },
    ];
  });
}

export function summarizeSettledPredictions(rows: SettledPrediction[]): PerformanceSummary {
  const totalStake = round2(rows.reduce((sum, row) => sum + row.stake, 0));
  const totalGain = round2(rows.reduce((sum, row) => sum + row.gain, 0));
  const profit = round2(totalGain - totalStake);

  return {
    totalPredictions: rows.length,
    totalStake,
    totalGain,
    profit,
    roi: totalStake > 0 ? round2((profit / totalStake) * 100) : null,
    winRate: rows.length > 0 ? round2((rows.filter((row) => row.won).length / rows.length) * 100) : null,
    placeRate: rows.length > 0 ? round2((rows.filter((row) => row.placed).length / rows.length) * 100) : null,
  };
}
