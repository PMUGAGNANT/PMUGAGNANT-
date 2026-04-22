import { getRaceSegmentKey } from "@/lib/engine-v6";
import type {
  CourseRecordRow,
  PredictionRow,
  RaceSummary,
  RunnerOutcomeRow,
  SegmentKey,
} from "@/lib/types";

export const PERFORMANCE_SEGMENTS: SegmentKey[] = [
  "TROT_ATTELE",
  "TROT_MONTE",
  "PLAT_SPRINT",
  "PLAT_MILE",
  "PLAT_LONG",
  "OBSTACLE",
  "QUINTE",
];

export type PerformancePeriod = "7j" | "30j" | "90j" | "all";
export type PerformanceBetType = "ALL" | "GAGNANT" | "PLACE";
export type PerformanceSegmentFilter = "ALL" | SegmentKey;
export type PerformanceDistanceFilter = "ALL" | "SPRINT" | "MILE" | "LONG";

export interface PerformanceFilters {
  period: PerformancePeriod;
  segment: PerformanceSegmentFilter;
  betType: PerformanceBetType;
  hippodrome?: string;
  distance?: PerformanceDistanceFilter;
}

export interface PerformanceKpis {
  globalRoi: number;
  validatedBets: number;
  winRate: number;
  placeRate: number;
  netGain: number;
  totalStake: number;
  totalGain: number;
  paybackRate: number;
}

export interface PerformanceTimelinePoint {
  date: string;
  stake: number;
  gain: number;
  profit: number;
  betCount: number;
  cumulativeProfit: number;
  cumulativeRoi: number;
  drawdown: number;
}

export interface PerformanceRangeSummary {
  period: Exclude<PerformancePeriod, "all">;
  label: string;
  roi: number;
  stake: number;
  gain: number;
  netGain: number;
  bets: number;
  timeline: PerformanceTimelinePoint[];
}

export interface PerformanceSegmentRow {
  segment: SegmentKey;
  bets: number;
  wins: number;
  places: number;
  roi: number;
  winRate: number;
  placeRate: number;
  stake: number;
  gain: number;
  netGain: number;
  averageConfidence: number;
  averageOdds: number | null;
}

export interface PerformanceCalibrationBin {
  label: string;
  min: number;
  max: number;
  sampleSize: number;
  averageProbability: number;
  actualWinRate: number;
  delta: number;
}

export interface PerformanceRiskMetrics {
  pendingBets: number;
  rejectedRows: number;
  maxDrawdown: number;
  bestDayProfit: number;
  worstDayProfit: number;
  averageStake: number;
  calibrationError: number;
  calibrationSampleSize: number;
}

export interface PerformanceComparisonRow {
  id: string;
  date: string;
  raceLabel: string;
  hippodrome: string;
  cheval: string;
  finishPosition: number | null;
  betType: "GAGNANT" | "PLACE" | null;
  decision: PredictionRow["decision"];
  suggestedStake: number;
  actualStake: number;
  gain: number;
  netGain: number;
  roi: number;
  result: "GAGNANT" | "PLACE" | "PERDU" | "EN_ATTENTE";
}

export interface PerformanceDateRange {
  startIso: string;
  endIso: string;
  firstSettledDate: string | null;
  lastSettledDate: string | null;
}

export interface PerformanceDashboard {
  filters: PerformanceFilters;
  range: PerformanceDateRange;
  kpis: PerformanceKpis;
  risk: PerformanceRiskMetrics;
  rangeSummaries: PerformanceRangeSummary[];
  timeline: PerformanceTimelinePoint[];
  segments: PerformanceSegmentRow[];
  calibration: PerformanceCalibrationBin[];
  comparisonRows: PerformanceComparisonRow[];
  availableHippodromes: string[];
  generatedAt: string;
}

const CALIBRATION_BINS = [
  { label: "0-10%", min: 0, max: 0.1 },
  { label: "10-20%", min: 0.1, max: 0.2 },
  { label: "20-30%", min: 0.2, max: 0.3 },
  { label: "30-40%", min: 0.3, max: 0.4 },
  { label: "40-50%", min: 0.4, max: 0.5 },
  { label: "50%+", min: 0.5, max: 1.01 },
] as const;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function percent(part: number, total: number) {
  return total > 0 ? round2((part / total) * 100) : 0;
}

