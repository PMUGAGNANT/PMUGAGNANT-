"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  computeClientRaceScore,
  formatBetTypeLabelFr,
  getRaceProfile,
  type ApiRaceScoreLite,
} from "@/lib/client-race-scoring";
import { getMinutesUntilStart, getTodayDateStr } from "@/lib/date-utils";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";
import type { Lisibilite, PredictionDecision, RaceSummary } from "@/lib/types";
import { ConfidenceBadge } from "./ConfidenceBadge";

type ScoreStage = "preview_2h" | "preview_1h" | "final_30m" | "finished";

type RaceScore = {
  dateStr: string;
  reunion: number;
  course: number;
  score: number | null;
  scoreLocked?: boolean;
  stage: ScoreStage;
  lisibilite: Lisibilite;
  decision: PredictionDecision;
  playable: boolean;
  recommendation?: string | null;
  pick?: {
    numPmu?: number | null;
    nom?: string | null;
    decision?: string | null;
    betType?: string | null;
    confidence?: number | null;
    topFacteurs?: string[];
  } | null;
} | null;

type RacesResponse = {
  success: boolean;
  date: string;
  races?: RaceSummary[];
  error?: string;
};

type ScoresResponse = {
  success: boolean;
  scores?:
    | RaceScore[]
    | Record<string, Omit<NonNullable<RaceScore>, "dateStr" | "reunion" | "course">>
    | null;
  error?: string;
};

type SidebarQuinteState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "ready"; race: RaceSummary; score: RaceScore };

function normalizeDateParam(value: string | null) {
  return value && /^\d{8}$/.test(value) ? value : getTodayDateStr();
}

function normalizeScoresPayload(raw: ScoresResponse["scores"], dateStr: string): NonNullable<RaceScore>[] {
  if (
    raw == null ||
    typeof raw === "string" ||
    typeof raw === "number" ||
    typeof raw === "boolean"
  ) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is NonNullable<RaceScore> =>
        item != null &&
        typeof item.reunion === "number" &&
        typeof item.course === "number"
    );
  }

  return Object.entries(raw).flatMap(([key, entry]) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const [reunionStr, courseStr] = key.split("-");
    const reunion = Number(reunionStr);
    const course = Number(courseStr);

    if (!Number.isFinite(reunion) || !Number.isFinite(course)) {
      return [];
    }

    return [
      {
        dateStr,
        reunion,
        course,
        ...entry,
      },
    ];
  });
}

function toApiRaceScoreLite(score: RaceScore): ApiRaceScoreLite | undefined {
  if (!score) {
    return undefined;
  }

  return {
    score: score.score,
    scoreDetailsLocked: score.scoreLocked === true,
    stage: score.stage,
    lisibilite: score.lisibilite,
    decision: score.decision,
    playable: score.playable,
    pick: score.pick ?? null,
  };
}

function pickSidebarQuinte(races: RaceSummary[]) {
  const quinteRaces = races
    .filter((race) => race.estQuinte)
    .map((race) => ({
      race,
      minutesUntilStart: getMinutesUntilStart(race.heureDepart, race.dateStr),
    }));

  if (quinteRaces.length === 0) {
    return null;
  }

  const upcomingOrLive = quinteRaces
    .filter((item) => item.minutesUntilStart > -15)
    .sort((left, right) => left.minutesUntilStart - right.minutesUntilStart);

  if (upcomingOrLive[0]) {
    return upcomingOrLive[0].race;
  }

  return quinteRaces.sort((left, right) => right.minutesUntilStart - left.minutesUntilStart)[0]
    ?.race ?? null;
}

function getStatusBadge(minutesUntilStart: number) {
  if (minutesUntilStart <= -10) {
    return {
      label: "Terminee",
      className:
        "border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] text-[var(--pmu-text-soft)]",
    };
  }

  if (minutesUntilStart <= 8) {
    return {
      label: "Live",
      className:
        "border-[color-mix(in_srgb,var(--pmu-primary)_30%,transparent)] bg-[var(--pmu-primary-soft)] text-[var(--pmu-primary)]",
    };
  }

  if (minutesUntilStart <= 60) {
    return {
      label: `T-${Math.max(1, Math.round(minutesUntilStart))} min`,
      className:
        "border-[color-mix(in_srgb,var(--pmu-orange)_30%,transparent)] bg-[color-mix(in_srgb,var(--pmu-orange)_10%,transparent)] text-[var(--pmu-orange)]",
    };
  }

  return {
    label: "A venir",
    className:
      "border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] text-[var(--pmu-text-soft)]",
  };
}

