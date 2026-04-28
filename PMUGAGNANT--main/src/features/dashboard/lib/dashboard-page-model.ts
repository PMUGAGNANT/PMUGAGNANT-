import { getMinutesUntilStart } from "@/lib/date-utils";
import type { PredictionRow, RaceSummary } from "@/lib/types";
import { getVmaxRaceStatus, type VmaxRaceStatus } from "@/features/vmax/vmax-model";

export type DashboardFilter = "ALL" | "QUINTE" | "COUPLE" | "TIERCE";

export type DashboardRace = {
  race: RaceSummary;
  predictions: PredictionRow[];
  status: VmaxRaceStatus;
  confidence: number;
  topNumbers: number[];
  raceType: DashboardFilter;
  searchText: string;
};

export type DashboardInsightItem = {
  numero: number;
  cheval: string;
  note: string;
};

export type DashboardHeroModel = {
  verdict: "JOUER" | "SURVEILLER" | "PASSER";
  verdictClass: "is-play" | "is-watch" | "is-pass";
  confidenceLabel: string;
  stake: number | null;
  bases: DashboardInsightItem[];
  outsiders: DashboardInsightItem[];
  eliminations: DashboardInsightItem[];
};

export type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function normalizeDashboardFilter(
  value: string | string[] | undefined
): DashboardFilter {
  const normalized = normalizeSearch(getSingleSearchParam(value) ?? "");
  if (normalized === "QUINTE") return "QUINTE";
  if (normalized === "COUPLE") return "COUPLE";
  if (normalized === "TIERCE") return "TIERCE";
  return "ALL";
}

export function getRaceKeyFromSummary(
  race: Pick<RaceSummary, "reunion" | "course">
) {
  return `${race.reunion}-${race.course}`;
}

export function inferRaceType(race: RaceSummary): DashboardFilter {
  const label = normalizeSearch(`${race.nomCourse} ${race.discipline}`);
  if (race.estQuinte || label.includes("QUINTE")) return "QUINTE";
  if (label.includes("COUPLE")) return "COUPLE";
  if (label.includes("TIERCE")) return "TIERCE";
  return "ALL";
}

export function matchesDashboardFilter(
  item: DashboardRace,
  filter: DashboardFilter
) {
  if (filter === "ALL") return true;
  if (filter === "QUINTE") return item.raceType === "QUINTE";
  if (filter === "COUPLE") {
    return item.raceType === "COUPLE" || (!item.race.estQuinte && item.race.nombrePartants >= 6);
  }
  return item.raceType === "TIERCE" || item.race.nombrePartants >= 8;
}

export function matchesDashboardSearch(item: DashboardRace, query: string) {
  const normalized = normalizeSearch(query.trim());
  if (!normalized) return true;
  return item.searchText.includes(normalized);
}

export function groupPredictionsByRace(rows: PredictionRow[]) {
  const map = new Map<string, PredictionRow[]>();
  for (const row of rows) {
    const key = `${row.reunion}-${row.course}`;
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
  }
  return map;
}

export function getRaceStatus(race: RaceSummary, predictions: PredictionRow[]) {
  const minutesUntilStart = getMinutesUntilStart(race.heureDepart, race.dateStr);
  const finished = predictions.some(
    (prediction) =>
      prediction.resultat_gagnant !== null || prediction.resultat_place !== null
  );
  return getVmaxRaceStatus(finished ? "finished" : null, minutesUntilStart);
}

export function getSelectionPriority(row: PredictionRow) {
  if (row.decision === "VALIDE") return 3;
  if (row.decision === "SURVEILLANCE") return 2;
  return 1;
}

export function getSelectionScore(row: PredictionRow) {
  return row.score_blended ?? row.score_cheval ?? row.score_final_pari ?? 0;
}

export function getRaceConfidence(predictions: PredictionRow[]) {
  const best = predictions[0];
  if (!best) return 0;
  return Math.max(0, Math.min(100, Math.round(best.confiance * 10 || best.score_cheval)));
}

export function getTopNumbers(predictions: PredictionRow[]) {
  const numbers = [...predictions]
    .filter((prediction) => prediction.decision !== "REJET" && !prediction.non_partant)
    .sort((left, right) => {
      const priorityDiff = getSelectionPriority(right) - getSelectionPriority(left);
      if (priorityDiff !== 0) return priorityDiff;
      return getSelectionScore(right) - getSelectionScore(left);
    })
    .map((prediction) => prediction.cheval_num)
    .filter((value) => Number.isFinite(value));
  return numbers.slice(0, 3);
}

