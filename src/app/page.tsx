"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AccordionPanel } from "@/components/ui/AccordionPanel";
import { ComparatifIA } from "@/components/ui/ComparatifIA";
import { CourseCard } from "@/components/ui/CourseCard";
import { FilterPills } from "@/components/ui/FilterPills";
import { HowItWorks } from "@/components/ui/HowItWorks";
import { PepiteCard } from "@/components/ui/PepiteCard";
import { PerformanceProof } from "@/components/ui/PerformanceProof";
import { PronoHero } from "@/components/ui/PronoHero";
import { PromoVideoSection } from "@/components/ui/PromoVideoSection";
import { RadarHero } from "@/components/ui/RadarHero";
import { RecentResults } from "@/components/ui/RecentResults";
import { SagesseFoules } from "@/components/ui/SagesseFoules";
import { TopParisStrip, type TopParisItem } from "@/components/ui/TopParisStrip";
import { asArray } from "@/lib/array-utils";
import { translateFactors } from "@/lib/beginner-labels";
import {
  computeClientRaceScore,
  formatBetTypeLabelFr,
  getRaceProfile,
  SEUIL_JOUABLE,
  type ApiRaceScoreLite,
} from "@/lib/client-race-scoring";
import {
  formatDateToPmu,
  getMinutesUntilStart,
  getTodayDateStr,
  parsePmuDate,
  toIsoDate,
} from "@/lib/date-utils";
import { estimateEloProfileForProgrammeCard } from "@/lib/elo-scoring";
import { estimateIndiceOuvertureListe } from "@/lib/ouverture";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";
import type { Lisibilite, PredictionDecision, RaceSummary } from "@/lib/types";

type ScoreStage = "preview_2h" | "preview_1h" | "final_30m" | "finished";
type SortMode = "hour" | "score" | "urgent" | "allocation";
type HomeSecondaryPanel =
  | "performance"
  | "results"
  | "demo"
  | "method"
  | "quinte";

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
  pepiteDuJour?: {
    numPmu?: number | null;
    nom?: string | null;
    confidence?: number | null;
    cote?: number | null;
    topFacteurs?: string[];
  } | null;
};

type RacesResponse = {
  success: boolean;
  date: string;
  races: RaceSummary[];
};

type ScoresResponse = {
  success: boolean;
  scores?:
    | RaceScore[]
    | Record<string, Omit<RaceScore, "dateStr" | "reunion" | "course">>
    | null;
};

type FeaturedRace = {
  race: RaceSummary;
  score?: RaceScore;
  scoreValue: number;
  minutesUntilStart: number;
  confidence: number;
  status: "jouable" | "surveillance" | "passer" | "resultat";
  hint: string;
};

type PriorityCard = {
  key: string;
  title: string;
  subtitle: string;
  value: string;
  description: string;
  tone: "primary" | "warning" | "neutral";
  race?: FeaturedRace | null;
};

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "hour", label: "Par heure" },
  { value: "score", label: "Meilleure note" },
  { value: "urgent", label: "A suivre vite" },
  { value: "allocation", label: "Gros enjeux" },
];

function normalizeScoresPayload(
  raw: ScoresResponse["scores"],
  dateStr: string
): RaceScore[] {
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
      (item): item is RaceScore =>
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
      } satisfies RaceScore,
    ];
  });
}

function coerceRaceSummaries(raw: unknown): RaceSummary[] {
  return Array.isArray(raw)
    ? raw.filter(
        (race): race is RaceSummary =>
          race != null &&
          String((race as RaceSummary).pays ?? "").toUpperCase() === "FRA"
      )
    : [];
}

function normalizeDateParam(value: string | null) {
  return value && /^\d{8}$/.test(value) ? value : getTodayDateStr();
}

function addDays(dateStr: string, diff: number) {
  const date = parsePmuDate(dateStr);
  date.setUTCDate(date.getUTCDate() + diff);
  return formatDateToPmu(date);
}

function formatDisplayDate(dateStr: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parsePmuDate(dateStr));
}

