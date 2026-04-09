"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AccordionPanel } from "@/components/ui/AccordionPanel";
import { CourseCard } from "@/features/home/components/CourseCard";
import { FilterPills } from "@/features/home/components/FilterPills";
import { HowItWorks } from "@/features/home/components/HowItWorks";
import { PerformanceProof } from "@/features/home/components/PerformanceProof";
import { PromoVideoSection } from "@/features/home/components/PromoVideoSection";
import { RecentResults } from "@/features/home/components/RecentResults";
import { TopParisStrip } from "@/features/home/components/TopParisStrip";
import {
  SORT_OPTIONS,
  addDays,
  buildFeaturedRaces,
  coerceRaceSummaries,
  formatCourseMeta,
  formatDisplayDate,
  formatMinutesLabel,
  formatOddsLabel,
  formatRelativeDay,
  getBoardPriorityBadge,
  getBoardSectionMeta,
  getParticipantNum,
  getPriorityCards,
  getRadarRace,
  getStageLabel,
  getTopParisItems,
  normalizeDateParam,
  normalizeFocusParticipants,
  sortFeaturedRaces,
  type BoardFilter,
  type BoardSectionKey,
  type FeaturedRace,
  type FocusDetailResponse,
  type HomeSecondaryPanel,
  type RaceScore,
  type RacesResponse,
  type ScoresResponse,
  type SortMode,
} from "@/features/home/lib/home-page-model";
import {
  fetchRaceDetails,
  fetchRacesForDate,
  fetchRaceScoresForDate,
  normalizeRaceScoresPayload,
} from "@/features/races/api/client";
import { asArray } from "@/lib/array-utils";
import { translateFactors } from "@/lib/beginner-labels";
import {
  formatBetTypeLabelFr,
  getRaceProfile,
  SEUIL_JOUABLE,
} from "@/lib/client-race-scoring";
import {
  getTodayDateStr,
  toIsoDate,
} from "@/lib/date-utils";
import { estimateEloProfileForProgrammeCard } from "@/lib/elo-scoring";
import { estimateIndiceOuvertureListe } from "@/lib/ouverture";
import { getPriorityToneColor } from "@/lib/race-priority";
import type { RaceSummary } from "@/lib/types";

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = normalizeDateParam(searchParams.get("date"));

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [sortMode, setSortMode] = useState<SortMode>("hour");
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all");
  const [secondaryPanel, setSecondaryPanel] =
    useState<HomeSecondaryPanel | null>("performance");
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [scores, setScores] = useState<RaceScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFocusLoading, setIsFocusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusDetail, setFocusDetail] = useState<FocusDetailResponse | null>(null);
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
        const [racesResponse, scoresResponse] = await Promise.all([
          fetchRacesForDate<RacesResponse>(selectedDate, ac.signal),
          fetchRaceScoresForDate<ScoresResponse>(selectedDate, ac.signal),
        ]);
        if (!racesResponse.success) {
          throw new Error("Le service courses a renvoye une reponse invalide.");
        }
        const scoresJson = scoresResponse ?? { success: true, scores: [] };

        if (!cancelled) {
          setRaces(coerceRaceSummaries(racesResponse.races));
          setScores(
            scoresJson.success
              ? normalizeRaceScoresPayload<RaceScore>(
                  scoresJson.scores ?? null,
                  selectedDate
                )
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
      normalizeRaceScoresPayload<RaceScore>(scores, selectedDate).map((score) => [
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

  const topParisItems = useMemo(
    () => getTopParisItems(featuredRaces, navigateToRace),
    [featuredRaces, navigateToRace]
  );

  const focusRace = radarRace ?? null;

  const summaryStats = useMemo(() => {
    const meetings = new Set(races.map((race) => race.reunion)).size;
    const playable = featuredRaces.filter(
      (item) => item.status === "jouable"
    ).length;
    return { meetings, playable };
  }, [featuredRaces, races]);

  const priorityCards = useMemo(
    () => getPriorityCards(featuredRaces),
    [featuredRaces]
  );
  const activePriorityRaces = useMemo(
    () =>
      featuredRaces
        .filter(
          (item) =>
            item.status !== "resultat" && (item.priorityBadge?.weight ?? 0) > 0
        )
        .sort((a, b) => {
          const weightDelta =
            (b.priorityBadge?.weight ?? 0) - (a.priorityBadge?.weight ?? 0);
          if (weightDelta !== 0) {
            return weightDelta;
          }

          return a.minutesUntilStart - b.minutesUntilStart || b.scoreValue - a.scoreValue;
        })
        .slice(0, 4),
    [featuredRaces]
  );

  const secondaryPanels = useMemo(() => {
    return [
      { key: "performance", label: "Performance" },
      { key: "results", label: "Resultats" },
      { key: "demo", label: "Demo produit" },
      { key: "method", label: "Methode" },
    ] satisfies Array<{ key: HomeSecondaryPanel; label: string }>;
  }, []);

  useEffect(() => {
    if (!focusRace) {
      setFocusDetail(null);
      setIsFocusLoading(false);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    async function loadFocusDetail() {
      setIsFocusLoading(true);

      try {
        const payload = await fetchRaceDetails<FocusDetailResponse>(
          focusRace.race.reunion,
          focusRace.race.course,
          {
            date: selectedDate,
            signal: ac.signal,
          }
        );

        if (!cancelled) {
          setFocusDetail(payload.success === false ? null : payload);
        }
      } catch (focusError) {
        if (cancelled) {
          return;
        }
        if (focusError instanceof Error && focusError.name === "AbortError") {
          return;
        }
        console.error(focusError);
        setFocusDetail(null);
      } finally {
        if (!cancelled) {
          setIsFocusLoading(false);
        }
      }
    }

    void loadFocusDetail();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [focusRace, selectedDate]);

  const focusParticipants = useMemo(() => {
    const ranking = normalizeFocusParticipants(focusDetail?.analysis?.ranking);
    if (ranking.length > 0) {
      return ranking.slice(0, 6);
    }

    return normalizeFocusParticipants(focusDetail?.participants)
      .sort((left, right) => {
        const leftScore = left.prediction?.scoreCheval ?? -1;
        const rightScore = right.prediction?.scoreCheval ?? -1;

        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }

        const leftCote = left.cote ?? Number.POSITIVE_INFINITY;
        const rightCote = right.cote ?? Number.POSITIVE_INFINITY;
        return leftCote - rightCote;
      })
      .slice(0, 6);
  }, [focusDetail]);

  const focusDisplayScore = focusRace ? focusRace.scoreValue.toFixed(1) : "--";
  const focusPriorityBadge = focusRace ? getBoardPriorityBadge(focusRace) : null;
  const focusLisibilite =
    focusRace?.score?.lisibilite ??
    focusDetail?.paywall?.preview?.lisibilite ??
    "COMPLEXE";
  const focusBetType = focusRace?.score?.pick?.betType
    ? formatBetTypeLabelFr(focusRace.score.pick.betType)
    : focusDetail?.analysis?.recommandation?.decision ??
      focusDetail?.paywall?.preview?.recommendation ??
      "En attente";
  const focusPickTitle = focusRace?.score?.pick?.numPmu || focusRace?.score?.pick?.nom
    ? `#${focusRace?.score?.pick?.numPmu ?? "--"} ${focusRace?.score?.pick?.nom ?? "Selection"}`
    : focusDetail?.paywall?.preview?.favori?.numPmu ||
        focusDetail?.paywall?.preview?.favori?.nom
      ? `#${focusDetail?.paywall?.preview?.favori?.numPmu ?? "--"} ${focusDetail?.paywall?.preview?.favori?.nom ?? "Favori"}`
      : "Ticket principal en preparation";
  const focusFactors = translateFactors(
    focusRace?.score?.pick?.topFacteurs ??
      focusDetail?.analysis?.scoreConfiance?.facteurs ??
      []
  ).slice(0, 3);
  const focusMinutesLabel = formatMinutesLabel(
    focusDetail?.minutesUntilStart ?? focusRace?.minutesUntilStart ?? null
  );
  const boardCounts = useMemo(
    () => ({
      all: featuredRaces.length,
      prioritaire: activePriorityRaces.length,
      jouable: featuredRaces.filter((item) => item.status === "jouable").length,
      surveillance: featuredRaces.filter((item) => item.status === "surveillance")
        .length,
      passer: featuredRaces.filter((item) => item.status === "passer").length,
      resultat: featuredRaces.filter((item) => item.status === "resultat").length,
    }),
    [activePriorityRaces.length, featuredRaces]
  );
  const boardFilterOptions = useMemo(
    () => [
      { value: "all" as const, label: `Toutes (${boardCounts.all})` },
      {
        value: "prioritaire" as const,
        label: `Suivi renforce (${boardCounts.prioritaire})`,
      },
      { value: "jouable" as const, label: `Vertes (${boardCounts.jouable})` },
      {
        value: "surveillance" as const,
        label: `Jaunes (${boardCounts.surveillance})`,
      },
      { value: "passer" as const, label: `Rouges (${boardCounts.passer})` },
    ],
    [boardCounts]
  );
  const boardSections = useMemo(() => {
    const grouped: Record<BoardSectionKey, FeaturedRace[]> = {
      prioritaire: activePriorityRaces,
      jouable: featuredRaces.filter((item) => item.status === "jouable"),
      surveillance: featuredRaces.filter(
        (item) => item.status === "surveillance"
      ),
      passer: featuredRaces.filter((item) => item.status === "passer"),
      resultat: featuredRaces.filter((item) => item.status === "resultat"),
    };

    const keys: BoardSectionKey[] =
      boardFilter === "all"
        ? ["jouable", "surveillance", "passer", "resultat"]
        : [boardFilter];

    return keys
      .map((key) => ({
        key,
        items: grouped[key],
        ...getBoardSectionMeta(key),
      }))
      .filter((section) =>
        boardFilter === "all" ? section.items.length > 0 : true
      );
  }, [activePriorityRaces, boardFilter, featuredRaces]);

  function renderBoardCard(item: FeaturedRace) {
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
        subtitleLine={[item.race.hippodrome, formatCourseMeta(item.race)].join(
          " - "
        )}
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
        priorityBadge={item.priorityBadge}
        onClick={() => navigateToRace(item.race)}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
      {focusRace ? (
        <section className="grid gap-5 xl:grid-cols-[0.34fr,0.66fr] xl:items-start">
          <aside className="app-card p-5 md:p-6 xl:sticky xl:top-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="app-kicker">
                  {focusRace.race.estQuinte ? "Quinte du jour" : "Course du jour"}
                </p>
                <p className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
                  R{focusRace.race.reunion}C{focusRace.race.course}
                </p>
              </div>
              <span className="app-pill text-[11px]">
                {focusLisibilite.toLowerCase()}
              </span>
            </div>

            <h1 className="mt-5 text-[2rem] font-black leading-[0.94] text-[var(--pmu-text)]">
              {focusRace.race.nomCourse}
            </h1>
            <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
              {focusRace.hint}
            </p>

            <div className="mt-5 grid gap-3">
              <div className="app-card-muted px-4 py-4">
                <p className="app-label">Radar</p>
                <p className="mt-2 text-3xl font-black text-[var(--pmu-primary)]">
                  {focusDisplayScore}/10
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="app-card-muted px-4 py-4">
                  <p className="app-label">Fenetre</p>
                  <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                    {focusMinutesLabel}
                  </p>
                </div>
                <div className="app-card-muted px-4 py-4">
                  <p className="app-label">Partants</p>
                  <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                    {focusRace.race.nombrePartants}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="app-pill text-xs">{focusRace.race.hippodrome}</span>
              <span className="app-pill text-xs">{focusRace.race.heureDepart}</span>
              <span className="app-pill text-xs">{formatCourseMeta(focusRace.race)}</span>
              {focusPriorityBadge ? (
                <span
                  className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                  style={{
                    color: getPriorityToneColor(focusPriorityBadge.tone),
                    borderColor: `color-mix(in srgb, ${getPriorityToneColor(
                      focusPriorityBadge.tone
                    )} 24%, transparent)`,
                    background: `color-mix(in srgb, ${getPriorityToneColor(
                      focusPriorityBadge.tone
                    )} 10%, var(--pmu-surface))`,
                  }}
                >
                  {focusPriorityBadge.label} · {focusPriorityBadge.detail}
                </span>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigateToRace(focusRace.race)}
                className="app-button-primary w-full"
              >
                Ouvrir la course
              </button>
              {focusDetail?.paywall?.required ? (
                <button
                  type="button"
                  onClick={() => router.push("/premium")}
                  className="app-button-secondary w-full"
                >
                  Debloquer le ticket
                </button>
              ) : null}
            </div>
          </aside>

          <section className="app-card p-6 md:p-7">
            <div className="app-section-heading">
              <div>
                <p className="app-kicker">Fenetre complete</p>
                <h2 className="app-section-title">
                  Partants, prediction et lecture dans le meme panneau
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="app-pill text-xs">
                  {formatRelativeDay(selectedDate)}
                </span>
                <span className="app-pill text-xs">
                  {focusRace.score?.stage
                    ? getStageLabel(focusRace.score.stage)
                    : "Lecture programme"}
                </span>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
              <div className="space-y-4">
                <section className="rounded-[1.45rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="app-label">Ticket principal</p>
                      <h3 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                        {focusPickTitle}
                      </h3>
                    </div>
                    <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[var(--pmu-primary-fade)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--pmu-primary)]">
                      {focusBetType}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="app-card-muted px-4 py-4">
                      <p className="app-label">Score</p>
                      <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                        {focusDisplayScore}/10
                      </p>
                    </div>
                    <div className="app-card-muted px-4 py-4">
                      <p className="app-label">Fenetre</p>
                      <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
                        {focusMinutesLabel}
                      </p>
                    </div>
                    <div className="app-card-muted px-4 py-4">
                      <p className="app-label">Programme</p>
                      <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
                        {focusRace.race.hippodrome}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-[var(--pmu-text-soft)]">
                    {focusDetail?.paywall?.required
                      ? "Les partants restent visibles, mais le ticket detaille se renforce avec l'acces premium."
                      : focusRace.hint}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {focusFactors.length > 0
                      ? focusFactors.map((factor) => (
                          <span key={factor} className="app-pill text-xs">
                            {factor}
                          </span>
                        ))
                      : [
                          focusRace.race.estQuinte ? "Course Quinte" : "Course cible",
                          `${focusRace.race.nombrePartants} partants`,
                          focusMinutesLabel,
                        ].map((factor) => (
                          <span key={factor} className="app-pill text-xs">
                            {factor}
                          </span>
                        ))}
                  </div>
                </section>

                <section className="rounded-[1.45rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-5">
                  <p className="app-label">Board rapide</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="app-card-muted px-4 py-4">
                      <p className="app-label">Date</p>
                      <p className="mt-2 text-sm font-black capitalize text-[var(--pmu-text)]">
                        {formatRelativeDay(selectedDate)}
                      </p>
                    </div>
                    <div className="app-card-muted px-4 py-4">
                      <p className="app-label">Reunions</p>
                      <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
                        {summaryStats.meetings} actives
                      </p>
                    </div>
                    <div className="app-card-muted px-4 py-4">
                      <p className="app-label">Jouables</p>
                      <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
                        {summaryStats.playable} spots
                      </p>
                    </div>
                    <div className="app-card-muted px-4 py-4">
                      <p className="app-label">Tri</p>
                      <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
                        {SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? "Par heure"}
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              <section className="rounded-[1.45rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="app-label">Partants visibles</p>
                    <h3 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                      Les chevaux a garder a l&apos;ecran
                    </h3>
                  </div>
                  <span className="app-pill text-xs">
                    {focusParticipants.length > 0
                      ? `${focusParticipants.length} lignes`
                      : isFocusLoading
                        ? "Chargement"
                        : "Liste PMU"}
                  </span>
                </div>

                <div className="mt-5 space-y-2">
                  {isFocusLoading ? (
                    Array.from({ length: 4 }, (_, index) => (
                      <div
                        key={index}
                        className="h-20 animate-pulse rounded-[1.1rem] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)]"
                      />
                    ))
                  ) : focusParticipants.length > 0 ? (
                    focusParticipants.map((participant) => {
                      const num = getParticipantNum(participant);
                      const confidence = participant.prediction?.confiance;
                      const participantBet = participant.prediction?.typePariConseille;

                      return (
                        <div
                          key={`${num}-${participant.nom ?? "cheval"}`}
                          className="grid gap-3 rounded-[1.15rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] px-4 py-4 md:grid-cols-[auto,1fr,auto]"
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[color-mix(in_srgb,var(--pmu-primary)_24%,transparent)] bg-[var(--pmu-primary-fade)] text-lg font-black text-[var(--pmu-text)]">
                            {Number.isFinite(num) ? num : "--"}
                          </div>

                          <div>
                            <p className="text-base font-black text-[var(--pmu-text)]">
                              {participant.nom ?? "Cheval"}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-[var(--pmu-text-soft)]">
                              {participant.jockey ?? participant.driver ?? "Jockey non renseigne"}
                              {participant.entraineur ? ` - ${participant.entraineur}` : ""}
                            </p>
                            {participant.prediction?.topFacteurs?.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {translateFactors(participant.prediction.topFacteurs)
                                  .slice(0, 2)
                                  .map((factor) => (
                                    <span key={factor} className="app-pill text-[11px]">
                                      {factor}
                                    </span>
                                  ))}
                              </div>
                            ) : null}
                          </div>

                          <div className="text-left md:text-right">
                            <p className="text-sm font-black text-[var(--pmu-text)]">
                              Cote {formatOddsLabel(participant.cote)}
                            </p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--pmu-text-muted)]">
                              {confidence != null && Number.isFinite(confidence)
                                ? `Confiance ${confidence.toFixed(1)}/10`
                                : "Lecture PMU"}
                            </p>
                            <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--pmu-primary)]">
                              {participantBet
                                ? formatBetTypeLabelFr(participantBet)
                                : "A suivre"}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[1.15rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] px-4 py-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
                      Le detail course arrive ici avec les partants et la lecture prediction des que l&apos;API PMU remonte le bloc complet.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </section>
        </section>
      ) : (
        <section className="app-page-hero p-6 md:p-8">
          <p className="app-kicker">Board du jour</p>
          <h1 className="mt-3 text-4xl font-black leading-[0.92] text-[var(--pmu-text)] md:text-6xl">
            Le board attend le programme du jour.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
            Recharge la journee ou laisse le programme PMU remonter. La home
            affichera ensuite directement la course focus a gauche et la
            fenetre complete a droite.
          </p>
        </section>
      )}

      <section className="app-card p-5 md:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr] xl:items-start">
          <div className="space-y-4">
            <div>
              <p className="app-kicker">Barre de commande</p>
              <h2 className="mt-2 text-2xl font-black capitalize tracking-tight text-[var(--pmu-text)] md:text-3xl">
                {formatDisplayDate(selectedDate)}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)]">
                Une seule chose a faire ici : choisir la journee, regler le tri
                et laisser le focus du dessus pousser la bonne course.
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

            <div className="grid gap-4 lg:grid-cols-[minmax(0,14rem),1fr] lg:items-center">
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
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Programme</p>
              <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                {races.length}
              </p>
            </div>
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Jouables</p>
              <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                {summaryStats.playable}
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
                {focusRace
                  ? `R${focusRace.race.reunion}C${focusRace.race.course}`
                  : "Programme complet"}
              </p>
            </div>
          </div>
        </div>
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
          <h2 className="app-section-title">Le programme trie par niveau d&apos;action</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[var(--pmu-text-soft)]">
          Vertes pour agir, jaunes pour garder sous radar, rouges pour filtrer.
          Le board ne melange plus les bons spots avec le bruit.
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
        <section className="space-y-6">
          {activePriorityRaces.length > 0 ? (
            <section className="app-card p-4 md:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="app-kicker">File active</p>
                  <h3 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                    Les courses que le moteur repasse le plus souvent
                  </h3>
                </div>
                <span className="app-pill text-xs">
                  {activePriorityRaces.length} course{activePriorityRaces.length > 1 ? "s" : ""} chaude{activePriorityRaces.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-4">
                {activePriorityRaces.map((item) => {
                  const badge = item.priorityBadge;
                  if (!badge) {
                    return null;
                  }

                  const toneColor = getPriorityToneColor(badge.tone);

                  return (
                    <button
                      key={`priority-${item.race.reunion}-${item.race.course}`}
                      type="button"
                      onClick={() => navigateToRace(item.race)}
                      className="rounded-[1.25rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] px-4 py-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span
                          className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                          style={{
                            color: toneColor,
                            borderColor: `color-mix(in srgb, ${toneColor} 24%, transparent)`,
                            background: `color-mix(in srgb, ${toneColor} 10%, var(--pmu-surface))`,
                          }}
                        >
                          {badge.label}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-muted)]">
                          R{item.race.reunion}C{item.race.course}
                        </span>
                      </div>
                      <h4 className="mt-3 text-lg font-black leading-tight text-[var(--pmu-text)]">
                        {item.race.nomCourse}
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
                        {item.race.hippodrome} · {item.race.heureDepart} · {badge.detail}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="app-pill text-[11px]">
                          {item.scoreValue.toFixed(1)}/10
                        </span>
                        <span className="app-pill text-[11px]">
                          {item.status === "jouable"
                            ? "verte"
                            : item.status === "surveillance"
                              ? "jaune"
                              : "rouge"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="app-card p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="app-kicker">Tri V6</p>
                <h3 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                  Regrouper le board par couleur aide a ouvrir plus vite
                </h3>
              </div>
              <div className="w-full max-w-2xl">
                <FilterPills
                  options={boardFilterOptions}
                  value={boardFilter}
                  onChange={setBoardFilter}
                />
              </div>
            </div>
          </div>

          {boardSections.map((section) => (
            <section key={section.key} className="space-y-4">
              <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_80%,transparent)] px-5 py-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                      style={{
                        color: section.color,
                        borderColor: `color-mix(in srgb, ${section.color} 24%, transparent)`,
                        background: `color-mix(in srgb, ${section.color} 10%, var(--pmu-surface))`,
                      }}
                    >
                      {section.label}
                    </span>
                    <span className="text-sm font-semibold text-[var(--pmu-text-muted)]">
                      {section.items.length} course{section.items.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-black text-[var(--pmu-text)]">
                    {section.title}
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--pmu-text-soft)]">
                    {section.description}
                  </p>
                </div>
              </div>

              {section.items.length > 0 ? (
                <div className="grid auto-rows-fr items-stretch gap-5 2xl:grid-cols-2">
                  {section.items.map((item) => renderBoardCard(item))}
                </div>
              ) : (
                <div className="app-card p-5">
                  <p className="text-base font-black text-[var(--pmu-text)]">
                    {section.key === "prioritaire"
                      ? `0 course chaude. Il reste ${boardCounts.jouable} verte${boardCounts.jouable > 1 ? "s" : ""}, ${boardCounts.surveillance} jaune${boardCounts.surveillance > 1 ? "s" : ""} et ${boardCounts.passer} rouge${boardCounts.passer > 1 ? "s" : ""}.`
                      : section.key === "jouable"
                      ? `0 course verte. Il reste ${boardCounts.surveillance} jaune${boardCounts.surveillance > 1 ? "s" : ""} et ${boardCounts.passer} rouge${boardCounts.passer > 1 ? "s" : ""}.`
                      : section.key === "surveillance"
                        ? `0 course jaune. Il reste ${boardCounts.jouable} verte${boardCounts.jouable > 1 ? "s" : ""} et ${boardCounts.passer} rouge${boardCounts.passer > 1 ? "s" : ""}.`
                        : section.key === "passer"
                          ? `0 course rouge. Il reste ${boardCounts.jouable} verte${boardCounts.jouable > 1 ? "s" : ""} et ${boardCounts.surveillance} jaune${boardCounts.surveillance > 1 ? "s" : ""}.`
                          : "Aucune course dans cette vue."}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
                    {section.key === "prioritaire"
                      ? "Le filtre Suivi renforce ne montre que les courses sous cadence active du moteur."
                      : section.key === "jouable"
                      ? "Le filtre Vertes isole uniquement les validations fortes. Les autres courses existent toujours dans les vues jaune et rouge."
                      : section.key === "surveillance"
                        ? "Le filtre Jaunes ne montre que les courses a garder sous radar, pas tout le programme."
                        : section.key === "passer"
                          ? "Le filtre Rouges ne montre que les courses a filtrer, pas l'ensemble du board."
                          : "Change de filtre pour revenir au programme complet."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setBoardFilter("all")}
                      className="app-button-secondary text-xs"
                    >
                      Voir tout
                    </button>
                    {section.key !== "prioritaire" && boardCounts.prioritaire > 0 ? (
                      <button
                        type="button"
                        onClick={() => setBoardFilter("prioritaire")}
                        className="app-button-secondary text-xs"
                      >
                        Voir la file active
                      </button>
                    ) : null}
                    {section.key !== "jouable" && boardCounts.jouable > 0 ? (
                      <button
                        type="button"
                        onClick={() => setBoardFilter("jouable")}
                        className="app-button-secondary text-xs"
                      >
                        Voir les vertes
                      </button>
                    ) : null}
                    {section.key !== "surveillance" && boardCounts.surveillance > 0 ? (
                      <button
                        type="button"
                        onClick={() => setBoardFilter("surveillance")}
                        className="app-button-secondary text-xs"
                      >
                        Voir les jaunes
                      </button>
                    ) : null}
                    {section.key !== "passer" && boardCounts.passer > 0 ? (
                      <button
                        type="button"
                        onClick={() => setBoardFilter("passer")}
                        className="app-button-secondary text-xs"
                      >
                        Voir les rouges
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </section>
          ))}
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

      {topParisItems.length > 0 ? <TopParisStrip items={topParisItems} /> : null}

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
            demo et la methode quand on en a besoin.
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
                    : "Processus";

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
