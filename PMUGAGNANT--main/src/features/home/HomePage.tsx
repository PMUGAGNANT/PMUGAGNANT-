"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DayRadar } from "@/features/home/components/DayRadar";
import { HomeControlBar } from "@/features/home/components/HomeControlBar";
import { HomeLoadingSkeleton } from "@/features/home/components/HomeLoadingSkeleton";
import { PriorityTickets } from "@/features/home/components/PriorityTickets";
import { ProgrammeTable } from "@/features/home/components/ProgrammeTable";
import { TopParisStrip } from "@/features/home/components/TopParisStrip";
import { BIG_ALLOCATION_LIMIT, QUICK_FILTER_STORAGE_KEY, URGENT_MINUTES_LIMIT, isQuickFilter, type HomeLane, type HomeStats, type QuickFilter, type QuickFilterOption } from "@/features/home/components/home-page-types";
import { addDays, buildFeaturedRaces, coerceRaceSummaries, formatRaceCode, getRadarRace, getTopParisItems, normalizeDateParam, normalizeFocusParticipants, sortFeaturedRaces, type FocusDetailResponse, type FocusParticipant, type RaceScore, type RacesResponse, type ScoresResponse, type SortMode } from "@/features/home/lib/home-page-model";
import { fetchRaceDetails, fetchRaceScoresForDate, fetchRacesForDate, normalizeRaceScoresPayload } from "@/features/races/api/client";
import { getTodayDateStr } from "@/lib/date-utils";
import type { RaceSummary } from "@/lib/types";

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(normalizeDateParam(searchParams.get("date")));
  const [sortMode, setSortMode] = useState<SortMode>("hour");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [scores, setScores] = useState<RaceScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFocusLoading, setIsFocusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchRevision, setFetchRevision] = useState(0);
  const [focusDetail, setFocusDetail] = useState<FocusDetailResponse | null>(null);

  const navigateToRace = useCallback(
    (race: RaceSummary) => router.push(`/course/${race.reunion}/${race.course}?date=${race.dateStr}`),
    [router]
  );

  useEffect(() => {
    try {
      const storedSort = window.localStorage.getItem("pmu-sort-mode");
      if (storedSort === "hour" || storedSort === "score" || storedSort === "urgent" || storedSort === "allocation") {
        setSortMode(storedSort);
      }
      const storedFilter = window.localStorage.getItem(QUICK_FILTER_STORAGE_KEY);
      if (isQuickFilter(storedFilter)) setQuickFilter(storedFilter);
    } catch {
      // Local preferences are optional.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("pmu-sort-mode", sortMode);
      window.localStorage.setItem(QUICK_FILTER_STORAGE_KEY, quickFilter);
    } catch {
      // Local preferences are optional.
    }
  }, [sortMode, quickFilter]);

  useEffect(() => {
    const currentParam = normalizeDateParam(searchParams.get("date"));
    if (currentParam === selectedDate) return;
    router.replace(selectedDate === getTodayDateStr() ? "/" : `/?date=${selectedDate}`, { scroll: false });
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
        if (!racesResponse.success) throw new Error("Le service courses a renvoye une reponse invalide.");
        const scoresJson = scoresResponse ?? { success: true, scores: [] };
        if (!cancelled) {
          setRaces(coerceRaceSummaries(racesResponse.races));
          setScores(scoresJson.success ? normalizeRaceScoresPayload<RaceScore>(scoresJson.scores ?? null, selectedDate) : []);
        }
      } catch (loadError) {
        if (cancelled || (loadError instanceof Error && loadError.name === "AbortError")) return;
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger la page Courses.");
        setRaces([]);
        setScores([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadData();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [selectedDate, fetchRevision]);

  const featuredRaces = useMemo(() => {
    const normalizedScores = normalizeRaceScoresPayload<RaceScore>(scores, selectedDate);
    const map = new Map(normalizedScores.map((score) => [`${score.reunion}-${score.course}`, score]));
    return sortFeaturedRaces(buildFeaturedRaces(coerceRaceSummaries(races), map), sortMode);
  }, [races, scores, selectedDate, sortMode]);
  const topParisItems = useMemo(() => getTopParisItems(featuredRaces, navigateToRace), [featuredRaces, navigateToRace]);
  const topParisCodes = useMemo(() => new Set(topParisItems.map((item) => item.raceCode)), [topParisItems]);
  const quickFilterOptions = useMemo<QuickFilterOption[]>(() => [
    { value: "all", label: "Tout", description: "Programme complet", count: featuredRaces.length },
    { value: "top3", label: "Top 3", description: "Priorites nettes", count: featuredRaces.filter((item) => topParisCodes.has(formatRaceCode(item.race))).length },
    { value: "jouable", label: "Jouables", description: "Feu vert moteur", count: featuredRaces.filter((item) => item.status === "jouable").length },
    { value: "urgent", label: "Depart proche", description: `Moins de ${URGENT_MINUTES_LIMIT} min`, count: featuredRaces.filter((item) => item.status !== "resultat" && item.minutesUntilStart <= URGENT_MINUTES_LIMIT).length },
    { value: "quinte", label: "Quintes", description: "Courses premium", count: featuredRaces.filter((item) => item.race.estQuinte).length },
    { value: "allocation", label: "Gros enjeux", description: `Allocation ${BIG_ALLOCATION_LIMIT / 1000}k+`, count: featuredRaces.filter((item) => (item.race.allocation ?? 0) >= BIG_ALLOCATION_LIMIT).length },
  ], [featuredRaces, topParisCodes]);
  const filteredFeaturedRaces = useMemo(() => {
    if (quickFilter === "top3") return featuredRaces.filter((item) => topParisCodes.has(formatRaceCode(item.race)));
    if (quickFilter === "jouable") return featuredRaces.filter((item) => item.status === "jouable");
    if (quickFilter === "urgent") return featuredRaces.filter((item) => item.status !== "resultat" && item.minutesUntilStart <= URGENT_MINUTES_LIMIT);
    if (quickFilter === "quinte") return featuredRaces.filter((item) => item.race.estQuinte);
    if (quickFilter === "allocation") return featuredRaces.filter((item) => (item.race.allocation ?? 0) >= BIG_ALLOCATION_LIMIT);
    return featuredRaces;
  }, [featuredRaces, quickFilter, topParisCodes]);
  const lanes = useMemo<HomeLane[]>(() => {
    const active = [
      { key: "jouable" as const, items: filteredFeaturedRaces.filter((item) => item.status === "jouable") },
      { key: "surveillance" as const, items: filteredFeaturedRaces.filter((item) => item.status === "surveillance") },
      { key: "passer" as const, items: filteredFeaturedRaces.filter((item) => item.status === "passer") },
    ].filter((lane) => lane.items.length > 0);
    if (active.length > 0) return active;
    const results = filteredFeaturedRaces.filter((item) => item.status === "resultat");
    return results.length > 0 ? [{ key: "resultat", items: results }] : [];
  }, [filteredFeaturedRaces]);
  const focusRace = useMemo(() => lanes[0]?.items[0] ?? getRadarRace(filteredFeaturedRaces), [filteredFeaturedRaces, lanes]);

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
        const payload = await fetchRaceDetails<FocusDetailResponse>(focusRace.race.reunion, focusRace.race.course, { date: selectedDate, signal: ac.signal });
        if (!cancelled) setFocusDetail(payload.success === false ? null : payload);
      } catch (focusError) {
        if (!cancelled && !(focusError instanceof Error && focusError.name === "AbortError")) setFocusDetail(null);
      } finally {
        if (!cancelled) setIsFocusLoading(false);
      }
    }
    void loadFocusDetail();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [focusRace, selectedDate]);

  const focusParticipants = useMemo<FocusParticipant[]>(() => {
    const ranking = normalizeFocusParticipants(focusDetail?.analysis?.ranking);
    if (ranking.length > 0) return ranking.slice(0, 5);
    return normalizeFocusParticipants(focusDetail?.participants)
      .sort((left, right) => (right.prediction?.scoreCheval ?? -1) - (left.prediction?.scoreCheval ?? -1) || (left.cote ?? Number.POSITIVE_INFINITY) - (right.cote ?? Number.POSITIVE_INFINITY))
      .slice(0, 5);
  }, [focusDetail]);
  const stats = useMemo<HomeStats>(() => ({
    total: races.length,
    meetings: new Set(races.map((race) => race.reunion)).size,
    playable: featuredRaces.filter((item) => item.status === "jouable").length,
    active: featuredRaces.filter((item) => item.status !== "resultat").length,
  }), [featuredRaces, races]);

  return (
    <div className="turf-home-page mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
      <HomeControlBar selectedDate={selectedDate} sortMode={sortMode} stats={stats} focusRace={focusRace} onPrevDay={() => setSelectedDate(addDays(selectedDate, -1))} onToday={() => setSelectedDate(getTodayDateStr())} onNextDay={() => setSelectedDate(addDays(selectedDate, 1))} onDateChange={setSelectedDate} onSortChange={setSortMode} />
      <div className="turf-main-layout">
        <div className="turf-main-column">
          {isLoading ? <HomeLoadingSkeleton /> : error ? (
            <section className="app-card border border-[color-mix(in_srgb,var(--pmu-red)_35%,transparent)] p-6" role="alert" aria-live="assertive">
              <p className="text-lg font-bold text-[var(--pmu-red)]">Impossible de charger la page Courses</p>
              <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{error}</p>
              <button type="button" className="app-button-primary mt-4" onClick={() => setFetchRevision((revision) => revision + 1)}>Reessayer</button>
            </section>
          ) : featuredRaces.length === 0 ? (
            <section className="app-card p-8 text-center">
              <p className="text-xl font-black text-[var(--pmu-text)]">Aucune course exploitable pour cette date</p>
              <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">Recharge la journee ou change de date.</p>
            </section>
          ) : (
            <>
              <PriorityTickets focusRace={focusRace} focusDetail={focusDetail} focusParticipants={focusParticipants} isFocusLoading={isFocusLoading} stats={stats} sortMode={sortMode} onOpenRace={navigateToRace} onOpenPremium={() => router.push("/premium")} />
              {topParisItems.length > 0 ? <TopParisStrip items={topParisItems} /> : null}
              <ProgrammeTable quickFilter={quickFilter} quickFilterOptions={quickFilterOptions} lanes={lanes} playableCount={stats.playable} onQuickFilterChange={setQuickFilter} onOpenRace={navigateToRace} />
            </>
          )}
        </div>
        <DayRadar focusRace={focusRace} focusParticipants={focusParticipants} stats={stats} />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoadingSkeleton />}>
      <PageContent />
    </Suspense>
  );
}
