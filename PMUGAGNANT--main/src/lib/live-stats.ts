import type { PredictionRow } from "@/lib/types";

export interface LiveStatsSnapshot {
  available: boolean;
  totalPredictions: number;
  winCount: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  roi30d: number;
  roi7d: number;
  netGain30d: number;
  netGain7d: number;
  totalStake30d: number;
  totalGain30d: number;
  predictions7d: number;
  activeSubscribersThisMonth: number;
  todayPredictions: number;
  todayWins: number;
  lastUpdated: string | null;
}

export const EMPTY_LIVE_STATS: LiveStatsSnapshot = {
  available: false,
  totalPredictions: 0,
  winCount: 0,
  winRate: 0,
  currentStreak: 0,
  bestStreak: 0,
  roi30d: 0,
  roi7d: 0,
  netGain30d: 0,
  netGain7d: 0,
  totalStake30d: 0,
  totalGain30d: 0,
  predictions7d: 0,
  activeSubscribersThisMonth: 0,
  todayPredictions: 0,
  todayWins: 0,
  lastUpdated: null,
};

export function createLiveStatsSnapshot(
  partial?: Partial<LiveStatsSnapshot>
): LiveStatsSnapshot {
  return {
    ...EMPTY_LIVE_STATS,
    ...partial,
  };
}

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

function getSevenDayStartIso(todayIso: string) {
  const start = new Date(`${todayIso}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return start.toISOString().slice(0, 10);
}

function getStake(row: PredictionRow) {
  return Math.max(0, Number(row.mise_simulee ?? 0));
}

function getGain(row: PredictionRow) {
  return Math.max(0, Number(row.gain_simule ?? 0));
}

function calculateRoi(rows: PredictionRow[]) {
  const stake = rows.reduce((sum, row) => sum + getStake(row), 0);
  const gain = rows.reduce((sum, row) => sum + getGain(row), 0);

  return {
    stake: round2(stake),
    gain: round2(gain),
    netGain: round2(gain - stake),
    roi: stake > 0 ? round2(((gain - stake) / stake) * 100) : 0,
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

export function buildLiveStatsSnapshotFromPredictions(
  rows: PredictionRow[],
  todayIso: string,
  lastUpdated = new Date().toISOString()
): LiveStatsSnapshot {
  const liveRows = rows.filter(isLiveRow);

  if (liveRows.length === 0) {
    return createLiveStatsSnapshot({
      lastUpdated,
    });
  }

  const totalPredictions = liveRows.length;
  const winCount = liveRows.filter(isWinningPrediction).length;
  const thirtyDayPerformance = calculateRoi(liveRows);
  const sevenDayStartIso = getSevenDayStartIso(todayIso);
  const sevenDayRows = liveRows.filter((row) => row.date >= sevenDayStartIso && row.date <= todayIso);
  const sevenDayPerformance = calculateRoi(sevenDayRows);
  const todayRows = liveRows.filter((row) => row.date === todayIso);
  const newestFirst = [...liveRows].sort(sortByNewest);

  return createLiveStatsSnapshot({
    available: true,
    totalPredictions,
    winCount,
    winRate: round1((winCount / totalPredictions) * 100),
    currentStreak: calculateCurrentStreak(newestFirst),
    bestStreak: calculateBestStreak(liveRows),
    roi30d: thirtyDayPerformance.roi,
    roi7d: sevenDayPerformance.roi,
    netGain30d: thirtyDayPerformance.netGain,
    netGain7d: sevenDayPerformance.netGain,
    totalStake30d: thirtyDayPerformance.stake,
    totalGain30d: thirtyDayPerformance.gain,
    predictions7d: sevenDayRows.length,
    todayPredictions: todayRows.length,
    todayWins: todayRows.filter(isWinningPrediction).length,
    lastUpdated,
  });
}

export function hasLiveStatsData(stats: LiveStatsSnapshot) {
  return stats.available && stats.totalPredictions > 0;
}

export function formatLivePercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

export function formatLiveRoi(value: number, digits = 1) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatLiveTimestamp(iso: string | null) {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