function roi(stake: number, gain: number) {
  return stake > 0 ? round2(((gain - stake) / stake) * 100) : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function isSegmentKey(value: string): value is SegmentKey {
  return PERFORMANCE_SEGMENTS.includes(value as SegmentKey);
}

export function normalizePerformancePeriod(value: string | null): PerformancePeriod {
  return value === "7j" || value === "30j" || value === "90j" || value === "all"
    ? value
    : "30j";
}

export function normalizePerformanceBetType(value: string | null): PerformanceBetType {
  return value === "GAGNANT" || value === "PLACE" ? value : "ALL";
}

export function normalizePerformanceSegment(value: string | null): PerformanceSegmentFilter {
  return value && isSegmentKey(value) ? value : "ALL";
}

export function normalizePerformanceHippodrome(value: string | null): string {
  const normalized = (value ?? "").trim();
  if (!normalized || normalized.toUpperCase() === "ALL") {
    return "ALL";
  }

  return normalized.slice(0, 80);
}

export function normalizePerformanceDistance(value: string | null): PerformanceDistanceFilter {
  return value === "SPRINT" || value === "MILE" || value === "LONG" ? value : "ALL";
}

export function getPerformanceDateRange(period: PerformancePeriod, now: Date = new Date()) {
  const endIso = now.toISOString().slice(0, 10);
  if (period === "all") {
    return { startIso: "2000-01-01", endIso };
  }

  const days = period === "7j" ? 7 : period === "30j" ? 30 : 90;
  const start = new Date(now.getTime());
  start.setUTCDate(start.getUTCDate() - days);
  return {
    startIso: start.toISOString().slice(0, 10),
    endIso,
  };
}

export function getSegmentForCourse(course: CourseRecordRow | null | undefined): SegmentKey {
  if (!course) {
    return "PLAT_LONG";
  }

  const discipline = (course.discipline ?? "").toUpperCase();
  const name = (course.nom_course ?? "").toUpperCase();
  const estQuinte = discipline.includes("QUINTE") || name.includes("QUINTE");
  const estTrot = discipline.includes("TROT");
  const estPlat = discipline.includes("PLAT");
  const race: RaceSummary = {
    dateStr: course.date.replaceAll("-", ""),
    reunion: course.reunion,
    course: course.course,
    hippodrome: course.hippodrome,
    pays: "FR",
    nomCourse: course.nom_course,
    heureDepart: course.heure_depart,
    discipline: course.discipline,
    estTrot,
    estPlat,
    estQuinte,
    allocation: course.allocation,
    distance: course.distance,
    nombrePartants: course.nombre_partants,
    terrain: course.terrain,
    meteo: course.meteo,
  };

  return getRaceSegmentKey(race);
}

function predictionKey(row: Pick<PredictionRow, "date" | "reunion" | "course">) {
  return `${row.date}-${row.reunion}-${row.course}`;
}

function runnerOutcomeKey(
  row: Pick<RunnerOutcomeRow, "date" | "reunion" | "course" | "cheval_num">
) {
  return `${row.date}-${row.reunion}-${row.course}-${row.cheval_num}`;
}

function isDateInRange(date: string, startIso: string, endIso: string) {
  return date >= startIso && date <= endIso;
}

function getDistanceBucket(course: CourseRecordRow | null | undefined): PerformanceDistanceFilter {
  const distance = course?.distance ?? 0;
  if (!Number.isFinite(distance) || distance <= 0) {
    return "ALL";
  }
  if (distance <= 1600) {
    return "SPRINT";
  }
  if (distance <= 2200) {
    return "MILE";
  }

  return "LONG";
}

function getStake(row: PredictionRow) {
  return Math.max(0, Number(row.mise_simulee ?? 0));
}

function getGain(row: PredictionRow) {
  return Math.max(0, Number(row.gain_simule ?? 0));
}

function getOutcomeGain(row: PredictionRow, outcome: RunnerOutcomeRow | undefined, stake: number) {
  if (!outcome) return null;
  const rapport =
    row.pari_conseille === "GAGNANT"
      ? outcome.rapport_gagnant
      : row.pari_conseille === "PLACE"
        ? outcome.rapport_place
        : null;

  if (typeof rapport !== "number" || !Number.isFinite(rapport) || rapport <= 0) {
    return outcome.resultat_gagnant || outcome.resultat_place ? null : 0;
  }

  return round2(stake * rapport);
}

function getOdds(row: PredictionRow) {
  const odds = row.cote_depart ?? row.cote_matin ?? null;
  return odds !== null && Number.isFinite(odds) && odds > 0 ? odds : null;
}

function isSettled(row: PredictionRow) {
  return (
    row.gain_simule !== null ||
    row.resultat_gagnant !== null ||
    row.resultat_place !== null
  );
}

function isPlayable(row: PredictionRow) {
  return row.decision !== "REJET" && getStake(row) > 0 && isSettled(row);
}

function getEstimatedProbability(row: PredictionRow) {
  const score = row.score_blended ?? row.score_cheval ?? 0;
  return Math.max(0, Math.min(1, score / 100));
}

function getCalibrationBin(probability: number) {
  return (
    CALIBRATION_BINS.find(
      (bin) => probability >= bin.min && probability < bin.max
    ) ?? CALIBRATION_BINS[CALIBRATION_BINS.length - 1]
  );
}

function buildTimeline(rows: PredictionRow[]): PerformanceTimelinePoint[] {
  const byDate = new Map<string, { stake: number; gain: number; count: number }>();
  for (const row of rows) {
    const current = byDate.get(row.date) ?? { stake: 0, gain: 0, count: 0 };
    current.stake += getStake(row);
    current.gain += getGain(row);
    current.count += 1;
    byDate.set(row.date, current);
  }

  let cumulativeStake = 0;
  let cumulativeGain = 0;
  let peakProfit = 0;
  return [...byDate.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, values]) => {
      cumulativeStake += values.stake;
      cumulativeGain += values.gain;
      const profit = round2(values.gain - values.stake);
      const cumulativeProfit = round2(cumulativeGain - cumulativeStake);
      peakProfit = Math.max(peakProfit, cumulativeProfit);
      return {
        date,
        stake: round2(values.stake),
        gain: round2(values.gain),
        profit,
        betCount: values.count,
        cumulativeProfit,
        cumulativeRoi: roi(cumulativeStake, cumulativeGain),
        drawdown: round2(Math.max(0, peakProfit - cumulativeProfit)),
      };
    });
}