function getLisibiliteLabel(lisibilite: Lisibilite | undefined) {
  if (lisibilite === "LISIBLE") {
    return {
      label: "Lisible",
      className:
        "border-[color-mix(in_srgb,var(--pmu-primary)_28%,transparent)] bg-[var(--pmu-primary-fade)] text-[var(--pmu-primary)]",
    };
  }

  if (lisibilite === "COMPLEXE") {
    return {
      label: "Complexe",
      className:
        "border-[color-mix(in_srgb,var(--pmu-orange)_28%,transparent)] bg-[color-mix(in_srgb,var(--pmu-orange)_8%,transparent)] text-[var(--pmu-orange)]",
    };
  }

  return {
    label: "Loterie",
    className:
      "border-[color-mix(in_srgb,var(--pmu-red)_28%,transparent)] bg-[color-mix(in_srgb,var(--pmu-red)_8%,transparent)] text-[var(--pmu-red)]",
  };
}

function getPlayTierMeta(playTier: "jouable" | "surveillance" | "passer" | "resultat" | undefined) {
  if (playTier === "jouable") {
    return {
      label: "A suivre",
      badgeClass:
        "border-[color-mix(in_srgb,var(--pmu-primary)_32%,transparent)] bg-[var(--pmu-primary-fade)] text-[var(--pmu-primary)]",
      scoreClass: "text-[var(--pmu-primary)]",
      railClass:
        "bg-[linear-gradient(90deg,var(--pmu-primary)_0%,var(--pmu-primary-bright)_100%)]",
    };
  }

  if (playTier === "surveillance") {
    return {
      label: "Sous radar",
      badgeClass:
        "border-[color-mix(in_srgb,var(--pmu-orange)_32%,transparent)] bg-[color-mix(in_srgb,var(--pmu-orange)_10%,transparent)] text-[var(--pmu-orange)]",
      scoreClass: "text-[var(--pmu-orange)]",
      railClass:
        "bg-[linear-gradient(90deg,color-mix(in_srgb,var(--pmu-orange)_84%,white)_0%,var(--pmu-orange)_100%)]",
    };
  }

  if (playTier === "resultat") {
    return {
      label: "Resultat",
      badgeClass:
        "border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] text-[var(--pmu-text-soft)]",
      scoreClass: "text-[var(--pmu-text)]",
      railClass:
        "bg-[linear-gradient(90deg,color-mix(in_srgb,var(--pmu-text-soft)_86%,transparent)_0%,var(--pmu-text-soft)_100%)]",
    };
  }

  return {
    label: "A filtrer",
    badgeClass:
      "border-[color-mix(in_srgb,var(--pmu-red)_28%,transparent)] bg-[color-mix(in_srgb,var(--pmu-red)_8%,transparent)] text-[var(--pmu-red)]",
    scoreClass: "text-[var(--pmu-text)]",
    railClass:
      "bg-[linear-gradient(90deg,color-mix(in_srgb,var(--pmu-red)_72%,white)_0%,var(--pmu-red)_100%)]",
  };
}

function getRaceProfileMeta(status: string | undefined) {
  if (status === "SIGNAL_FORT") {
    return {
      label: "Signal fort",
      className:
        "border-[color-mix(in_srgb,var(--pmu-primary)_30%,transparent)] bg-[var(--pmu-primary-fade)] text-[var(--pmu-primary)]",
    };
  }

  if (status === "OPPORTUNITE_CACHEE") {
    return {
      label: "Value cachee",
      className:
        "border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[color-mix(in_srgb,var(--pmu-primary)_9%,transparent)] text-[var(--pmu-primary)]",
    };
  }

  if (status === "COURSE_PIEGE") {
    return {
      label: "Course piege",
      className:
        "border-[color-mix(in_srgb,var(--pmu-orange)_28%,transparent)] bg-[color-mix(in_srgb,var(--pmu-orange)_9%,transparent)] text-[var(--pmu-orange)]",
    };
  }

  if (status === "A_EVITER") {
    return {
      label: "A eviter",
      className:
        "border-[color-mix(in_srgb,var(--pmu-red)_28%,transparent)] bg-[color-mix(in_srgb,var(--pmu-red)_8%,transparent)] text-[var(--pmu-red)]",
    };
  }

  if (status === "FAVORI_DANGEREUX") {
    return {
      label: "Favori fragile",
      className:
        "border-[color-mix(in_srgb,var(--pmu-red)_28%,transparent)] bg-[color-mix(in_srgb,var(--pmu-red)_8%,transparent)] text-[var(--pmu-red)]",
    };
  }

  return {
    label: "Suivi",
    className:
      "border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] text-[var(--pmu-text-soft)]",
  };
}

