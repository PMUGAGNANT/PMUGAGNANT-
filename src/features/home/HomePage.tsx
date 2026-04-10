"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { FilterPills } from "@/features/home/components/FilterPills";
import { HomeBoard } from "@/features/home/components/HomeBoard";
import { HomeFocusSplit } from "@/features/home/components/HomeFocusSplit";
import {
  SORT_OPTIONS,
  addDays,
  buildFeaturedRaces,
  coerceRaceSummaries,
  formatDisplayDate,
  getBoardSectionMeta,
  getPriorityCards,
  getRadarRace,
  getTopParisItems,
  normalizeDateParam,
  normalizeFocusParticipants,
  sortFeaturedRaces,
  type BoardFilter,
  type BoardSectionKey,
  type FeaturedRace,
  type FocusDetailResponse,
  type HomeSecondaryPanel,
  type HomeSummaryStats,
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
import { getTodayDateStr, toIsoDate } from "@/lib/date-utils";
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
  const [fetchRevision, setFetchRevision] = useState(0);
  const [focusDetail, setFocusDetail] = useState<FocusDetailResponse | null>(null);

  const navigateToRace = useCallback(
    (race: RaceSummary) => {
      const target = `/course/${race.reunion}/${race.course}?date=${race.dateStr}`;
      router.push(target);
    },
    [router]
  );

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

  const radarRace = useMemo(() => getRadarRace(featuredRaces), [featuredRaces]);
  const topParisItems = useMemo(
    () => getTopParisItems(featuredRaces, navigateToRace),
    [featuredRaces, navigateToRace]
  );
  const focusRace = radarRace ?? null;

  const summaryStats = useMemo<HomeSummaryStats>(() => {
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

          return (
            a.minutesUntilStart - b.minutesUntilStart ||
            b.scoreValue - a.scoreValue
          );
        })
        .slice(0, 4),
    [featuredRaces]
  );

  const secondaryPanels = useMemo(
    () =>
      [
        { key: "performance", label: "Performance" },
        { key: "results", label: "Resultats" },
        { key: "demo", label: "Demo produit" },
        { key: "method", label: "Methode" },
      ] satisfies Array<{ key: HomeSecondaryPanel; label: string }>,
    []
  );

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

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
      {focusRace ? (
        <HomeFocusSplit
          focusRace={focusRace}
          selectedDate={selectedDate}
          focusDetail={focusDetail}
          focusParticipants={focusParticipants}
          isFocusLoading={isFocusLoading}
          summaryStats={summaryStats}
          sortModeLabel={
            SORT_OPTIONS.find((option) => option.value === sortMode)?.label ??
            "Par heure"
          }
          onOpenRace={navigateToRace}
          onOpenPremium={() => router.push("/premium")}
        />
      ) : (
        <section className="app-page-hero p-6 md:p-8">
          <p className="app-kicker">Board du jour</p>
          <h1 className="mt-3 text-4xl font-black leading-[0.92] text-[var(--pmu-text)] md:text-6xl">
            Le board attend le programme du jour.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
            Recharge la journee ou laisse le programme PMU remonter. La home
            affichera ensuite directement la course focus a gauche et la fenetre
            complete a droite.
          </p>
        </section>
      )}

      <section className="app-card p-4 md:p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div>
              <p className="app-kicker">Pilotage du jour</p>
              <h2 className="mt-2 text-2xl font-black capitalize tracking-tight text-[var(--pmu-text)] md:text-3xl">
                {formatDisplayDate(selectedDate)}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)]">
                Choisir la journee, regler le tri puis laisser le board remonter
                les courses utiles sans multiplier les blocs.
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

          <div className="flex w-full max-w-[44rem] flex-col gap-3">
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

            <FilterPills
              options={SORT_OPTIONS}
              value={sortMode}
              onChange={setSortMode}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
      </section>

      <HomeBoard
        isLoading={isLoading}
        error={error}
        featuredRaces={featuredRaces}
        activePriorityRaces={activePriorityRaces}
        boardFilter={boardFilter}
        boardFilterOptions={boardFilterOptions}
        boardSections={boardSections}
        boardCounts={boardCounts}
        topParisItems={topParisItems}
        priorityCards={priorityCards}
        secondaryPanels={secondaryPanels}
        secondaryPanel={secondaryPanel}
        onBoardFilterChange={setBoardFilter}
        onSecondaryPanelChange={setSecondaryPanel}
        onOpenRace={(item) => navigateToRace(item.race)}
        onRetry={() => setFetchRevision((revision) => revision + 1)}
      />
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
      <div className="app-card h-80 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeletonFallback />}>
      <PageContent />
    </Suspense>
  );
}