function buildRangeSummary(
  period: Exclude<PerformancePeriod, "all">,
  rows: PredictionRow[],
  generatedAt: string
): PerformanceRangeSummary {
  const { startIso, endIso } = getPerformanceDateRange(period, new Date(generatedAt));
  const rangeRows = rows.filter((row) => isDateInRange(row.date, startIso, endIso) && isPlayable(row));
  const stake = round2(rangeRows.reduce((sum, row) => sum + getStake(row), 0));
  const gain = round2(rangeRows.reduce((sum, row) => sum + getGain(row), 0));

  return {
    period,
    label: period,
    roi: roi(stake, gain),
    stake,
    gain,
    netGain: round2(gain - stake),
    bets: rangeRows.length,
    timeline: buildTimeline(rangeRows),
  };
}

function buildComparisonRows(
  rows: PredictionRow[],
  outcomeMap: Map<string, RunnerOutcomeRow>
): PerformanceComparisonRow[] {
  return rows
    .filter((row) => row.decision !== "REJET" && getStake(row) > 0)
    .sort((left, right) => {
      const dateCompare = right.date.localeCompare(left.date);
      if (dateCompare !== 0) return dateCompare;
      if (right.reunion !== left.reunion) return right.reunion - left.reunion;
      return right.course - left.course;
    })
    .slice(0, 60)
    .map((row) => {
      const actualStake = getStake(row);
      const outcome = outcomeMap.get(
        `${row.date}-${row.reunion}-${row.course}-${row.cheval_num}`
      );
      const finishPosition =
        typeof outcome?.ordre_arrivee === "number" && outcome.ordre_arrivee > 0
          ? outcome.ordre_arrivee
          : null;
      const gain =
        row.gain_simule !== null
          ? getGain(row)
          : getOutcomeGain(row, outcome, actualStake) ?? getGain(row);
      const outcomeResult =
        finishPosition === null
          ? null
          : finishPosition === 1
            ? "GAGNANT"
            : finishPosition <= 3
              ? "PLACE"
              : "PERDU";
      const result =
        outcomeResult ??
        (!isSettled(row)
          ? "EN_ATTENTE"
          : row.resultat_gagnant
            ? "GAGNANT"
            : row.resultat_place
              ? "PLACE"
              : "PERDU");

      return {
        id: `${row.date}-${row.reunion}-${row.course}-${row.cheval_num}`,
        date: row.date,
        raceLabel: `R${row.reunion}C${row.course}`,
        hippodrome: row.hippodrome,
        cheval: `#${row.cheval_num} ${row.cheval_nom}`,
        finishPosition,
        betType: row.pari_conseille ?? null,
        decision: row.decision,
        suggestedStake: actualStake,
        actualStake,
        gain,
        netGain: round2(gain - actualStake),
        roi: roi(actualStake, gain),
        result,
      };
    });
}

