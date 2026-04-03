export interface LiveStatsSnapshot {
  available: boolean;
  totalPredictions: number;
  winCount: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  roi30d: number;
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
