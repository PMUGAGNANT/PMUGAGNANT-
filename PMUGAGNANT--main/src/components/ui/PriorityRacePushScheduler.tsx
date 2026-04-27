"use client";

import { useEffect } from "react";
import {
  buildMorningHighlightNotification,
  buildPreRaceHighlightNotification,
} from "@/lib/push-campaigns";
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
const DAY_HIGHLIGHT_PREFIX = "turfedge-day-highlight";

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
  tag?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
}) {
  if (Notification.permission !== "granted" || alreadySent(input.key)) {
    return;
  }

  markSent(input.key);
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(input.title, {
    body: input.body,
    icon: input.icon ?? "/logo-turfedge.png",
    badge: input.badge ?? "/favicon.ico",
    tag: input.tag ?? input.key,
    requireInteraction: input.requireInteraction ?? false,
    data: { url: input.url, ...(input.data ?? {}) },
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
      const races = coerceRaceSummaries(racesResponse.races);
      const scoreMap = new Map(scores.map((score) => [`${score.reunion}-${score.course}`, score]));
      const featured = sortFeaturedRaces(
        buildFeaturedRaces(races, scoreMap),
        "score"
      )
        .filter((item) => item.status === "jouable" && item.score?.pick)
        .slice(0, MAX_ALERTS_PER_LOAD);

      const localRows = scores.filter((score) => score.pick?.numPmu);
      const dayHighlight = buildMorningHighlightNotification(
        dateStr,
        races,
        localRows.flatMap((score) =>
          score.pick?.numPmu
            ? [
                {
                  date: dateStr,
                  reunion: score.reunion,
                  course: score.course,
                  hippodrome:
                    races.find(
                      (race) => race.reunion === score.reunion && race.course === score.course
                    )?.hippodrome ?? "",
                  cheval_num: score.pick.numPmu,
                  cheval_nom: score.pick.nom ?? "Selection TurfEdge",
                  score_cheval: score.score ?? 0,
                  score_blended: score.score ?? null,
                  score_final_pari: score.score ?? null,
                  confiance: score.pick.confidence ?? score.score ?? 0,
                  qualite: score.score ?? 0,
                  lisibilite: score.lisibilite,
                  value: score.pick.edge ?? null,
                  cote_matin: score.pick.cote ?? null,
                  cote_depart: score.pick.cote ?? null,
                  variation_cote: null,
                  signal_variation: null,
                  decision: score.decision,
                  pari_conseille:
                    score.pick.betType === "GAGNANT" ? "GAGNANT" : "PLACE",
                  outsider: false,
                  mise_simulee: score.pick.stake ?? 0,
                  resultat_place: null,
                  resultat_gagnant: null,
                  rapport_place: null,
                  rapport_gagnant: null,
                  gain_simule: null,
                },
              ]
            : []
        )
      );

      if (dayHighlight) {
        void showPriorityNotification({
          key: `${DAY_HIGHLIGHT_PREFIX}-${dateStr}`,
          title: dayHighlight.title,
          body: dayHighlight.body,
          url: dayHighlight.url,
          tag: dayHighlight.tag,
          icon: dayHighlight.icon,
          badge: dayHighlight.badge,
          data: dayHighlight.data,
        });
      }

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
        const key = `${ALERT_SENT_PREFIX}-${dateStr}-${raceCode}`;
        if (!pick?.numPmu || !pick?.nom) {
          continue;
        }
        const notification = buildPreRaceHighlightNotification(
          dateStr,
          item.race,
          {
            date: dateStr,
            reunion: item.race.reunion,
            course: item.race.course,
            hippodrome: item.race.hippodrome,
            cheval_num: pick.numPmu,
            cheval_nom: pick.nom,
            score_cheval: item.score?.score ?? item.confidence,
            score_blended: item.score?.score ?? null,
            score_final_pari: item.score?.score ?? null,
            confiance: pick.confidence ?? item.confidence,
            qualite: item.score?.score ?? item.confidence,
            lisibilite: item.score?.lisibilite ?? "LISIBLE",
            value: pick.edge ?? null,
            cote_matin: pick.cote ?? null,
            cote_depart: pick.cote ?? null,
            variation_cote: null,
            signal_variation: null,
            decision: item.score?.decision ?? "VALIDE",
            pari_conseille: pick.betType === "GAGNANT" ? "GAGNANT" : "PLACE",
            outsider: false,
            mise_simulee: pick.stake ?? 0,
            resultat_place: null,
            resultat_gagnant: null,
            rapport_place: null,
            rapport_gagnant: null,
            gain_simule: null,
          },
          Math.max(1, Math.round(delay / 60000))
        );
        const fire = () => {
          void showPriorityNotification({
            key,
            title: notification.title,
            body: notification.body,
            url: notification.url,
            tag: notification.tag,
            icon: notification.icon,
            badge: notification.badge,
            requireInteraction: notification.requireInteraction,
            data: notification.data,
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