export function buildDashboardRaces(
  races: RaceSummary[],
  predictions: PredictionRow[],
  searchTextByRace: Map<string, string>
) {
  const byRace = groupPredictionsByRace(predictions);
  return races.map((race) => {
    const raceKey = getRaceKeyFromSummary(race);
    const racePredictions = byRace.get(raceKey) ?? [];
    const predictionText = racePredictions
      .map((prediction) => prediction.cheval_nom)
      .join(" ");
    return {
      race,
      predictions: racePredictions,
      status: getRaceStatus(race, racePredictions),
      confidence: getRaceConfidence(racePredictions),
      topNumbers: getTopNumbers(racePredictions),
      raceType: inferRaceType(race),
      searchText: normalizeSearch(
        `${race.hippodrome} ${race.nomCourse} ${race.discipline} ${predictionText} ${
          searchTextByRace.get(raceKey) ?? ""
        }`
      ),
    } satisfies DashboardRace;
  });
}

export function getHeroRace(items: DashboardRace[]) {
  const quinte = items.find((item) => item.race.estQuinte && item.status !== "finished");
  if (quinte) return quinte;
  return [...items].sort((left, right) => right.confidence - left.confidence)[0] ?? null;
}

function getHeroVerdict(predictions: PredictionRow[]) {
  const best = [...predictions]
    .filter((prediction) => !prediction.non_partant)
    .sort((left, right) => {
      const priorityDiff = getSelectionPriority(right) - getSelectionPriority(left);
      if (priorityDiff !== 0) return priorityDiff;
      return getSelectionScore(right) - getSelectionScore(left);
    })[0];

  if (!best) return "SURVEILLER" as const;
  if (best.decision === "VALIDE") return "JOUER" as const;
  if (best.decision === "SURVEILLANCE") return "SURVEILLER" as const;
  return "PASSER" as const;
}

function getConfidenceLabel(confidence: number) {
  if (confidence >= 75) return "Lecture claire";
  if (confidence >= 55) return "Lecture jouable";
  return "Lecture prudente";
}

function toInsightItem(
  row: PredictionRow,
  note: string
): DashboardInsightItem {
  return {
    numero: row.cheval_num,
    cheval: row.cheval_nom,
    note,
  };
}

export function buildDashboardHeroModel(hero: DashboardRace | null): DashboardHeroModel | null {
  if (!hero) return null;

  const verdict = getHeroVerdict(hero.predictions);
  const used = new Set<number>();
  const sorted = [...hero.predictions]
    .filter((prediction) => !prediction.non_partant)
    .sort((left, right) => {
      const priorityDiff = getSelectionPriority(right) - getSelectionPriority(left);
      if (priorityDiff !== 0) return priorityDiff;
      return getSelectionScore(right) - getSelectionScore(left);
    });

  const bases = sorted
    .filter((row) => row.decision === "VALIDE" || (row.mise_simulee ?? 0) > 0)
    .slice(0, 3)
    .map((row) => {
      used.add(row.cheval_num);
      return toInsightItem(
        row,
        row.mise_simulee && row.mise_simulee > 0 ? "Mise active" : "Base prioritaire"
      );
    });

  const outsiders = sorted
    .filter((row) => !used.has(row.cheval_num))
    .filter((row) => row.decision !== "REJET")
    .filter((row) => row.outsider || (row.cote_depart ?? row.cote_matin ?? 0) >= 8)
    .slice(0, 2)
    .map((row) => {
      used.add(row.cheval_num);
      return toInsightItem(row, "Outsider jouable");
    });

  const eliminations = [...hero.predictions]
    .filter((row) => !used.has(row.cheval_num))
    .filter((row) => row.decision === "REJET" || getSelectionScore(row) < 45)
    .sort((left, right) => getSelectionScore(left) - getSelectionScore(right))
    .slice(0, 2)
    .map((row) => toInsightItem(row, "Signal faible"));

  return {
    verdict,
    verdictClass:
      verdict === "JOUER"
        ? "is-play"
        : verdict === "SURVEILLER"
          ? "is-watch"
          : "is-pass",
    confidenceLabel: getConfidenceLabel(hero.confidence),
    stake:
      sorted.find((prediction) => (prediction.mise_simulee ?? 0) > 0)?.mise_simulee ?? null,
    bases,
    outsiders,
    eliminations,
  };
}

export function getStatusLabel(status: VmaxRaceStatus) {
  if (status === "live") return "En cours";
  if (status === "finished") return "Termine";
  return "A venir";
}

export function getCompactBubbleClass(index: number) {
  if (index === 0) return "is-gold";
  if (index === 1) return "is-blue";
  return "is-muted";
}
