import {
  buildPerformanceDashboard,
  type PerformanceComparisonRow,
} from "@/features/performance/performance-model";
import {
  getBilanDashboardHistoryRange,
  listCourseRecordsBetween,
  listPredictionsBetween,
} from "@/lib/prediction-store";
import { logger } from "@/lib/server-logger";
import { getStripeConfigError, getStripeServerClient, hasStripeConfig } from "@/lib/stripe";
import { getRequiredSupabaseAdminClient } from "@/lib/supabase";
import type { CourseRecordRow, PredictionRow } from "@/lib/types";

export interface AdminUserStats {
  totalUsers: number;
  premiumSubscribers: number;
}

export interface AdminStripeStats {
  available: boolean;
  revenueCents: number;
  currency: string;
  formattedRevenue: string;
  chargesCount: number;
  error: string | null;
}

export interface AdminPerformanceGroup {
  label: string;
  bets: number;
  winningBets: number;
  places: number;
  stake: number;
  gain: number;
  netGain: number;
  roi: number;
  hitRate: number;
}

export interface AdminBestRace {
  date: string;
  raceLabel: string;
  hippodrome: string;
  bets: number;
  stake: number;
  gain: number;
  netGain: number;
  roi: number;
}

export interface AdminDashboardPrediction {
  id: string;
  date: string;
  raceLabel: string;
  hippodrome: string;
  cheval: string;
  betType: "GAGNANT" | "PLACE" | null;
  decision: PredictionRow["decision"];
  confidence: number;
  stake: number;
  gain: number;
  netGain: number;
  result: PerformanceComparisonRow["result"];
}

export interface AdminDashboardData {
  generatedAt: string;
  historyDays: number;
  users: AdminUserStats;
  stripe: AdminStripeStats;
  performance: {
    roi: number;
    successRate: number;
    winRate: number;
    placeRate: number;
    validatedBets: number;
    pendingBets: number;
    netGain: number;
    totalStake: number;
    totalGain: number;
    calibrationError: number;
    lastSettledDate: string | null;
  };
  bestRace: AdminBestRace | null;
  rangeSummaries: Array<{
    label: string;
    roi: number;
    netGain: number;
    bets: number;
  }>;
  byBetType: AdminPerformanceGroup[];
  byHippodrome: AdminPerformanceGroup[];
  byCourseType: AdminPerformanceGroup[];
  latestPredictions: AdminDashboardPrediction[];
}

