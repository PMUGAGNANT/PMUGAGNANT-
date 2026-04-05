"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ComparatifIA } from "@/components/ui/ComparatifIA";
import { CourseCard } from "@/components/ui/CourseCard";
import { DirectCourseJump } from "@/components/ui/DirectCourseJump";
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
import {
  formatDateToPmu,
  getMinutesUntilStart,
  getTodayDateStr,
  parsePmuDate,
  toIsoDate,
} from "@/lib/date-utils";
import { asArray } from "@/lib/array-utils";
import { translateFactors } from "@/lib/beginner-labels";
import {
  computeClientRaceScore,
  formatBetTypeLabelFr,
  getRaceProfile,
  SEUIL_JOUABLE,
  type ApiRaceScoreLite,
} from "@/lib/client-race-scoring";
import { estimateEloProfileForProgrammeCard } from "@/lib/elo-scoring";
import { estimateIndiceOuvertureListe } from "@/lib/ouverture";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";
import type { Lisibilite, PredictionDecision, RaceSummary } from "@/lib/types";

type ScoreStage = "preview_2h" | "preview_1h" | "final_30m" | "finished";
type SortMode = "hour" | "score" | "urgent" | "allocation";
type HomeSecondaryPanel = "performance" | "results" | "demo" | "method" | "quinte";

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
  scores?: RaceScore[] | Record<string, Omit<RaceScore, "dateStr" | "reunion" | "course">> | null;
};

function normalizeScoresPayload(
  raw: ScoresResponse["scores"],
  dateStr: string
): RaceScore[] {
  if (raw == null || typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
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

  if (typeof raw === "object") {
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

  return [];
}

function coerceRaceSummaries(raw: unknown): RaceSummary[] {
  return Array.isArray(raw) ? raw : [];
}

type FeaturedRace = {
  race: RaceSummary;
  score?: RaceScore;
  scoreValue: number;
  minutesUntilStart: number;
  noteLabel: string;
  confidence: number;
  status: "jouable" | "surveillance" | "passer" | "resultat";
  /** Texte carte programme */
  reason: string;
  /** Phrase radar (confiance / contexte) */
  radarSentence: string;
  radarRatio: number;
};

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "hour", label: "Par heure" },
  { value: "score", label: "Meilleure note" },
  { value: "urgent", label: "À suivre vite" },
  { value: "allocation", label: "Gros enjeux" },
];

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

  if (dateStr === today) {
    return "Aujourd’hui";
  }

  if (dateStr === addDays(today, 1)) {
    return "Demain";
  }

  if (dateStr === addDays(today, -1)) {
    return "Hier";
  }

  return formatDisplayDate(dateStr);
}

