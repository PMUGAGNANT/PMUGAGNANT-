import type { PredictionRow } from "@/lib/types";

export interface SubscribeTeaser {
  id: string;
  raceLabel: string;
  hippodrome: string;
  cheval: string;
  dossard: number;
  decision: PredictionRow["decision"];
  betType: PredictionRow["pari_conseille"];
  confidence: number;
  odds: number | null;
}

export interface SubscribeRoiSummary {
  roi: number;
  stake: number;
  gain: number;
  netGain: number;
  bets: number;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function getRowTimestamp(row: PredictionRow) {
  return row.updated_at ?? row.created_at ?? `${row.date}T00:00:00.000Z`;
}

function getRowScore(row: PredictionRow) {
  return row.score_final_pari ?? row.score_blended ?? row.score_cheval ?? 0;
}

function getRowOdds(row: PredictionRow) {
  const odds = row.cote_depart ?? row.cote_matin ?? null;
  return odds !== null && Number.isFinite(odds) && odds > 0 ? odds : null;
}

function getStake(row: PredictionRow) {
  return Math.max(0, Number(row.mise_simulee ?? 0));
}

function getGain(row: PredictionRow) {
  return Math.max(0, Number(row.gain_simule ?? 0));
}

function isSettled(row: PredictionRow) {
  return (
    row.gain_simule !== null ||
    row.resultat_gagnant !== null ||
    row.resultat_place !== null
  );
}

function isPlayable(row: PredictionRow) {
  return row.decision !== "REJET" && getStake(row) > 0;
}

export function buildSubscribeTeasers(rows: PredictionRow[], limit = 3): SubscribeTeaser[] {
  return [...rows]
    .filter(isPlayable)
    .sort((left, right) => {
      const timeDelta = getRowTimestamp(right).localeCompare(getRowTimestamp(left));
      if (timeDelta !== 0) {
        return timeDelta;
      }

      return getRowScore(right) - getRowScore(left);
    })
    .slice(0, limit)
    .map((row) => ({
      id: `${row.date}-${row.reunion}-${row.course}-${row.cheval_num}`,
      raceLabel: `R${row.reunion}C${row.course}`,
      hippodrome: row.hippodrome,
      cheval: row.cheval_nom,
      dossard: row.cheval_num,
      decision: row.decision,
      betType: row.pari_conseille ?? null,
      confidence: round2(getRowScore(row)),
      odds: getRowOdds(row),
    }));
}

export function computeSubscribeRoiSummary(rows: PredictionRow[]): SubscribeRoiSummary {
  const settledRows = rows.filter((row) => isPlayable(row) && isSettled(row));
  const stake = round2(settledRows.reduce((sum, row) => sum + getStake(row), 0));
  const gain = round2(settledRows.reduce((sum, row) => sum + getGain(row), 0));
  const netGain = round2(gain - stake);
  const roi = stake > 0 ? round2((netGain / stake) * 100) : 0;

  return {
    roi,
    stake,
    gain,
    netGain,
    bets: settledRows.length,
  };
}

export function formatSubscribeRoi(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