export function buildPerformanceDashboard(
  predictions: PredictionRow[],
  courses: CourseRecordRow[],
  filters: PerformanceFilters,
  generatedAt = new Date().toISOString(),
  range: { startIso: string; endIso: string } | null = null,
  outcomes: RunnerOutcomeRow[] = []
): PerformanceDashboard {
  const courseMap = new Map(courses.map((course) => [predictionKey(course), course] as const));
  const outcomeMap = new Map(outcomes.map((outcome) => [runnerOutcomeKey(outcome), outcome] as const));
  const segmentByRace = new Map<string, SegmentKey>(
    courses.map((course) => [predictionKey(course), getSegmentForCourse(course)] as const)
  );
  const activeRange = getPerformanceDateRange(filters.period, new Date(generatedAt));
  const hippodromeFilter = normalizePerformanceHippodrome(filters.hippodrome ?? "ALL");
  const distanceFilter = normalizePerformanceDistance(filters.distance ?? "ALL");
  const normalizedFilters: PerformanceFilters = {
    ...filters,
    hippodrome: hippodromeFilter,
    distance: distanceFilter,
  };
  const availableHippodromes = [...new Set(courses.map((course) => course.hippodrome).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "fr"));

  const dateFiltered = predictions.filter((row) =>
    isDateInRange(row.date, activeRange.startIso, activeRange.endIso)
  );
  const contextFiltered = dateFiltered.filter((row) => {
    if (filters.betType !== "ALL" && row.pari_conseille !== filters.betType) {
      return false;
    }

    const course = courseMap.get(predictionKey(row));
    if (hippodromeFilter !== "ALL" && row.hippodrome !== hippodromeFilter && course?.hippodrome !== hippodromeFilter) {
      return false;
    }

    if (distanceFilter !== "ALL" && getDistanceBucket(course) !== distanceFilter) {
      return false;
    }

    return true;
  });
  const segmentFiltered = contextFiltered.filter((row) => {
    const segment = segmentByRace.get(predictionKey(row)) ?? getSegmentForCourse(courseMap.get(predictionKey(row)));
    return filters.segment === "ALL" || segment === filters.segment;
  });
  const playableRows = segmentFiltered.filter(isPlayable);
  const pendingBets = segmentFiltered.filter(
    (row) => row.decision !== "REJET" && getStake(row) > 0 && !isSettled(row)
  ).length;
  const rejectedRows = segmentFiltered.filter((row) => row.decision === "REJET").length;
  const totalStake = round2(playableRows.reduce((sum, row) => sum + getStake(row), 0));
  const totalGain = round2(playableRows.reduce((sum, row) => sum + getGain(row), 0));
  const wins = playableRows.filter((row) => row.resultat_gagnant === true).length;
  const places = playableRows.filter((row) => row.resultat_place === true).length;

  const timeline = buildTimeline(playableRows);
  const rangeSummarySourceRows = predictions.filter((row) => {
    if (filters.betType !== "ALL" && row.pari_conseille !== filters.betType) {
      return false;
    }
    const course = courseMap.get(predictionKey(row));
    if (hippodromeFilter !== "ALL" && row.hippodrome !== hippodromeFilter && course?.hippodrome !== hippodromeFilter) {
      return false;
    }
    if (distanceFilter !== "ALL" && getDistanceBucket(course) !== distanceFilter) {
      return false;
    }
    const segment = segmentByRace.get(predictionKey(row)) ?? getSegmentForCourse(course);
    return filters.segment === "ALL" || segment === filters.segment;
  });
  const rangeSummaries = (["7j", "30j", "90j"] as const).map((period) =>
    buildRangeSummary(period, rangeSummarySourceRows, generatedAt)
  );

  const segments = PERFORMANCE_SEGMENTS.map((segment) => {
    const rows = contextFiltered.filter((row) => {
      const rowSegment =
        segmentByRace.get(predictionKey(row)) ?? getSegmentForCourse(courseMap.get(predictionKey(row)));
      return rowSegment === segment && isPlayable(row);
    });
    const stake = round2(rows.reduce((sum, row) => sum + getStake(row), 0));
    const gain = round2(rows.reduce((sum, row) => sum + getGain(row), 0));
    const segmentWins = rows.filter((row) => row.resultat_gagnant === true).length;
    const segmentPlaces = rows.filter((row) => row.resultat_place === true).length;
    const odds = rows.map(getOdds).filter((value): value is number => value !== null);
    return {
      segment,
      bets: rows.length,
      wins: segmentWins,
      places: segmentPlaces,
      roi: roi(stake, gain),
      winRate: percent(segmentWins, rows.length),
      placeRate: percent(segmentPlaces, rows.length),
      stake,
      gain,
      netGain: round2(gain - stake),
      averageConfidence: average(rows.map((row) => row.confiance)),
      averageOdds: odds.length > 0 ? average(odds) : null,
    };
  });

  const calibrationBuckets = CALIBRATION_BINS.map((bin) => ({
    ...bin,
    sampleSize: 0,
    probabilitySum: 0,
    wins: 0,
  }));

  for (const row of segmentFiltered.filter(isSettled)) {
    const probability = getEstimatedProbability(row);
    const bin = getCalibrationBin(probability);
    const bucket = calibrationBuckets.find((item) => item.label === bin.label);
    if (!bucket) continue;
    bucket.sampleSize += 1;
    bucket.probabilitySum += probability;
    if (row.resultat_gagnant === true) {
      bucket.wins += 1;
    }
  }

  const calibration = calibrationBuckets.map((bucket) => {
    const averageProbability =
      bucket.sampleSize > 0 ? round2((bucket.probabilitySum / bucket.sampleSize) * 100) : 0;
    const actualWinRate = percent(bucket.wins, bucket.sampleSize);
    return {
      label: bucket.label,
      min: bucket.min,
      max: bucket.max,
      sampleSize: bucket.sampleSize,
      averageProbability,
      actualWinRate,
      delta: round2(actualWinRate - averageProbability),
    };
  });
  const calibrationSampleSize = calibration.reduce((sum, bin) => sum + bin.sampleSize, 0);
  const calibrationError =
    calibrationSampleSize > 0
      ? round2(
          calibration.reduce((sum, bin) => sum + Math.abs(bin.delta) * bin.sampleSize, 0) /
            calibrationSampleSize
        )
      : 0;
  const profits = timeline.map((point) => point.profit);
  const settledDates = playableRows.map((row) => row.date).sort((left, right) => left.localeCompare(right));

  return {
    filters: normalizedFilters,
    range: {
      startIso: range?.startIso ?? activeRange.startIso,
      endIso: range?.endIso ?? activeRange.endIso,
      firstSettledDate: settledDates[0] ?? null,
      lastSettledDate: settledDates[settledDates.length - 1] ?? null,
    },
    kpis: {
      globalRoi: roi(totalStake, totalGain),
      validatedBets: playableRows.length,
      winRate: percent(wins, playableRows.length),
      placeRate: percent(places, playableRows.length),
      netGain: round2(totalGain - totalStake),
      totalStake,
      totalGain,
      paybackRate: totalStake > 0 ? round2((totalGain / totalStake) * 100) : 0,
    },
    risk: {
      pendingBets,
      rejectedRows,
      maxDrawdown: round2(Math.max(...timeline.map((point) => point.drawdown), 0)),
      bestDayProfit: profits.length > 0 ? round2(Math.max(...profits)) : 0,
      worstDayProfit: profits.length > 0 ? round2(Math.min(...profits)) : 0,
      averageStake: playableRows.length > 0 ? round2(totalStake / playableRows.length) : 0,
      calibrationError,
      calibrationSampleSize,
    },
    rangeSummaries,
    timeline,
    segments,
    calibration,
    comparisonRows: buildComparisonRows(segmentFiltered, outcomeMap),
    availableHippodromes,
    generatedAt,
  };
}