type GroupAccumulator = {
  label: string;
  bets: number;
  winningBets: number;
  places: number;
  stake: number;
  gain: number;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function percent(part: number, total: number) {
  return total > 0 ? round2((part / total) * 100) : 0;
}

function roi(stake: number, gain: number) {
  return stake > 0 ? round2(((gain - stake) / stake) * 100) : 0;
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

function isPlayableSettled(row: PredictionRow) {
  return row.decision !== "REJET" && getStake(row) > 0 && isSettled(row);
}

function isWinningBet(row: PredictionRow) {
  if (row.pari_conseille === "GAGNANT") {
    return row.resultat_gagnant === true;
  }

  if (row.pari_conseille === "PLACE") {
    return row.resultat_place === true;
  }

  return getGain(row) > 0;
}

function formatMoneyFromCents(cents: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function raceKey(row: Pick<PredictionRow, "date" | "reunion" | "course">) {
  return `${row.date}-${row.reunion}-${row.course}`;
}

function courseKey(row: Pick<CourseRecordRow, "date" | "reunion" | "course">) {
  return `${row.date}-${row.reunion}-${row.course}`;
}

function getCourseType(course: CourseRecordRow | null | undefined) {
  const discipline = (course?.discipline ?? "").trim();
  if (discipline) {
    return discipline.toUpperCase();
  }

  return "NON RENSEIGNE";
}

export function buildAdminPerformanceGroups(
  predictions: PredictionRow[],
  groupBy: (row: PredictionRow) => string,
  limit = 8
): AdminPerformanceGroup[] {
  const groups = new Map<string, GroupAccumulator>();

  for (const row of predictions.filter(isPlayableSettled)) {
    const label = groupBy(row).trim() || "NON RENSEIGNE";
    const current =
      groups.get(label) ??
      {
        label,
        bets: 0,
        winningBets: 0,
        places: 0,
        stake: 0,
        gain: 0,
      };

    current.bets += 1;
    current.stake += getStake(row);
    current.gain += getGain(row);
    if (isWinningBet(row)) {
      current.winningBets += 1;
    }
    if (row.resultat_place === true) {
      current.places += 1;
    }

    groups.set(label, current);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      stake: round2(group.stake),
      gain: round2(group.gain),
      netGain: round2(group.gain - group.stake),
      roi: roi(group.stake, group.gain),
      hitRate: percent(group.winningBets, group.bets),
    }))
    .sort((left, right) => {
      if (right.netGain !== left.netGain) {
        return right.netGain - left.netGain;
      }
      return right.bets - left.bets;
    })
    .slice(0, limit);
}

export function findBestAdminRace(predictions: PredictionRow[]): AdminBestRace | null {
  const groups = new Map<string, AdminBestRace>();

  for (const row of predictions.filter(isPlayableSettled)) {
    const key = raceKey(row);
    const current =
      groups.get(key) ??
      {
        date: row.date,
        raceLabel: `R${row.reunion}C${row.course}`,
        hippodrome: row.hippodrome,
        bets: 0,
        stake: 0,
        gain: 0,
        netGain: 0,
        roi: 0,
      };

    current.bets += 1;
    current.stake += getStake(row);
    current.gain += getGain(row);
    current.netGain = round2(current.gain - current.stake);
    current.roi = roi(current.stake, current.gain);
    groups.set(key, current);
  }

  return (
    [...groups.values()].sort((left, right) => {
      if (right.netGain !== left.netGain) {
        return right.netGain - left.netGain;
      }
      return right.roi - left.roi;
    })[0] ?? null
  );
}

export function buildAdminLatestPredictions(
  predictions: PredictionRow[],
  limit = 12
): AdminDashboardPrediction[] {
  return predictions
    .filter((row) => row.decision !== "REJET" && getStake(row) > 0)
    .sort((left, right) => {
      const dateCompare = right.date.localeCompare(left.date);
      if (dateCompare !== 0) return dateCompare;
      if (right.reunion !== left.reunion) return right.reunion - left.reunion;
      if (right.course !== left.course) return right.course - left.course;
      return right.confiance - left.confiance;
    })
    .slice(0, limit)
    .map((row) => {
      const stake = getStake(row);
      const gain = getGain(row);
      const result =
        !isSettled(row)
          ? "EN_ATTENTE"
          : isWinningBet(row)
            ? row.resultat_gagnant
              ? "GAGNANT"
              : "PLACE"
            : "PERDU";

      return {
        id: `${row.date}-${row.reunion}-${row.course}-${row.cheval_num}`,
        date: row.date,
        raceLabel: `R${row.reunion}C${row.course}`,
        hippodrome: row.hippodrome,
        cheval: `#${row.cheval_num} ${row.cheval_nom}`,
        betType: row.pari_conseille ?? null,
        decision: row.decision,
        confidence: row.confiance,
        stake,
        gain,
        netGain: round2(gain - stake),
        result,
      };
    });
}

export function computeAdminSuccessRate(predictions: PredictionRow[]) {
  const playable = predictions.filter(isPlayableSettled);
  return percent(playable.filter(isWinningBet).length, playable.length);
}

async function loadUserStats(): Promise<AdminUserStats> {
  const admin = getRequiredSupabaseAdminClient();
  const [usersResult, premiumResult] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_subscribed", true),
  ]);

  if (usersResult.error) {
    throw new Error(`Profile count failed: ${usersResult.error.message}`);
  }

  if (premiumResult.error) {
    throw new Error(`Premium profile count failed: ${premiumResult.error.message}`);
  }

  return {
    totalUsers: usersResult.count ?? 0,
    premiumSubscribers: premiumResult.count ?? 0,
  };
}

