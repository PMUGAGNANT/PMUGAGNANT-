"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

function QuinteSkeleton() {
  return (
    <section className="rounded-[1.55rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] p-3.5">
      <div className="space-y-3 animate-pulse">
        <div className="h-3 w-28 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_16%,transparent)]" />
        <div className="h-12 rounded-[1rem] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)]" />
        <div className="h-24 rounded-[1.2rem] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)]" />
      </div>
    </section>
  );
}

export function SidebarQuinteCard() {
  const router = useRouter();
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
      <section className="rounded-[1.55rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] p-3.5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--pmu-text-muted)]">
          Quinte du jour
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
          Pas de course Quinte detectee pour cette journee.
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="rounded-[1.55rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] p-3.5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--pmu-text-muted)]">
          Quinte du jour
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
          {state.message}
        </p>
      </section>
    );
  }

  const { race, score } = state;
  const statusBadge = getStatusBadge(minutesUntilStart ?? 999);
  const lisibilite = getLisibiliteLabel(score?.lisibilite);
  const scoreValue = scoreSummary ? scoreSummary.displayScore.toFixed(1) : "--";
  const selectionTitle =
    score?.pick?.numPmu || score?.pick?.nom
      ? `N${score?.pick?.numPmu ?? "--"} ${score?.pick?.nom ?? "Selection"}`
      : score?.scoreLocked
        ? "Lecture complete reservee au premium"
        : (minutesUntilStart ?? 999) > 120
          ? "Pronostic detaille a l'approche de la course"
          : "Analyse en consolidation";
  const selectionCopy =
    score?.pick?.topFacteurs?.slice(0, 2).join(" - ") ||
    score?.recommendation ||
    (score?.scoreLocked
      ? "Le bloc Quinte du jour est repere, mais le ticket detaille reste reserve aux comptes premium."
      : "Le bloc se complete quand la course entre dans la fenetre d'analyse.");

  return (
    <section className="rounded-[1.55rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--pmu-text-muted)]">
          Quinte du jour
        </p>
        <span
          className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] ${statusBadge.className}`}
        >
          {statusBadge.label}
        </span>
      </div>

      <div className="rounded-[1.25rem] border border-[color-mix(in_srgb,var(--pmu-primary)_18%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--pmu-surface-highlight)_56%,var(--pmu-surface))_0%,color-mix(in_srgb,var(--pmu-surface-2)_78%,var(--pmu-surface))_100%)] p-4 shadow-[var(--pmu-shadow-sm)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--pmu-primary)]">
              R{race.reunion}C{race.course}
            </p>
            <h3 className="mt-2 line-clamp-2 text-lg font-black leading-tight text-[var(--pmu-text)]">
              {race.nomCourse}
            </h3>
            <p className="mt-2 text-xs leading-5 text-[var(--pmu-text-soft)]">
              {race.hippodrome} - {race.heureDepart} - {race.nombrePartants} partants
            </p>
          </div>

          <div className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_86%,transparent)] px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">
              Radar
            </p>
            <p className="mt-1 text-2xl font-black tracking-[-0.05em] text-[var(--pmu-text)]">
              {scoreValue}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] ${lisibilite.className}`}
          >
            {lisibilite.label}
          </span>
          {raceProfile ? (
            <span className="rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_86%,transparent)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
              {raceProfile.label}
            </span>
          ) : null}
          <span className="rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_86%,transparent)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
            Quinte PMU
          </span>
        </div>

        <div className="mt-4 rounded-[1.15rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
            Lecture du moteur
          </p>
          <h4 className="mt-2 text-base font-black leading-tight text-[var(--pmu-text)]">
            {selectionTitle}
          </h4>
          <p className="mt-2 text-xs leading-5 text-[var(--pmu-text-soft)]">
            {selectionCopy}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {score?.pick?.betType ? (
              <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_30%,transparent)] bg-[var(--pmu-primary-fade)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-primary)]">
                {formatBetTypeLabelFr(score.pick.betType)}
              </span>
            ) : null}
            {score?.pick?.confidence ? (
              <ConfidenceBadge score={score.pick.confidence} compact />
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() =>
              router.push(`/course/${race.reunion}/${race.course}?date=${selectedDate}`)
            }
            className="app-button-primary flex-1 text-xs"
          >
            Ouvrir la course
          </button>
          {score?.scoreLocked ? (
            <Link href="/premium" className="app-button-secondary text-xs">
              Premium
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
