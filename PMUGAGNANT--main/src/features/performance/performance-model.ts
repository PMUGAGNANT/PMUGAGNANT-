import { getRaceSegmentKey } from "@/lib/engine-v6";
import type { CourseRecordRow, PredictionRow, RaceSummary, SegmentKey } from "@/lib/types";

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

export interface PerformanceFilters {
  period: PerformancePeriod;
  segment: PerformanceSegmentFilter;
  betType: PerformanceBetType;
}

export interface PerformanceKpis {
  globalRoi: number;
  validatedBets: number;
  winRate: number;
  placeRate: number;
  netGain: number;
  totalStake: number;
  totalGain: number;
}

export interface PerformanceTimelinePoint {
  date: string;
  stake: number;
  gain: number;
  profit: number;
  cumulativeProfit: number;
  cumulativeRoi: number;
}

export interface PerformanceSegmentRow {
  segment: SegmentKey;
  bets: number;
  roi: number;
  winRate: number;
  stake: number;
  gain: number;
}

export interface PerformanceCalibrationBin {
  label: string;
  min: number;
  max: number;
  sampleSize: number;
  averageProbability: number;
  actualWinRate: number;
}

export interface PerformanceDashboard {
  filters: PerformanceFilters;
  kpis: PerformanceKpis;
  timeline: PerformanceTimelinePoint[];
  segments: PerformanceSegmentRow[];
  calibration: PerformanceCalibrationBin[];
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

export function buildPerformanceDashboard(
  predictions: PredictionRow[],
  courses: CourseRecordRow[],
  filters: PerformanceFilters,
  generatedAt = new Date().toISOString()
): PerformanceDashboard {
  const courseMap = new Map(courses.map((course) => [predictionKey(course), course] as const));
  const segmentByRace = new Map<string, SegmentKey>(
    courses.map((course) => [predictionKey(course), getSegmentForCourse(course)] as const)
  );

  const betTypeFiltered = predictions.filter((row) => {
    if (filters.betType !== "ALL" && row.pari_conseille !== filters.betType) {
      return false;
    }
    return true;
  });
  const segmentFiltered = betTypeFiltered.filter((row) => {
    const segment = segmentByRace.get(predictionKey(row)) ?? getSegmentForCourse(courseMap.get(predictionKey(row)));
    return filters.segment === "ALL" || segment === filters.segment;
  });
  const playableRows = segmentFiltered.filter(isPlayable);
  const totalStake = round2(playableRows.reduce((sum, row) => sum + getStake(row), 0));
  const totalGain = round2(playableRows.reduce((sum, row) => sum + getGain(row), 0));
  const wins = playableRows.filter((row) => row.resultat_gagnant === true).length;
  const places = playableRows.filter((row) => row.resultat_place === true).length;

  const byDate = new Map<string, { stake: number; gain: number }>();
  for (const row of playableRows) {
    const current = byDate.get(row.date) ?? { stake: 0, gain: 0 };
    current.stake += getStake(row);
    current.gain += getGain(row);
    byDate.set(row.date, current);
  }

  let cumulativeStake = 0;
  let cumulativeGain = 0;
  const timeline = [...byDate.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, values]) => {
      cumulativeStake += values.stake;
      cumulativeGain += values.gain;
      const profit = round2(values.gain - values.stake);
      return {
        date,
        stake: round2(values.stake),
        gain: round2(values.gain),
        profit,
        cumulativeProfit: round2(cumulativeGain - cumulativeStake),
        cumulativeRoi: roi(cumulativeStake, cumulativeGain),
      };
    });

  const segments = PERFORMANCE_SEGMENTS.map((segment) => {
    const rows = betTypeFiltered.filter((row) => {
      const rowSegment =
        segmentByRace.get(predictionKey(row)) ?? getSegmentForCourse(courseMap.get(predictionKey(row)));
      return rowSegment === segment && isPlayable(row);
    });
    const stake = round2(rows.reduce((sum, row) => sum + getStake(row), 0));
    const gain = round2(rows.reduce((sum, row) => sum + getGain(row), 0));
    return {
      segment,
      bets: rows.length,
      roi: roi(stake, gain),
      winRate: percent(rows.filter((row) => row.resultat_gagnant === true).length, rows.length),
      stake,
      gain,
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

  return {
    filters,
    kpis: {
      globalRoi: roi(totalStake, totalGain),
      validatedBets: playableRows.length,
      winRate: percent(wins, playableRows.length),
      placeRate: percent(places, playableRows.length),
      netGain: round2(totalGain - totalStake),
      totalStake,
      totalGain,
    },
    timeline,
    segments,
    calibration: calibrationBuckets.map((bucket) => ({
      label: bucket.label,
      min: bucket.min,
      max: bucket.max,
      sampleSize: bucket.sampleSize,
      averageProbability:
        bucket.sampleSize > 0 ? round2((bucket.probabilitySum / bucket.sampleSize) * 100) : 0,
      actualWinRate: percent(bucket.wins, bucket.sampleSize),
    })),
    generatedAt,
  };
}