function formatStake(value?: number | null) {
  if (!value) {
    return "8 €";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDiscipline(race: RaceSummary) {
  if (race.estTrot) {
    return "Attelé";
  }

  if (race.estPlat) {
    return "Plat";
  }

  return race.discipline || "Discipline";
}

function formatRaceMeta(race: RaceSummary) {
  return [race.heureDepart, `${race.nombrePartants} partants`, `${race.distance} m`]
    .filter(Boolean)
    .join(" • ");
}

function formatCourseMeta(race: RaceSummary) {
  return [formatDiscipline(race), `${race.nombrePartants} partants`, `${race.distance} m`]
    .filter(Boolean)
    .join(" • ");
}

function getStageLabel(stage?: ScoreStage) {
  switch (stage) {
    case "preview_2h":
      return "Fenêtre 2 h";
    case "preview_1h":
      return "Signal dans 1h";
    case "final_30m":
      return "🔴 Signal actif";
    case "finished":
      return "🏁 Résultat";
    default:
      return "Analyse";
  }
}

function toApiRaceScoreLite(score: RaceScore | undefined): ApiRaceScoreLite | undefined {
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
    return "Ticket principal en préparation";
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
    return "La course est bouclée. Ouvre le détail pour revoir le ticket et le résultat final.";
  }

  if (score?.playable && score.decision === "VALIDE") {
    return "Signal validé. La lecture est assez propre pour être exécutée avec discipline.";
  }

  if (score?.decision === "SURVEILLANCE") {
    return "Lecture prudente. Le profil reste jouable mais demande plus de sélectivité.";
  }

  if (race.estQuinte) {
    return "Profil Quinté. Regarde surtout la lisibilité et la cohérence du ticket principal.";
  }

  return "Base lisible. On garde la course au radar en attendant un ticket plus ferme.";
}

function buildFeaturedRaces(races: unknown, scoresMap: Map<string, RaceScore>) {
  const list = Array.isArray(races) ? races : [];
  return list.map((race) => {
    const key = `${race.reunion}-${race.course}`;
    const score = scoresMap.get(key);
    const minutesUntilStart = Math.max(0, Math.round(getMinutesUntilStart(race.heureDepart, race.dateStr)));
    const client = computeClientRaceScore(race, toApiRaceScoreLite(score), minutesUntilStart);

    return {
      race,
      score,
      scoreValue: client.displayScore,
      minutesUntilStart,
      noteLabel: getStageLabel(score?.stage),
      confidence: client.displayScore,
      status: client.playTier,
      reason: getRaceHint(race, score),
      radarSentence: client.radarSentence,
      radarRatio: client.radarRatio,
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
  const list = asArray<FeaturedRace>(items).filter((item) => item.status !== "resultat");
  if (list.length === 0) {
    return asArray<FeaturedRace>(items)[0] ?? null;
  }
  const jouables = list.filter((item) => item.status === "jouable");
  const pool = jouables.length > 0 ? jouables : list;
  return pool.reduce((best, cur) => (cur.radarRatio > best.radarRatio ? cur : best), pool[0]!);
}

function getTopParisItems(items: FeaturedRace[], navigate: (race: RaceSummary) => void): TopParisItem[] {
  return asArray<FeaturedRace>(items)
    .filter((item) => item.status === "jouable" && item.confidence >= SEUIL_JOUABLE)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map((item, index) => ({
      rank: index + 1,
      title: item.race.nomCourse,
      subtitle: `${item.race.hippodrome} • ${item.race.heureDepart}`,
      horse: getPickLabel(item.score),
      stake: formatStake(item.score?.pick?.confidence ? Math.max(6, Math.round(item.score.pick.confidence * 2.5)) : 8),
      betType: getBetTypeLabel(item.score),
      confidence: item.confidence,
      sourceLabel: "Jouable",
      onClick: () => navigate(item.race),
    }));
}

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = normalizeDateParam(searchParams.get("date"));

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [sortMode, setSortMode] = useState<SortMode>("hour");
  const [secondaryPanel, setSecondaryPanel] = useState<HomeSecondaryPanel>("performance");
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [scores, setScores] = useState<RaceScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** NIVEAU 5 — incrément pour forcer un re-fetch sans changer la date (retry UX) */
  const [fetchRevision, setFetchRevision] = useState(0);

  useEffect(() => {
    try {
      const storedSort = window.localStorage.getItem("pmu-sort-mode");
      if (storedSort === "hour" || storedSort === "score" || storedSort === "urgent" || storedSort === "allocation") {
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

      const nextPath = selectedDate === getTodayDateStr() ? "/" : `/?date=${selectedDate}`;
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
            authorization = session?.access_token ? `Bearer ${session.access_token}` : "";
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
            headers: authorization ? { Authorization: authorization } : undefined,
          }),
        ]);

        if (!racesResponse.ok) {
          throw new Error("Impossible de charger le programme du jour.");
        }

        const racesJson = (await racesResponse.json()) as RacesResponse;
        if (!racesJson.success) {
          throw new Error("Le service courses a renvoyé une réponse invalide.");
        }

        let scoresJson: ScoresResponse = { success: true, scores: [] };
        if (scoresResponse.ok) {
          scoresJson = (await scoresResponse.json()) as ScoresResponse;
        }

        if (!cancelled) {
          setRaces(coerceRaceSummaries(racesJson.races));
          setScores(
            scoresJson.success ? normalizeScoresPayload(scoresJson.scores, selectedDate) : []
          );
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Impossible de charger la page Courses.");
          setRaces([]);
          setScores([]);
        }
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
    const safeScores = normalizeScoresPayload(
      scores as unknown as ScoresResponse["scores"],
      selectedDate
    );
    const map = new Map(safeScores.map((score) => [`${score.reunion}-${score.course}`, score]));
    const safeRaces = coerceRaceSummaries(races);
    const rows = sortFeaturedRaces(buildFeaturedRaces(safeRaces, map), sortMode);
    return asArray<FeaturedRace>(rows);
  }, [races, scores, sortMode, selectedDate]);

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
  const topParisItems = useMemo(() => getTopParisItems(featuredRaces, navigateToRace), [featuredRaces, navigateToRace]);

  const quinteDuJour = useMemo(() => {
    const list = asArray<FeaturedRace>(featuredRaces);
    return list.find((f) => f.race.estQuinte) ?? null;
  }, [featuredRaces]);

  const summaryStats = useMemo(() => {
    const raceList = coerceRaceSummaries(races);
    const meetings = new Set(raceList.map((race) => race.reunion)).size;
    const fr = asArray<FeaturedRace>(featuredRaces);
    const playable = fr.filter((item) => item.status === "jouable").length;
    const hot = fr.filter((item) => item.confidence >= SEUIL_JOUABLE).length;
    const closingSoon = fr.filter((item) => item.status !== "resultat" && item.minutesUntilStart <= 60).length;

    return { meetings, playable, hot, closingSoon };
  }, [featuredRaces, races]);

  const secondaryPanels = useMemo(() => {
    const base: Array<{ key: HomeSecondaryPanel; label: string }> = [
      { key: "performance", label: "Performance" },
      { key: "results", label: "Résultats" },
      { key: "demo", label: "Démo vidéo" },
      { key: "method", label: "Méthode" },
    ];

    if (quinteDuJour) {
      base.push({ key: "quinte", label: "Quinté" });
    }

    return base;
  }, [quinteDuJour]);

  useEffect(() => {
    if (secondaryPanel === "quinte" && !quinteDuJour) {
      setSecondaryPanel("performance");
    }
  }, [quinteDuJour, secondaryPanel]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="app-card overflow-hidden p-5 md:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.15fr,0.85fr] xl:items-end">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="app-kicker">Tableau de bord du jour</p>
              <h1 className="max-w-4xl text-2xl font-black leading-tight tracking-tight text-[var(--pmu-text)] md:text-4xl">
                Cheval du jour, top jouables et programme trié au même endroit.
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[var(--pmu-text-soft)] md:text-base">
                L’accueil sert d’écran de décision. Le reste vit plus bas dans un panneau secondaire, mieux rangé.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => router.push("/resultats")} className="app-button-secondary">
                Voir les résultats
              </button>
              <button type="button" onClick={() => router.push("/premium")} className="app-button-primary">
                Voir l’offre premium
              </button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--pmu-text-soft)]">
              {["Cheval du jour", "Top 3 jouables", "Accès direct R/C", "Programme trié"].map((label) => (
                <span key={label} className="app-pill text-xs">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="app-card-muted px-4 py-3">
              <p className="app-label">Date active</p>
              <p className="mt-2 text-lg font-black capitalize text-[var(--pmu-text)]">{formatRelativeDay(selectedDate)}</p>
            </div>
            <div className="app-card-muted px-4 py-3">
              <p className="app-label">Programme</p>
              <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">{races.length}</p>
            </div>
            <div className="app-card-muted px-4 py-3">
              <p className="app-label">Jouables</p>
              <p className="mt-2 text-2xl font-black text-[var(--pmu-primary)]">{summaryStats.playable}</p>
            </div>
          </div>
        </div>
      </section>

      {radarRace && radarRace.score?.pick?.numPmu && radarRace.score?.pick?.nom ? (
        <>
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
            topFacteurs={translateFactors(radarRace.score.pick.topFacteurs ?? [])}
            lisibilite={radarRace.score?.lisibilite}
            onClick={() => navigateToRace(radarRace.race)}
          />
          {radarRace.score?.pepiteDuJour?.numPmu && radarRace.score?.pepiteDuJour?.nom ? (
            <PepiteCard
              horseName={radarRace.score.pepiteDuJour.nom}
              horseNum={radarRace.score.pepiteDuJour.numPmu}
              confidence={radarRace.score.pepiteDuJour.confidence ?? 0}
              cote={radarRace.score.pepiteDuJour.cote ?? null}
              hippodrome={radarRace.race.hippodrome}
              heureDepart={radarRace.race.heureDepart}
              reunion={radarRace.race.reunion}
              course={radarRace.race.course}
              topFacteurs={translateFactors(radarRace.score.pepiteDuJour.topFacteurs ?? [])}
              onClick={() => navigateToRace(radarRace.race)}
            />
          ) : null}
        </>
      ) : radarRace && radarProfile ? (
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

      {topParisItems.length ? <TopParisStrip items={topParisItems} /> : null}

      <section className="app-card p-5 md:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="app-kicker">Pilotage du jour</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)] md:text-3xl">{formatDisplayDate(selectedDate)}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pmu-text-soft)]">
                  Change de journée, trie le programme et ouvre une course sans scroller dans toute la liste.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 xl:max-w-[18rem] xl:justify-end">
                <button type="button" onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="app-button-secondary">
                  Jour précédent
                </button>
                <button type="button" onClick={() => setSelectedDate(getTodayDateStr())} className="app-button-secondary">
                  Aujourd’hui
                </button>
                <button type="button" onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="app-button-secondary">
                  Jour suivant
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),auto,auto,auto] lg:items-center">
              <label className="block">
                <span className="sr-only">Choisir une date</span>
                <input
                  type="date"
                  className="app-input"
                  value={toIsoDate(selectedDate)}
                  onChange={(event) => setSelectedDate(normalizeDateParam(event.target.value.replaceAll("-", "")))}
                />
              </label>
              <div className="app-card-muted px-4 py-3">
                <p className="app-label">Programme</p>
                <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">{races.length}</p>
              </div>
              <div className="app-card-muted px-4 py-3">
                <p className="app-label">Pistes chaudes</p>
                <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">{summaryStats.hot}</p>
              </div>
              <div className="app-card-muted px-4 py-3">
                <p className="app-label">Tri actif</p>
                <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                  {SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? "Par heure"}
                </p>
              </div>
            </div>

            <div className="border-t border-[var(--pmu-border)] pt-4">
              <div className="app-section-heading">
                <div>
                  <p className="app-kicker">Programme trié</p>
                  <h2 className="app-section-title">Opportunités détectées</h2>
                </div>
                <p className="max-w-xl text-sm leading-6 text-[var(--pmu-text-soft)]">
                  Chaque carte pousse une décision. Trie vite, garde la lecture utile, puis ouvre la bonne course.
                </p>
              </div>
              <FilterPills options={SORT_OPTIONS} value={sortMode} onChange={setSortMode} />
            </div>
          </div>

          <DirectCourseJump races={races} onOpenRace={navigateToRace} />
        </div>
      </section>

      <section className="app-section-heading">
        <div>
          <p className="app-kicker">Programme du jour</p>
          <h2 className="app-section-title">Les courses à ouvrir maintenant</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[var(--pmu-text-soft)]">
          Le haut de page sert à décider vite. Le programme détaillé commence ici, trié selon ton mode actif.
        </p>
      </section>


      {!isLoading && !error && featuredRaces.length > 0 && topParisItems.length === 0 ? (
        <section className="app-card p-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
          Aucune course ne dépasse le seuil JOUABLE ({SEUIL_JOUABLE}/10) pour le Top 3 : les cartes « ⚠️ À surveiller » restent candidates, ou rafraîchis après
          le signal 1 h / 🔴 Signal actif.
        </section>
      ) : null}

      {error ? (
        <section
          className="app-card border border-[color-mix(in_srgb,var(--pmu-red)_35%,transparent)] p-6"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-lg font-bold text-[var(--pmu-red)]">Impossible de charger la page Courses</p>
          <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{error}</p>
          <button
            type="button"
            className="app-button-primary mt-4"
            onClick={() => setFetchRevision((revision) => revision + 1)}
          >
            Réessayer
          </button>
        </section>
      ) : null}

      {isLoading ? (
        <section className="grid gap-5" aria-busy="true" aria-label="Chargement des courses">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="app-card h-52 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]"
            />
          ))}
        </section>
      ) : null}

      {!isLoading && !error && asArray<FeaturedRace>(featuredRaces).length ? (
        <section className="grid auto-rows-fr items-stretch gap-5 2xl:grid-cols-2">
          {asArray<FeaturedRace>(featuredRaces).map((item) => {
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
            const eloProfile = estimateEloProfileForProgrammeCard(item.score?.pick?.confidence);
            const indiceListe = estimateIndiceOuvertureListe({
              displayScore: item.scoreValue,
              partants: item.race.nombrePartants,
              sigmaPct: eloProfile.sigma,
            });
            return (
              <CourseCard
                key={`${item.race.reunion}-${item.race.course}`}
                raceTitle={`R${item.race.reunion}C${item.race.course} - ${item.race.nomCourse}`}
                subtitleLine={[item.race.hippodrome, formatCourseMeta(item.race)].join(" • ")}
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

      {!isLoading && !error && !featuredRaces.length ? (
        <section className="app-card p-8 text-center">
          <p className="text-xl font-bold text-[var(--pmu-text)]">Aucune course exploitable pour cette date</p>
          <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
            Change de journée ou recharge la page. Le moteur n’a pas encore remonté de programme utilisable.
          </p>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="app-section-heading">
          <div>
            <p className="app-kicker">Panneau secondaire</p>
            <h2 className="app-section-title">Preuves, démo et méthode</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[var(--pmu-text-soft)]">
            Le cœur produit reste au-dessus. Ici, tu ouvres seulement le bloc complémentaire dont tu as besoin.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {secondaryPanels.map((panel) => {
            const active = secondaryPanel === panel.key;
            return (
              <button
                key={panel.key}
                type="button"
                className={`app-pill ${active ? "app-pill--active" : ""}`}
                onClick={() => setSecondaryPanel(panel.key)}
              >
                {panel.label}
              </button>
            );
          })}
        </div>

        {secondaryPanel === "performance" ? <PerformanceProof /> : null}
        {secondaryPanel === "results" ? <RecentResults /> : null}
        {secondaryPanel === "demo" ? <PromoVideoSection /> : null}
        {secondaryPanel === "method" ? <HowItWorks /> : null}
        {secondaryPanel === "quinte" && quinteDuJour ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <SagesseFoules
              raceId={`${selectedDate}-R${quinteDuJour.race.reunion}C${quinteDuJour.race.course}`}
              raceLabel={`${quinteDuJour.race.nomCourse} (R${quinteDuJour.race.reunion}C${quinteDuJour.race.course})`}
            />
            <ComparatifIA
              dateStr={selectedDate}
              reunion={quinteDuJour.race.reunion}
              course={quinteDuJour.race.course}
              nomCourse={quinteDuJour.race.nomCourse}
            />
          </section>
        ) : null}
      </section>

    </div>
  );
}

function HomePageSkeletonFallback() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
      aria-busy="true"
      aria-label="Chargement du programme"
    >
      <div className="app-card h-56 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="app-card h-32 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]"
          />
        ))}
      </div>
      <div className="grid gap-5">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="app-card h-52 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]"
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