function getWindowLabel(stage: ScoreStage | undefined, minutesUntilStart: number | null) {
  if (stage === "finished" || (minutesUntilStart != null && minutesUntilStart <= -10)) {
    return "Course terminee";
  }

  if (minutesUntilStart != null && minutesUntilStart <= 8) {
    return "Live desk";
  }

  if (stage === "final_30m") {
    return "Radar final";
  }

  if (stage === "preview_1h") {
    return "Radar 1h";
  }

  if (stage === "preview_2h") {
    return "Radar 2h";
  }

  return "Programme du jour";
}

function buildSelectionCopy({
  score,
  scoreSummary,
  isCurrentCourse,
  minutesUntilStart,
}: {
  score: RaceScore;
  scoreSummary: ReturnType<typeof computeClientRaceScore> | null;
  isCurrentCourse: boolean;
  minutesUntilStart: number | null;
}) {
  if (isCurrentCourse) {
    return "Le detail complet est deja ouvert dans cette page.";
  }

  const topFacteurs = score?.pick?.topFacteurs?.filter(Boolean).slice(0, 2) ?? [];
  if (topFacteurs.length > 0) {
    return topFacteurs.join(" - ");
  }

  const factors = scoreSummary?.factors?.filter(Boolean).slice(0, 2) ?? [];
  if (factors.length > 0) {
    return factors.join(" - ");
  }

  if (score?.recommendation) {
    return score.recommendation;
  }

  if (score?.scoreLocked) {
    return "Le ticket detaille reste reserve a l'acces premium.";
  }

  if ((minutesUntilStart ?? 999) > 120) {
    return "Le bloc se renforce a l'approche du depart.";
  }

  return "Analyse en consolidation.";
}

function QuinteSkeleton() {
  return (
    <section className="overflow-hidden rounded-[1.65rem] border border-[var(--pmu-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--pmu-surface-highlight)_34%,var(--pmu-surface))_0%,color-mix(in_srgb,var(--pmu-surface)_92%,transparent)_100%)] p-4">
      <div className="space-y-3 animate-pulse">
        <div className="h-3 w-28 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_16%,transparent)]" />
        <div className="h-20 rounded-[1.2rem] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)]" />
        <div className="h-24 rounded-[1.2rem] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)]" />
        <div className="h-11 rounded-[1rem] bg-[color-mix(in_srgb,var(--pmu-primary)_12%,transparent)]" />
      </div>
    </section>
  );
}

