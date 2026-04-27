import { getPredictionScore, getSelectedPredictions } from "@/lib/public-performance";
import type { PushNotificationPayload } from "@/lib/push-notifications";
import type { PredictionRow, RaceSummary } from "@/lib/types";

function getRaceKeyFromRace(race: Pick<RaceSummary, "dateStr" | "reunion" | "course">) {
  return `${race.dateStr}:${race.reunion}:${race.course}`;
}

function getRaceKeyFromPrediction(row: Pick<PredictionRow, "date" | "reunion" | "course">) {
  return `${row.date}:${row.reunion}:${row.course}`;
}

function getBetTypeLabel(value?: string | null) {
  return value === "GAGNANT" ? "gagnant" : "place";
}

function getConfidenceLabel(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }

  return `${Math.round(value)}%`;
}

function getMorningTopSelection(rows: PredictionRow[]) {
  return [...getSelectedPredictions(rows)].sort((left, right) => {
    if (left.decision !== right.decision) {
      if (left.decision === "VALIDE") return -1;
      if (right.decision === "VALIDE") return 1;
    }

    const confidenceDiff = (right.confiance ?? 0) - (left.confiance ?? 0);
    if (confidenceDiff !== 0) {
      return confidenceDiff;
    }

    return getPredictionScore(right) - getPredictionScore(left);
  })[0] ?? null;
}

export function buildMorningHighlightNotification(
  dateStr: string,
  races: RaceSummary[],
  rows: PredictionRow[]
): PushNotificationPayload | null {
  const topSelection = getMorningTopSelection(rows);
  if (!topSelection) {
    return null;
  }

  const raceByKey = new Map(races.map((race) => [getRaceKeyFromRace(race), race] as const));
  const race = raceByKey.get(getRaceKeyFromPrediction(topSelection));
  if (!race) {
    return null;
  }

  const raceCode = `R${race.reunion}C${race.course}`;
  const title = topSelection.decision === "VALIDE" ? "CHEVAL DU JOUR" : "COURSE DU JOUR";
  const body = `${race.hippodrome} ${raceCode} a ${race.heureDepart} - #${topSelection.cheval_num} ${topSelection.cheval_nom} - pari ${getBetTypeLabel(topSelection.pari_conseille)} - confiance ${getConfidenceLabel(topSelection.confiance)}`;
  const url = `/course/${race.reunion}/${race.course}?date=${dateStr}`;

  return {
    title,
    body,
    url,
    icon: "/logo-turfedge.png",
    badge: "/favicon.ico",
    tag: `turfedge-morning-${dateStr}`,
    actions: [
      { action: "open-race", title: "Voir la course" },
      { action: "open-home", title: "Ouvrir TurfEdge" },
    ],
    data: {
      url,
      actionUrl: "/",
      kind: "morning-highlight",
      raceCode,
      horseNumber: topSelection.cheval_num,
    },
  };
}

export function buildPreRaceHighlightNotification(
  dateStr: string,
  race: RaceSummary,
  row: PredictionRow,
  minutesUntilStart: number
): PushNotificationPayload {
  const raceCode = `R${race.reunion}C${race.course}`;
  const url = `/course/${race.reunion}/${race.course}?date=${dateStr}`;

  return {
    title: "DEPART DANS 30 MIN",
    body: `${race.hippodrome} ${raceCode} - #${row.cheval_num} ${row.cheval_nom} - pari ${getBetTypeLabel(row.pari_conseille)} - confiance ${getConfidenceLabel(row.confiance)} - depart dans ${minutesUntilStart} min`,
    url,
    icon: "/logo-turfedge.png",
    badge: "/favicon.ico",
    tag: `turfedge-prerace-${dateStr}-${race.reunion}-${race.course}`,
    requireInteraction: true,
    renotify: false,
    actions: [
      { action: "open-race", title: "Voir la course" },
      { action: "open-home", title: "Tableau du jour" },
    ],
    data: {
      url,
      actionUrl: "/dashboard",
      kind: "prerace-highlight",
      raceCode,
      horseNumber: row.cheval_num,
    },
  };
}