function formatRelativeDay(dateStr: string) {
  const today = getTodayDateStr();

  if (dateStr === today) return "Aujourd'hui";
  if (dateStr === addDays(today, 1)) return "Demain";
  if (dateStr === addDays(today, -1)) return "Hier";

  return formatDisplayDate(dateStr);
}

function formatStake(value?: number | null) {
  if (!value) return "8 EUR";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDiscipline(race: RaceSummary) {
  if (race.estTrot) return "Attele";
  if (race.estPlat) return "Plat";
  return race.discipline || "Discipline";
}

function formatRaceMeta(race: RaceSummary) {
  return [race.heureDepart, `${race.nombrePartants} partants`, `${race.distance} m`]
    .filter(Boolean)
    .join(" - ");
}

function formatCourseMeta(race: RaceSummary) {
  return [formatDiscipline(race), `${race.nombrePartants} partants`, `${race.distance} m`]
    .filter(Boolean)
    .join(" - ");
}

function getStageLabel(stage?: ScoreStage) {
  switch (stage) {
    case "preview_2h":
      return "Fenetre 2 h";
    case "preview_1h":
      return "Signal dans 1 h";
    case "final_30m":
      return "Signal actif";
    case "finished":
      return "Resultat";
    default:
      return "Analyse";
  }
}

function toApiRaceScoreLite(
  score: RaceScore | undefined
): ApiRaceScoreLite | undefined {
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

function getPickLabel(score?: RaceScore) {
  if (!score?.pick?.numPmu && !score?.pick?.nom) {
    return "Ticket principal en preparation";
  }

  const num = score?.pick?.numPmu ? `${score.pick.numPmu}` : "";
  const horse = score?.pick?.nom ?? "Cheval principal";
  return [num, horse].filter(Boolean).join(" - ");
}

function getBetTypeLabel(score?: RaceScore) {
  return formatBetTypeLabelFr(score?.pick?.betType ?? null);
}

function getRaceHint(race: RaceSummary, score?: RaceScore) {
  if (score?.stage === "finished") {
    return "La course est terminee. Ouvre le detail pour revoir le ticket et le resultat final.";
  }

  if (score?.playable && score.decision === "VALIDE") {
    return "Signal valide. La course reste executable avec une lecture propre.";
  }

  if (score?.decision === "SURVEILLANCE") {
    return "Lecture prudente. Le spot est encore jouable mais demande plus de selectivite.";
  }

  if (race.estQuinte) {
    return "Profil Quinte. Regarde surtout la lisibilite et la coherence du ticket principal.";
  }

  return "Base lisible. On garde cette course visible en attendant un ticket plus ferme.";
}

function buildFeaturedRaces(
  races: RaceSummary[],
  scoresMap: Map<string, RaceScore>
) {
  return races.map((race) => {
    const key = `${race.reunion}-${race.course}`;
    const score = scoresMap.get(key);
    const minutesUntilStart = Math.max(
      0,
      Math.round(getMinutesUntilStart(race.heureDepart, race.dateStr))
    );
    const client = computeClientRaceScore(
      race,
      toApiRaceScoreLite(score),
      minutesUntilStart
    );

    return {
      race,
      score,
      scoreValue: client.displayScore,
      minutesUntilStart,
      confidence: client.displayScore,
      status: client.playTier,
      hint: getRaceHint(race, score),
    } satisfies FeaturedRace;
  });
}

function sortFeaturedRaces(items: FeaturedRace[], sortMode: SortMode) {
  return [...items].sort((a, b) => {
    switch (sortMode) {
      case "score":
        return b.scoreValue - a.scoreValue;
      case "urgent":
        return a.minutesUntilStart - b.minutesUntilStart;
      case "allocation":
        return (b.race.allocation ?? 0) - (a.race.allocation ?? 0);
      case "hour":
      default:
        return (a.race.heureDepart || "").localeCompare(b.race.heureDepart || "");
    }
  });
}

function getRadarRace(items: FeaturedRace[]) {
  const list = asArray<FeaturedRace>(items).filter(
    (item) => item.status !== "resultat"
  );

  if (list.length === 0) {
    return asArray<FeaturedRace>(items)[0] ?? null;
  }

  const jouables = list.filter((item) => item.status === "jouable");
  const pool = jouables.length > 0 ? jouables : list;
  return pool.reduce(
    (best, cur) => (cur.scoreValue > best.scoreValue ? cur : best),
    pool[0]!
  );
}

function getTopParisItems(
  items: FeaturedRace[],
  navigate: (race: RaceSummary) => void
): TopParisItem[] {
  return asArray<FeaturedRace>(items)
    .filter((item) => item.status === "jouable" && item.confidence >= SEUIL_JOUABLE)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map((item, index) => ({
      rank: index + 1,
      title: item.race.nomCourse,
      subtitle: `${item.race.hippodrome} - ${item.race.heureDepart}`,
      horse: getPickLabel(item.score),
      stake: formatStake(
        item.score?.pick?.confidence
          ? Math.max(6, Math.round(item.score.pick.confidence * 2.5))
          : 8
      ),
      betType: getBetTypeLabel(item.score),
      confidence: item.confidence,
      sourceLabel: "Jouable",
      onClick: () => navigate(item.race),
    }));
}

function getPriorityCards(items: FeaturedRace[]): PriorityCard[] {
  const list = asArray<FeaturedRace>(items);
  const playable = list.find((item) => item.status === "jouable") ?? null;
  const surveillance = list.find((item) => item.status === "surveillance") ?? null;
  const closingSoon =
    [...list]
      .filter((item) => item.status !== "resultat")
      .sort((a, b) => a.minutesUntilStart - b.minutesUntilStart)
      .find((item) => item.minutesUntilStart <= 45) ??
    list.find((item) => item.status !== "resultat") ??
    null;

  return [
    {
      key: "playable",
      title: "Priorite 1",
      subtitle: playable ? getStageLabel(playable.score?.stage) : "Aucune validation",
      value: playable ? getPickLabel(playable.score) : "A suivre",
      description: playable
        ? playable.hint
        : "Le moteur ne pousse pas encore de ticket vraiment propre pour cette journee.",
      tone: "primary",
      race: playable,
    },
    {
      key: "watch",
      title: "Sous surveillance",
      subtitle: surveillance
        ? `${surveillance.scoreValue.toFixed(1)}/10`
        : "Pas de spot prudent",
      value: surveillance
        ? `R${surveillance.race.reunion}C${surveillance.race.course}`
        : "Rien a surveiller",
      description: surveillance
        ? surveillance.hint
        : "Le board reste calme : pas de profil intermediaire a garder ouvert pour le moment.",
      tone: "warning",
      race: surveillance,
    },
    {
      key: "timing",
      title: "Fenetre courte",
      subtitle: closingSoon
        ? `${closingSoon.minutesUntilStart} min`
        : "Aucun depart proche",
      value: closingSoon
        ? `R${closingSoon.race.reunion}C${closingSoon.race.course}`
        : "Programme calme",
      description: closingSoon
        ? `Le timing peut devenir prioritaire sur ${closingSoon.race.hippodrome}.`
        : "Aucune course ne demande d'ouverture immediate sur les prochaines minutes.",
      tone: "neutral",
      race: closingSoon,
    },
  ];
}

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = normalizeDateParam(searchParams.get("date"));

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [sortMode, setSortMode] = useState<SortMode>("hour");
  const [secondaryPanel, setSecondaryPanel] =
    useState<HomeSecondaryPanel | null>("performance");
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [scores, setScores] = useState<RaceScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchRevision, setFetchRevision] = useState(0);

  useEffect(() => {
    try {
      const storedSort = window.localStorage.getItem("pmu-sort-mode");
      if (
        storedSort === "hour" ||
        storedSort === "score" ||
        storedSort === "urgent" ||
        storedSort === "allocation"
      ) {
        setSortMode(storedSort);
      }
    } catch (effectError) {
      console.error(effectError);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("pmu-sort-mode", sortMode);
    } catch (effectError) {
      console.error(effectError);
    }
  }, [sortMode]);

  useEffect(() => {
    try {
      setSelectedDate(initialDate);
    } catch (effectError) {
      console.error(effectError);
    }
  }, [initialDate]);

  useEffect(() => {
    try {
      const currentParam = normalizeDateParam(searchParams.get("date"));
      if (currentParam === selectedDate) {
        return;
      }

      const nextPath =
        selectedDate === getTodayDateStr() ? "/" : `/?date=${selectedDate}`;
      router.replace(nextPath, { scroll: false });
    } catch (effectError) {
      console.error(effectError);
    }
  }, [router, searchParams, selectedDate]);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        let authorization = "";
        if (hasSupabaseConfig()) {
          try {
            const supabase = getSupabaseBrowserClient();
            const {
              data: { session },
            } = await supabase.auth.getSession();
            authorization = session?.access_token
              ? `Bearer ${session.access_token}`
              : "";
          } catch (sessionError) {
            console.error(sessionError);
            authorization = "";
          }
        }

        const racesUrl = `/api/races?date=${selectedDate}`;
        const scoresUrl = `/api/races/scores?date=${selectedDate}`;
        const [racesResponse, scoresResponse] = await Promise.all([
          fetch(racesUrl, { cache: "no-store", signal: ac.signal }),
          fetch(scoresUrl, {
            cache: "no-store",
            signal: ac.signal,
            headers: authorization
              ? { Authorization: authorization }
              : undefined,
          }),
        ]);

        if (!racesResponse.ok) {
          throw new Error("Impossible de charger le programme du jour.");
        }

        const racesJson = (await racesResponse.json()) as RacesResponse;
        if (!racesJson.success) {
          throw new Error("Le service courses a renvoye une reponse invalide.");
        }

        let scoresJson: ScoresResponse = { success: true, scores: [] };
        if (scoresResponse.ok) {
          scoresJson = (await scoresResponse.json()) as ScoresResponse;
        }

        if (!cancelled) {
          setRaces(coerceRaceSummaries(racesJson.races));
          setScores(
            scoresJson.success
              ? normalizeScoresPayload(scoresJson.scores, selectedDate)
              : []
          );
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger la page Courses."
        );
        setRaces([]);
        setScores([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [selectedDate, fetchRevision]);

  const featuredRaces = useMemo(() => {
    const map = new Map(
      normalizeScoresPayload(scores, selectedDate).map((score) => [
        `${score.reunion}-${score.course}`,
        score,
      ])
    );
    const rows = sortFeaturedRaces(
      buildFeaturedRaces(coerceRaceSummaries(races), map),
      sortMode
    );

    return asArray<FeaturedRace>(rows);
  }, [races, scores, selectedDate, sortMode]);

  const navigateToRace = useCallback(
    (race: RaceSummary) => {
      router.push(`/course/${race.reunion}/${race.course}?date=${selectedDate}`);
    },
    [router, selectedDate]
  );

  const radarRace = useMemo(() => getRadarRace(featuredRaces), [featuredRaces]);

  const radarProfile = useMemo(
    () =>
      radarRace
        ? getRaceProfile({
            race: radarRace.race,
            displayScore: radarRace.scoreValue,
            pick: radarRace.score?.pick
              ? {
                  numPmu: radarRace.score.pick.numPmu,
                  cote: null,
                  confidence: radarRace.score.pick.confidence,
                }
              : null,
          })
        : null,
    [radarRace]
  );

  const topParisItems = useMemo(
    () => getTopParisItems(featuredRaces, navigateToRace),
    [featuredRaces, navigateToRace]
  );

  const quinteDuJour = useMemo(
    () => featuredRaces.find((item) => item.race.estQuinte) ?? null,
    [featuredRaces]
  );

  const summaryStats = useMemo(() => {
    const meetings = new Set(races.map((race) => race.reunion)).size;
    const playable = featuredRaces.filter(
      (item) => item.status === "jouable"
    ).length;
    const hot = featuredRaces.filter(
      (item) => item.confidence >= SEUIL_JOUABLE
    ).length;
    const closingSoon = featuredRaces.filter(
      (item) => item.status !== "resultat" && item.minutesUntilStart <= 60
    ).length;

    return { meetings, playable, hot, closingSoon };
  }, [featuredRaces, races]);

  const priorityCards = useMemo(
    () => getPriorityCards(featuredRaces),
    [featuredRaces]
  );

  const secondaryPanels = useMemo(() => {
    const base: Array<{ key: HomeSecondaryPanel; label: string }> = [
      { key: "performance", label: "Performance" },
      { key: "results", label: "Resultats" },
      { key: "demo", label: "Demo produit" },
      { key: "method", label: "Methode" },
    ];

    if (quinteDuJour) {
      base.push({ key: "quinte", label: "Quinte du jour" });
    }

    return base;
  }, [quinteDuJour]);

  useEffect(() => {
    if (secondaryPanel === "quinte" && !quinteDuJour) {
      setSecondaryPanel("performance");
    }
  }, [quinteDuJour, secondaryPanel]);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
      <section className="app-page-hero p-6 md:p-8">
        <div className="relative z-[1] grid gap-6 xl:grid-cols-[1.15fr,0.85fr] xl:items-end">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="app-kicker">Board du jour</p>
              <h1 className="max-w-4xl text-4xl font-black leading-[0.92] text-[var(--pmu-text)] md:text-6xl">
                Une home qui pousse les bonnes courses en premier.
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
                La page d&apos;accueil devient un vrai poste de pilotage : on
                trie, on ouvre, on surveille et on garde la meilleure decision
                visible sans fouiller partout.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push("/premium")}
                className="app-button-primary"
              >
                Voir l&apos;offre premium
              </button>
              <button
                type="button"
                onClick={() => router.push("/resultats")}
                className="app-button-secondary"
              >
                Ouvrir les resultats
              </button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--pmu-text-soft)]">
              {[
                `Date ${formatRelativeDay(selectedDate)}`,
                `${races.length} courses`,
                `${summaryStats.playable} jouables`,
                `Tri ${SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? "Par heure"}`,
              ].map((label) => (
                <span key={label} className="app-pill text-xs">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="app-stat-card px-5 py-4">
              <p className="app-label">Date active</p>
              <p className="mt-2 text-xl font-black capitalize text-[var(--pmu-text)]">
                {formatRelativeDay(selectedDate)}
              </p>
            </div>
            <div className="app-stat-card px-5 py-4">
              <p className="app-label">Reunions</p>
              <p className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
                {summaryStats.meetings}
              </p>
            </div>
            <div className="app-stat-card px-5 py-4">
              <p className="app-label">Jouables</p>
              <p className="mt-2 text-3xl font-black text-[var(--pmu-primary)]">
                {summaryStats.playable}
              </p>
            </div>
            <div className="app-stat-card px-5 py-4">
              <p className="app-label">Departs proches</p>
              <p className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
                {summaryStats.closingSoon}
              </p>
            </div>
          </div>
        </div>
      </section>

      {radarRace ? (
        <section className="grid gap-5 xl:grid-cols-[1.18fr,0.82fr]">
          <div className="space-y-5">
            {radarRace.score?.pick?.numPmu && radarRace.score?.pick?.nom ? (
              <PronoHero
                horseName={radarRace.score.pick.nom}
                horseNum={radarRace.score.pick.numPmu}
                confidence={radarRace.confidence}
                hippodrome={radarRace.race.hippodrome}
                heureDepart={radarRace.race.heureDepart}
                courseName={radarRace.race.nomCourse}
                reunion={radarRace.race.reunion}
                course={radarRace.race.course}
                betType={radarRace.score.pick.betType}
                cote={null}
                topFacteurs={translateFactors(
                  radarRace.score.pick.topFacteurs ?? []
                )}
                lisibilite={radarRace.score.lisibilite}
                onClick={() => navigateToRace(radarRace.race)}
              />
            ) : radarProfile ? (
              <RadarHero
                raceTitle={`R${radarRace.race.reunion}C${radarRace.race.course} - ${radarRace.race.nomCourse}`}
                hippodrome={radarRace.race.hippodrome}
                raceMeta={formatRaceMeta(radarRace.race)}
                displayScore={radarRace.scoreValue}
                profile={radarProfile}
                heureDepart={radarRace.race.heureDepart}
                dateStr={radarRace.race.dateStr}
                onClick={() => navigateToRace(radarRace.race)}
              />
            ) : null}
          </div>

          <div className="grid gap-5">
            {radarProfile ? (
              <RadarHero
                raceTitle={`R${radarRace.race.reunion}C${radarRace.race.course} - ${radarRace.race.nomCourse}`}
                hippodrome={radarRace.race.hippodrome}
                raceMeta={formatRaceMeta(radarRace.race)}
                displayScore={radarRace.scoreValue}
                profile={radarProfile}
                heureDepart={radarRace.race.heureDepart}
                dateStr={radarRace.race.dateStr}
                onClick={() => navigateToRace(radarRace.race)}
              />
            ) : null}

            {radarRace.score?.pepiteDuJour?.numPmu &&
            radarRace.score?.pepiteDuJour?.nom ? (
              <PepiteCard
                horseName={radarRace.score.pepiteDuJour.nom}
                horseNum={radarRace.score.pepiteDuJour.numPmu}
                confidence={radarRace.score.pepiteDuJour.confidence ?? 0}
                cote={radarRace.score.pepiteDuJour.cote ?? null}
                hippodrome={radarRace.race.hippodrome}
                heureDepart={radarRace.race.heureDepart}
                reunion={radarRace.race.reunion}
                course={radarRace.race.course}
                topFacteurs={translateFactors(
                  radarRace.score.pepiteDuJour.topFacteurs ?? []
                )}
                onClick={() => navigateToRace(radarRace.race)}
              />
            ) : (
              <section className="app-card p-5 md:p-6">
                <p className="app-kicker">Pepite</p>
                <h2 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                  Pas de profil speculatif propre pour l&apos;instant
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
                  Le board ne force pas une pepite sur chaque reunion. Quand
                  elle existe, elle remonte ici avec son contexte et son niveau
                  de risque.
                </p>
              </section>
            )}
          </div>
        </section>
      ) : null}

      {topParisItems.length > 0 ? <TopParisStrip items={topParisItems} /> : null}

      <section className="app-card p-6 md:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr] xl:items-end">
          <div className="space-y-4">
            <div>
              <p className="app-kicker">Pilotage du jour</p>
              <h2 className="mt-2 text-3xl font-black capitalize tracking-tight text-[var(--pmu-text)]">
                {formatDisplayDate(selectedDate)}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)]">
                Change de journee, trie le programme et garde en haut de page
                uniquement les spots qui meritent vraiment d&apos;etre ouverts.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                className="app-button-secondary"
              >
                Jour precedent
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(getTodayDateStr())}
                className="app-button-secondary"
              >
                Aujourd&apos;hui
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="app-button-secondary"
              >
                Jour suivant
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Programme</p>
              <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                {races.length}
              </p>
            </div>
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Hot list</p>
              <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                {summaryStats.hot}
              </p>
            </div>
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Tri actif</p>
              <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
                {SORT_OPTIONS.find((option) => option.value === sortMode)?.label ??
                  "Par heure"}
              </p>
            </div>
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Focus</p>
              <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
                {topParisItems.length > 0
                  ? "Top 3 jouables"
                  : "Programme complet"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,14rem),1fr] lg:items-center">
          <label className="block">
            <span className="sr-only">Choisir une date</span>
            <input
              type="date"
              className="app-input"
              value={toIsoDate(selectedDate)}
              onChange={(event) =>
                setSelectedDate(
                  normalizeDateParam(event.target.value.replaceAll("-", ""))
                )
              }
            />
          </label>

          <div className="border-t border-[var(--pmu-border)] pt-4 lg:border-t-0 lg:pt-0">
            <FilterPills
              options={SORT_OPTIONS}
              value={sortMode}
              onChange={setSortMode}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {priorityCards.map((card) => {
          const toneColor =
            card.tone === "primary"
              ? "var(--pmu-primary)"
              : card.tone === "warning"
                ? "var(--pmu-orange)"
                : "var(--pmu-text)";

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => (card.race ? navigateToRace(card.race.race) : undefined)}
              disabled={!card.race}
              className="app-card flex h-full flex-col items-start gap-4 p-5 text-left disabled:cursor-default disabled:opacity-100"
            >
              <div className="flex w-full items-start justify-between gap-3">
                <div>
                  <p className="app-kicker">{card.title}</p>
                  <h3 className="mt-2 text-xl font-black text-[var(--pmu-text)]">
                    {card.value}
                  </h3>
                </div>
                <span
                  className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                  style={{
                    color: toneColor,
                    borderColor: `color-mix(in srgb, ${toneColor} 24%, transparent)`,
                    background: `color-mix(in srgb, ${toneColor} 10%, var(--pmu-surface))`,
                  }}
                >
                  {card.subtitle}
                </span>
              </div>

              <p className="text-sm leading-6 text-[var(--pmu-text-soft)]">
                {card.description}
              </p>

              {card.race ? (
                <div className="mt-auto flex flex-wrap gap-2">
                  <span className="app-pill text-xs">
                    {card.race.race.hippodrome}
                  </span>
                  <span className="app-pill text-xs">
                    {card.race.race.heureDepart}
                  </span>
                  <span className="app-pill text-xs">
                    {card.race.scoreValue.toFixed(1)}/10
                  </span>
                </div>
              ) : null}
            </button>
          );
        })}
      </section>

      {error ? (
        <section
          className="app-card border border-[color-mix(in_srgb,var(--pmu-red)_35%,transparent)] p-6"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-lg font-bold text-[var(--pmu-red)]">
            Impossible de charger la page Courses
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
            {error}
          </p>
          <button
            type="button"
            className="app-button-primary mt-4"
            onClick={() => setFetchRevision((revision) => revision + 1)}
          >
            Reessayer
          </button>
        </section>
      ) : null}

      {!isLoading && !error && featuredRaces.length > 0 && topParisItems.length === 0 ? (
        <section className="app-card p-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
          Aucune course ne depasse encore le seuil jouable ({SEUIL_JOUABLE}
          /10) pour le Top 3. Le board garde tout de meme les meilleurs spots
          visibles dans la grille ci-dessous.
        </section>
      ) : null}

      <section className="app-section-heading rounded-[1.8rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_78%,transparent)] px-5 py-5 md:px-6">
        <div>
          <p className="app-kicker">Board courses</p>
          <h2 className="app-section-title">Le programme trie pour agir vite</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[var(--pmu-text-soft)]">
          Chaque carte condense le score, le ticket et la lecture. Le but est
          simple : ouvrir la bonne course sans perdre le fil du programme.
        </p>
      </section>

      {isLoading ? (
        <section
          className="grid auto-rows-fr gap-5 2xl:grid-cols-2"
          aria-busy="true"
          aria-label="Chargement des courses"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="app-card h-80 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]"
            />
          ))}
        </section>
      ) : null}

      {!isLoading && !error && featuredRaces.length > 0 ? (
        <section className="grid auto-rows-fr items-stretch gap-5 2xl:grid-cols-2">
          {featuredRaces.map((item) => {
            const profile = getRaceProfile({
              race: item.race,
              displayScore: item.scoreValue,
              pick: item.score?.pick
                ? {
                    numPmu: item.score.pick.numPmu,
                    cote: null,
                    confidence: item.score.pick.confidence,
                  }
                : null,
            });
            const eloProfile = estimateEloProfileForProgrammeCard(
              item.score?.pick?.confidence
            );
            const indiceListe = estimateIndiceOuvertureListe({
              displayScore: item.scoreValue,
              partants: item.race.nombrePartants,
              sigmaPct: eloProfile.sigma,
            });

            return (
              <CourseCard
                key={`${item.race.reunion}-${item.race.course}`}
                raceTitle={`R${item.race.reunion}C${item.race.course} - ${item.race.nomCourse}`}
                subtitleLine={[
                  item.race.hippodrome,
                  formatCourseMeta(item.race),
                ].join(" - ")}
                timeLabel={item.race.heureDepart}
                minutesUntilStart={item.minutesUntilStart}
                displayScore={item.scoreValue}
                profile={profile}
                eloProfile={eloProfile}
                indiceOuverture={indiceListe}
                pickNum={item.score?.pick?.numPmu}
                pickNom={item.score?.pick?.nom}
                pickConfidence={item.score?.pick?.confidence}
                pickBetType={item.score?.pick?.betType}
                topFacteurs={item.score?.pick?.topFacteurs}
                onClick={() => navigateToRace(item.race)}
              />
            );
          })}
        </section>
      ) : null}

      {!isLoading && !error && featuredRaces.length === 0 ? (
        <section className="app-card p-8 text-center">
          <p className="text-xl font-bold text-[var(--pmu-text)]">
            Aucune course exploitable pour cette date
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
            Change de journee ou recharge la page. Le moteur n&apos;a pas encore
            remonte de programme utilisable.
          </p>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="app-section-heading">
          <div>
            <p className="app-kicker">Preuves et methode</p>
            <h2 className="app-section-title">
              Le panneau secondaire garde le reste proprement range
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[var(--pmu-text-soft)]">
            La decision vit plus haut. Ici, on ouvre seulement les preuves, la
            demo ou le bloc Quinte quand on en a besoin.
          </p>
        </div>

        <div className="space-y-3">
          {secondaryPanels.map((panel) => {
            const open = secondaryPanel === panel.key;
            const summary =
              panel.key === "performance"
                ? "ROI et hit rate"
                : panel.key === "results"
                  ? "Suivi recent"
                  : panel.key === "demo"
                    ? "Video produit"
                    : panel.key === "method"
                      ? "Processus"
                      : "Consensus";

            return (
              <AccordionPanel
                key={panel.key}
                kicker="Bloc deroulant"
                title={panel.label}
                summary={summary}
                open={open}
                onToggle={(next) => setSecondaryPanel(next ? panel.key : null)}
                bodyClassName="pt-4"
              >
                {panel.key === "performance" ? <PerformanceProof /> : null}
                {panel.key === "results" ? <RecentResults /> : null}
                {panel.key === "demo" ? <PromoVideoSection /> : null}
                {panel.key === "method" ? (
                  <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
                    <HowItWorks />
                    <PerformanceProof />
                  </div>
                ) : null}
                {panel.key === "quinte" && quinteDuJour ? (
                  <div className="grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
                    <section className="grid gap-4">
                      <SagesseFoules
                        raceId={`${selectedDate}-R${quinteDuJour.race.reunion}C${quinteDuJour.race.course}`}
                        raceLabel={`${quinteDuJour.race.nomCourse} (R${quinteDuJour.race.reunion}C${quinteDuJour.race.course})`}
                      />
                      <RecentResults />
                    </section>
                    <section className="grid gap-4">
                      <ComparatifIA
                        dateStr={selectedDate}
                        reunion={quinteDuJour.race.reunion}
                        course={quinteDuJour.race.course}
                        nomCourse={quinteDuJour.race.nomCourse}
                      />
                      <PromoVideoSection />
                    </section>
                  </div>
                ) : null}
              </AccordionPanel>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function HomePageSkeletonFallback() {
  return (
    <div
      className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8"
      aria-busy="true"
      aria-label="Chargement du programme"
    >
      <div className="app-page-hero h-64 animate-pulse" />
      <div className="grid gap-5 xl:grid-cols-[1.18fr,0.82fr]">
        <div className="app-card h-[24rem] animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
        <div className="grid gap-5">
          <div className="app-card h-[15rem] animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
          <div className="app-card h-[15rem] animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="app-card h-56 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]"
          />
        ))}
      </div>
      <div className="grid gap-5 2xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="app-card h-80 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]"
          />
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<HomePageSkeletonFallback />}>
      <PageContent />
    </Suspense>
  );
}
