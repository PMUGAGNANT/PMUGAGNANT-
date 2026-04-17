"use client";

import { useEffect } from "react";
import {
  buildFeaturedRaces,
  coerceRaceSummaries,
  sortFeaturedRaces,
  type RaceScore,
  type RacesResponse,
  type ScoresResponse,
} from "@/features/home/lib/home-page-model";
import {
  fetchRaceScoresForDate,
  fetchRacesForDate,
  normalizeRaceScoresPayload,
} from "@/features/races/api/client";
import { getRaceTimestamp, getTodayDateStr } from "@/lib/date-utils";

const ALERT_SENT_PREFIX = "turfedge-priority-alert";
const MAX_ALERTS_PER_LOAD = 5;

function raceStartDate(dateStr: string, heureDepart?: string | null) {
  if (!/^\d{8}$/.test(dateStr) || !heureDepart) {
    return null;
  }

  try {
    const date = getRaceTimestamp(dateStr, heureDepart);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  } catch {
    return null;
  }
}

function alreadySent(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markSent(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Alerts can still display without localStorage.
  }
}

async function showPriorityNotification(input: {
  key: string;
  title: string;
  body: string;
  url: string;
}) {
  if (Notification.permission !== "granted" || alreadySent(input.key)) {
    return;
  }

  markSent(input.key);
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(input.title, {
    body: input.body,
    icon: "/logo-turfedge.png",
    badge: "/favicon.ico",
    tag: input.key,
    data: { url: input.url },
  });
}

export function PriorityRacePushScheduler() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    const timers: number[] = [];
    let cancelled = false;

    async function schedulePriorityAlerts() {
      const dateStr = getTodayDateStr();
      const [racesResponse, scoresResponse] = await Promise.all([
        fetchRacesForDate<RacesResponse>(dateStr),
        fetchRaceScoresForDate<ScoresResponse>(dateStr),
      ]);

      if (cancelled || !racesResponse.success) {
        return;
      }

      const scores = normalizeRaceScoresPayload<RaceScore>(
        scoresResponse?.success ? scoresResponse.scores ?? null : null,
        dateStr
      );
      const scoreMap = new Map(scores.map((score) => [`${score.reunion}-${score.course}`, score]));
      const featured = sortFeaturedRaces(
        buildFeaturedRaces(coerceRaceSummaries(racesResponse.races), scoreMap),
        "score"
      )
        .filter((item) => item.status === "jouable" && item.score?.pick)
        .slice(0, MAX_ALERTS_PER_LOAD);

      for (const item of featured) {
        const start = raceStartDate(dateStr, item.race.heureDepart);
        if (!start) continue;

        const alertAt = start.getTime() - 30 * 60 * 1000;
        const delay = alertAt - Date.now();
        if (delay < -2 * 60 * 1000 || delay > 8 * 60 * 60 * 1000) {
          continue;
        }

        const pick = item.score?.pick;
        const raceCode = `R${item.race.reunion}C${item.race.course}`;
        const confidence = pick?.confidence ?? item.confidence;
        const key = `${ALERT_SENT_PREFIX}-${dateStr}-${raceCode}`;
        const body = `${raceCode} demarre dans 30min - ${pick?.nom ?? "Favori"} favori confiance ${confidence.toFixed(1)}/10`;
        const url = `/course/${item.race.reunion}/${item.race.course}?date=${dateStr}`;
        const fire = () => {
          void showPriorityNotification({
            key,
            title: "Signal prioritaire TurfEdge",
            body,
            url,
          });
        };

        if (delay <= 0) {
          fire();
        } else {
          timers.push(window.setTimeout(fire, delay));
        }
      }
    }

    void schedulePriorityAlerts().catch(() => {});

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return null;
}