export function SidebarQuinteCard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedDate = normalizeDateParam(searchParams.get("date"));
  const [state, setState] = useState<SidebarQuinteState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ status: "loading" });

      try {
        const racesResponse = await fetch(`/api/races?date=${selectedDate}`, {
          cache: "no-store",
        });
        const racesPayload = (await racesResponse.json()) as RacesResponse;

        if (!racesResponse.ok || !racesPayload.success) {
          throw new Error(racesPayload.error ?? "Quinte indisponible.");
        }

        const raceList = Array.isArray(racesPayload.races) ? racesPayload.races : [];
        const quinteRace = pickSidebarQuinte(raceList);

        if (!quinteRace) {
          if (!cancelled) {
            setState({ status: "empty" });
          }
          return;
        }

        const minutesUntilStart = getMinutesUntilStart(
          quinteRace.heureDepart,
          quinteRace.dateStr
        );

        let score: RaceScore = null;

        if (minutesUntilStart <= 120) {
          const headers: HeadersInit = {};

          if (hasSupabaseConfig()) {
            const supabase = getSupabaseBrowserClient();
            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (session?.access_token) {
              headers.Authorization = `Bearer ${session.access_token}`;
            }
          }

          const scoresResponse = await fetch(`/api/races/scores?date=${selectedDate}`, {
            cache: "no-store",
            headers,
          });

          if (scoresResponse.ok) {
            const scoresPayload = (await scoresResponse.json()) as ScoresResponse;
            const scores = normalizeScoresPayload(scoresPayload.scores, selectedDate);
            score =
              scores.find(
                (entry) =>
                  entry.reunion === quinteRace.reunion &&
                  entry.course === quinteRace.course
              ) ?? null;
          }
        }

        if (!cancelled) {
          setState({
            status: "ready",
            race: quinteRace,
            score,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error ? error.message : "Bloc Quinte indisponible.",
          });
        }
      }
    }

    void load();

    const intervalId = window.setInterval(() => {
      void load();
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedDate]);

  const readyState = state.status === "ready" ? state : null;
  const minutesUntilStart = readyState
    ? getMinutesUntilStart(readyState.race.heureDepart, readyState.race.dateStr)
    : null;

  const scoreSummary = useMemo(() => {
    if (!readyState || minutesUntilStart === null) {
      return null;
    }

    const scoreLite = toApiRaceScoreLite(readyState.score);
    return computeClientRaceScore(readyState.race, scoreLite, minutesUntilStart);
  }, [minutesUntilStart, readyState]);

  const raceProfile = useMemo(() => {
    if (!readyState || !scoreSummary) {
      return null;
    }

    return getRaceProfile({
      race: readyState.race,
      displayScore: scoreSummary.displayScore,
      pick: readyState.score?.pick
        ? {
            numPmu: readyState.score.pick.numPmu ?? null,
            cote: null,
            confidence: readyState.score.pick.confidence ?? null,
          }
        : null,
    });
  }, [readyState, scoreSummary]);

  if (state.status === "loading") {
    return <QuinteSkeleton />;
  }

  if (state.status === "empty") {
    return (
      <section className="overflow-hidden rounded-[1.65rem] border border-[var(--pmu-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--pmu-surface-highlight)_34%,var(--pmu-surface))_0%,color-mix(in_srgb,var(--pmu-surface)_92%,transparent)_100%)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--pmu-text-muted)]">
            Quinte du jour
          </p>
          <span className="rounded-full border border-[var(--pmu-border)] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
            Programme
          </span>
        </div>
        <p className="mt-3 text-sm font-bold text-[var(--pmu-text)]">
          Aucun repere Quinte remonte pour cette journee.
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--pmu-text-soft)]">
          Le bloc se remplit des qu&apos;une course Quinte apparait dans le programme PMU.
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="overflow-hidden rounded-[1.65rem] border border-[var(--pmu-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--pmu-surface-highlight)_34%,var(--pmu-surface))_0%,color-mix(in_srgb,var(--pmu-surface)_92%,transparent)_100%)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--pmu-text-muted)]">
            Quinte du jour
          </p>
          <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-red)_24%,transparent)] bg-[color-mix(in_srgb,var(--pmu-red)_8%,transparent)] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[var(--pmu-red)]">
            Indispo
          </span>
        </div>
        <p className="mt-3 text-sm font-bold text-[var(--pmu-text)]">
          Bloc Quinte temporairement indisponible.
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--pmu-text-soft)]">
          {state.message}
        </p>
      </section>
    );
  }

  const { race, score } = state;
  const coursePath = `/course/${race.reunion}/${race.course}`;
  const courseHref = `${coursePath}?date=${selectedDate}`;
  const isCurrentCourse = pathname === coursePath;
  const statusBadge = getStatusBadge(minutesUntilStart ?? 999);
  const lisibilite = getLisibiliteLabel(score?.lisibilite);
  const playTierMeta = getPlayTierMeta(scoreSummary?.playTier);
  const raceProfileMeta = getRaceProfileMeta(raceProfile?.status);
  const windowLabel = getWindowLabel(score?.stage, minutesUntilStart);
  const scoreValue = scoreSummary ? scoreSummary.displayScore.toFixed(1) : "--";
  const scoreProgress = scoreSummary ? Math.max(12, Math.min(100, scoreSummary.displayScore * 10)) : 16;
  const numberBadge =
    score?.pick?.numPmu != null && Number.isFinite(score.pick.numPmu)
      ? String(score.pick.numPmu).padStart(2, "0")
      : null;
  const selectionTitle =
    score?.pick?.numPmu || score?.pick?.nom
      ? `N${score?.pick?.numPmu ?? "--"} ${score?.pick?.nom ?? "Selection"}`
      : score?.scoreLocked
        ? "Lecture complete reservee au premium"
        : (minutesUntilStart ?? 999) > 120
          ? "Pronostic detaille a l'approche de la course"
          : "Analyse en consolidation";
  const selectionCopy = buildSelectionCopy({
    score,
    scoreSummary,
    isCurrentCourse,
    minutesUntilStart,
  });
  const ticketLine =
    raceProfile?.ticketNums && raceProfile.ticketNums.length > 1
      ? raceProfile.ticketNums.join(" - ")
      : null;

  return (
    <section className="overflow-hidden rounded-[1.65rem] border border-[var(--pmu-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--pmu-surface-highlight)_36%,var(--pmu-surface))_0%,color-mix(in_srgb,var(--pmu-surface)_92%,transparent)_100%)] shadow-[var(--pmu-shadow-sm)]">
      <div className="relative p-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--pmu-primary)_16%,transparent),transparent_68%)] opacity-80" />

        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--pmu-text-muted)]">
              Quinte du jour
            </p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-primary)]">
              R{race.reunion}C{race.course}
            </p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
        </div>

        <div className="relative mt-4 rounded-[1.4rem] border border-[color-mix(in_srgb,var(--pmu-primary)_18%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--pmu-surface-highlight)_66%,var(--pmu-surface))_0%,color-mix(in_srgb,var(--pmu-surface-2)_88%,var(--pmu-surface))_100%)] p-4 shadow-[var(--pmu-shadow-sm)]">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-[1.05rem] font-black leading-tight text-[var(--pmu-text)]">
                {race.nomCourse}
              </h3>
              <p className="mt-2 text-xs leading-5 text-[var(--pmu-text-soft)]">
                {race.hippodrome} - {race.heureDepart} - {race.nombrePartants} partants
              </p>
            </div>

            <div className="min-w-[5.15rem] rounded-[1.2rem] border border-[color-mix(in_srgb,var(--pmu-primary)_20%,transparent)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] px-3 py-3 text-center shadow-[var(--pmu-shadow-sm)]">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
                Radar
              </p>
              <p
                className={`mt-1 text-[2rem] font-black tracking-[-0.06em] ${playTierMeta.scoreClass}`}
              >
                {scoreValue}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
                /10
              </p>
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--pmu-surface)_88%,transparent)]">
            <div
              className={`h-full rounded-full ${playTierMeta.railClass}`}
              style={{ width: `${scoreProgress}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] ${playTierMeta.badgeClass}`}
            >
              {playTierMeta.label}
            </span>
            <span
              className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] ${lisibilite.className}`}
            >
              {lisibilite.label}
            </span>
            <span
              className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] ${raceProfileMeta.className}`}
            >
              {raceProfileMeta.label}
            </span>
          </div>

          <div className="mt-4 rounded-[1.25rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
                  Ticket moteur
                </p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
                  {windowLabel}
                </p>
              </div>
              {score?.pick?.confidence ? (
                <ConfidenceBadge score={score.pick.confidence} compact />
              ) : null}
            </div>

            <div className="mt-3 flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.1rem] border border-[color-mix(in_srgb,var(--pmu-primary)_20%,transparent)] bg-[color-mix(in_srgb,var(--pmu-primary)_10%,var(--pmu-surface))] text-lg font-black text-[var(--pmu-text)] shadow-[var(--pmu-shadow-sm)]">
                {numberBadge ?? "Q+"}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[0.98rem] font-black leading-tight text-[var(--pmu-text)]">
                  {selectionTitle}
                </h4>
                <p className="mt-2 text-xs leading-5 text-[var(--pmu-text-soft)]">
                  {selectionCopy}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
                Quinte PMU
              </span>
              {score?.pick?.betType ? (
                <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_30%,transparent)] bg-[var(--pmu-primary-fade)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-primary)]">
                  {formatBetTypeLabelFr(score.pick.betType)}
                </span>
              ) : null}
              {ticketLine ? (
                <span className="rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
                  Ticket {ticketLine}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
              {windowLabel}
            </span>
            <span className="rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
              {isCurrentCourse ? "Course ouverte" : "Acces rapide"}
            </span>
          </div>

          <div className="mt-4 flex gap-2">
            {isCurrentCourse ? (
              <span className="app-button-secondary flex-1 justify-center text-xs opacity-80">
                Course ouverte
              </span>
            ) : (
              <Link href={courseHref} className="app-button-primary flex-1 text-xs">
                Ouvrir la course
              </Link>
            )}
            {score?.scoreLocked ? (
              <Link href="/premium" className="app-button-secondary text-xs">
                Debloquer
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