async function loadStripeStats(): Promise<AdminStripeStats> {
  if (!hasStripeConfig()) {
    return {
      available: false,
      revenueCents: 0,
      currency: "EUR",
      formattedRevenue: formatMoneyFromCents(0, "EUR"),
      chargesCount: 0,
      error: getStripeConfigError(),
    };
  }

  try {
    const stripe = getStripeServerClient();
    const charges = await stripe.charges.list({ limit: 100 });
    const paidCharges = charges.data.filter((charge) => charge.paid && !charge.disputed);
    const currency = paidCharges[0]?.currency?.toUpperCase() ?? "EUR";
    const revenueCents = paidCharges.reduce(
      (sum, charge) => sum + Math.max(0, charge.amount - (charge.amount_refunded ?? 0)),
      0
    );

    return {
      available: true,
      revenueCents,
      currency,
      formattedRevenue: formatMoneyFromCents(revenueCents, currency),
      chargesCount: paidCharges.length,
      error: null,
    };
  } catch (error) {
    logger.error("admin.stripe_revenue_failed", error);
    return {
      available: false,
      revenueCents: 0,
      currency: "EUR",
      formattedRevenue: formatMoneyFromCents(0, "EUR"),
      chargesCount: 0,
      error: "Stripe indisponible pour le moment.",
    };
  }
}

export async function loadAdminDashboardData(now = new Date()): Promise<AdminDashboardData> {
  const generatedAt = now.toISOString();
  const { startIso, endIso, historyDaysUsed } = getBilanDashboardHistoryRange(now, 90);
  const [users, stripe, predictions, courses] = await Promise.all([
    loadUserStats(),
    loadStripeStats(),
    listPredictionsBetween(startIso, endIso),
    listCourseRecordsBetween(startIso, endIso),
  ]);
  const courseByRace = new Map(courses.map((course) => [courseKey(course), course] as const));
  const dashboard = buildPerformanceDashboard(
    predictions,
    courses,
    {
      period: "30j",
      segment: "ALL",
      betType: "ALL",
      hippodrome: "ALL",
      distance: "ALL",
    },
    generatedAt,
    { startIso, endIso }
  );
  const successRate = computeAdminSuccessRate(predictions);

  return {
    generatedAt,
    historyDays: historyDaysUsed,
    users,
    stripe,
    performance: {
      roi: dashboard.kpis.globalRoi,
      successRate,
      winRate: dashboard.kpis.winRate,
      placeRate: dashboard.kpis.placeRate,
      validatedBets: dashboard.kpis.validatedBets,
      pendingBets: dashboard.risk.pendingBets,
      netGain: dashboard.kpis.netGain,
      totalStake: dashboard.kpis.totalStake,
      totalGain: dashboard.kpis.totalGain,
      calibrationError: dashboard.risk.calibrationError,
      lastSettledDate: dashboard.range.lastSettledDate,
    },
    bestRace: findBestAdminRace(predictions),
    rangeSummaries: dashboard.rangeSummaries.map((summary) => ({
      label: summary.label,
      roi: summary.roi,
      netGain: summary.netGain,
      bets: summary.bets,
    })),
    byBetType: buildAdminPerformanceGroups(
      predictions,
      (row) => row.pari_conseille ?? "NON RENSEIGNE",
      4
    ),
    byHippodrome: buildAdminPerformanceGroups(predictions, (row) => row.hippodrome, 10),
    byCourseType: buildAdminPerformanceGroups(
      predictions,
      (row) => getCourseType(courseByRace.get(raceKey(row))),
      10
    ),
    latestPredictions: buildAdminLatestPredictions(predictions, 14),
  };
}
