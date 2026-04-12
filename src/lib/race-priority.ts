import { getPreRaceRefreshDecision } from "@/lib/race-refresh-policy";
import type { PredictionDecision, RaceSummary } from "@/lib/types";

export type RacePriorityStatus =
  | "jouable"
  | "surveillance"
  | "passer"
  | "resultat";

export type RacePriorityBadge = {
  label: string;
  detail: string;
  tone: "primary" | "warning" | "neutral";
  weight: number;
};

export function getPriorityToneColor(tone: RacePriorityBadge["tone"]) {
  switch (tone) {
    case "primary":
      return "var(--pmu-primary)";
    case "warning":
      return "var(--pmu-orange)";
    default:
      return "var(--pmu-text-muted)";
  }
}

function getRefreshDetailLabel(intervalMinutes: number | null) {
  if (intervalMinutes === null) {
    return "pas de cadence";
  }

  if (intervalMinutes <= 5) {
    return "controle 5 min";
  }

  if (intervalMinutes === 10) {
    return "suivi 10 min";
  }

  if (intervalMinutes === 30) {
    return "suivi 30 min";
  }

  if (intervalMinutes === 60) {
    return "suivi 1 h";
  }

  return `suivi ${intervalMinutes} min`;
}

export function getRacePriorityBadge(input: {
  race: RaceSummary;
  status: RacePriorityStatus;
  decision?: PredictionDecision | null;
  now?: Date;
}): RacePriorityBadge | null {
  const { race, status, decision, now = new Date() } = input;

  if (status === "resultat") {
    return null;
  }

  const refresh = getPreRaceRefreshDecision(race, now, {
    hasBoardGreenSignal: status === "jouable",
    hasPlayableSignal: decision === "VALIDE",
    hasWatchSignal: status === "surveillance" || decision === "SURVEILLANCE",
  });

  if (refresh.intervalMinutes === null) {
    return null;
  }

  if (refresh.reason.startsWith("board-verte")) {
    return {
      label: "Suivi renforce",
      detail: getRefreshDetailLabel(refresh.intervalMinutes),
      tone: "primary",
      weight: 4,
    };
  }

  if (refresh.reason.startsWith("quinte")) {
    return {
      label: "Quinte prioritaire",
      detail: getRefreshDetailLabel(refresh.intervalMinutes),
      tone: "warning",
      weight: 3,
    };
  }

  if (refresh.reason.startsWith("signal-valide")) {
    return {
      label: "Signal moteur",
      detail: getRefreshDetailLabel(refresh.intervalMinutes),
      tone: "primary",
      weight: 3,
    };
  }

  if (refresh.reason.startsWith("variation-forte")) {
    return {
      label: "Marche actif",
      detail: getRefreshDetailLabel(refresh.intervalMinutes),
      tone: "warning",
      weight: 2,
    };
  }

  return null;
}
