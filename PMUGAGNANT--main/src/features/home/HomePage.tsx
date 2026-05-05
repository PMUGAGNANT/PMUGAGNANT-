"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import DashboardHeaderAccount from "@/components/dashboard/DashboardHeaderAccount";
import { AccordionPanel } from "@/components/ui/AccordionPanel";
import { DayRadar } from "@/features/home/components/DayRadar";
import { HomeHero } from "@/features/home/components/HomeHero";
import { HomeLoadingSkeleton } from "@/features/home/components/HomeLoadingSkeleton";
import { ProgrammeTable } from "@/features/home/components/ProgrammeTable";
import { TopParisStrip } from "@/features/home/components/TopParisStrip";
import { BIG_ALLOCATION_LIMIT, QUICK_FILTER_STORAGE_KEY, URGENT_MINUTES_LIMIT, isQuickFilter, type HomeLane, type HomeStats, type QuickFilter, type QuickFilterOption } from "@/features/home/components/home-page-types";
import { addDays, buildFeaturedRaces, coerceRaceSummaries, formatDisplayDate, formatRaceCode, getRadarRace, getTopParisItems, normalizeDateParam, normalizeFocusParticipants, sortFeaturedRaces, type FocusDetailResponse, type FocusParticipant, type RaceScore, type RacesResponse, type ScoresResponse, type SortMode } from "@/features/home/lib/home-page-model";
import { fetchRaceDetails, fetchRaceScoresForDate, fetchRacesForDate, normalizeRaceScoresPayload } from "@/features/races/api/client";
import { getTodayDateStr } from "@/lib/date-utils";
import { useLiveStats } from "@/lib/use-live-stats";
import type { RaceSummary } from "@/lib/types";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(normalizeDateParam(searchParams.get("date")));
  const [sortMode, setSortMode] = useState<SortMode>("hour");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [scores, setScores] = useState<RaceScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setIsFocusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchRevision, setFetchRevision] = useState(0);
  const [focusDetail, setFocusDetail] = useState<FocusDetailResponse | null>(null);
  const liveStats = useLiveStats();
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      supabase
        .from("profiles")
        .select("is_subscribed,subscription_status,premium_access_expires_at")
        .eq("id", session.user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (!profile) return;
          const expiry = profile.premium_access_expires_at ? new Date(profile.premium_access_expires_at) : null;
          setIsPro(
            !!profile.is_subscribed ||
            profile.subscription_status === "active" ||
            profile.subscription_status === "trialing" ||
            (expiry !== null && !isNaN(expiry.getTime()) && expiry.getTime() > Date.now())
          );
        });
    });
  }, []);

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
    router.replace(selectedDate === getTodayDateStr() ? "/dashboard" : `/dashboard?date=${selectedDate}`, { scroll: false });
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
  const dayScore = focusRace
    ? Math.max(0, Math.min(100, Math.round(focusRace.scoreValue * 10)))
    : 0;
  const liveSnapshot = liveStats.data;

  return (
    <div className="min-h-screen bg-[var(--pmu-bg)]">
      <header className="sticky top-0 z-40 border-b border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-bg)_92%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[96rem] items-center justify-between gap-4 px-4 py-4">
          <Link href="/dashboard" className="inline-flex items-center gap-3" aria-label="PMU Gagnant">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-[var(--pmu-primary)] font-black text-black">
              PG
            </span>
            <span>
              <span className="block font-[var(--font-display)] text-2xl font-black leading-none text-[var(--pmu-text)]">
                PMU<span className="text-[var(--pmu-primary)]">Gagnant</span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
                Dashboard
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-2 md:flex" aria-label="Navigation connectee">
            <Link href="/mes-paris" className="rounded-lg px-3 py-2 text-sm font-black text-[var(--pmu-text-soft)] hover:bg-[var(--pmu-surface)] hover:text-[var(--pmu-text)]">
              Mon compte
            </Link>
            <Link href="/premium" className="turf-premium-link">
              Passer premium
            </Link>
          </nav>
          <DashboardHeaderAccount />
        </div>
      </header>

      <main className="turf-home-page mx-auto flex w-full max-w-[112rem] flex-col gap-4 px-3 py-4 sm:px-4 lg:gap-5">
        <section className="flex flex-col gap-3 rounded-lg border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_76%,black)] px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="app-kicker">Aujourd&apos;hui</p>
            <h1 className="mt-1 text-2xl font-black text-[var(--pmu-text)]">
              {formatDisplayDate(selectedDate)}
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <span className="col-span-2 rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] px-3 py-2 text-center text-sm font-black text-[var(--pmu-text)] sm:col-span-1">
              Score journee {dayScore || "--"} / 100
            </span>
            <button type="button" className="app-button-secondary min-h-10 px-3 text-sm" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
              Jour precedent
            </button>
            <button type="button" className="app-button-secondary min-h-10 px-3 text-sm" onClick={() => setSelectedDate(getTodayDateStr())}>
              Aujourd&apos;hui
            </button>
            <button type="button" className="app-button-secondary min-h-10 px-3 text-sm" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
              Jour suivant
            </button>
          </div>
        </section>

        <HomeHero
          stats={stats}
          liveStats={liveSnapshot}
          focusRace={focusRace}
          programmeRaces={filteredFeaturedRaces}
          isPro={isPro}
          onOpenPremium={() => router.push("/premium")}
          onOpenFocus={() => (focusRace ? navigateToRace(focusRace.race) : router.push("/premium"))}
          onOpenRace={(item) => navigateToRace(item.race)}
        />

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
              {topParisItems.length > 0 ? (
                <AccordionPanel
                  kicker="Sous-fenetre"
                  title="Top decisions"
                  summary={`${topParisItems.length} tickets`}
                  bodyClassName="px-0 py-0"
                >
                  <TopParisStrip items={topParisItems} />
                </AccordionPanel>
              ) : null}

              <AccordionPanel
                kicker="Sous-fenetre"
                title="Toutes les courses du jour"
                summary={`${filteredFeaturedRaces.length} courses`}
                bodyClassName="px-0 py-0"
              >
                <ProgrammeTable quickFilter={quickFilter} quickFilterOptions={quickFilterOptions} lanes={lanes} playableCount={stats.playable} onQuickFilterChange={setQuickFilter} onOpenRace={navigateToRace} />
              </AccordionPanel>

              <AccordionPanel
                kicker="Sous-fenetre"
                title="Stats ROI, bankroll, validees"
                summary={`${stats.playable}/${stats.total || "--"} validees`}
              >
                <div className="grid gap-3 md:grid-cols-3">
                  <article className="app-card-muted px-4 py-4">
                    <p className="app-label">ROI 30 jours</p>
                    <p className="mt-2 text-3xl font-black text-[var(--pmu-primary)]">
                      {liveSnapshot.roi30d !== null ? `${liveSnapshot.roi30d >= 0 ? "+" : ""}${liveSnapshot.roi30d.toFixed(1)}%` : "--"}
                    </p>
                  </article>
                  <article className="app-card-muted px-4 py-4">
                    <p className="app-label">Bankroll</p>
                    <p className="mt-2 text-3xl font-black text-[var(--pmu-gold)]">
                      {liveSnapshot.netGain7d !== null ? `${liveSnapshot.netGain7d >= 0 ? "+" : ""}${Math.round(liveSnapshot.netGain7d)} EUR` : "--"}
                    </p>
                  </article>
                  <article className="app-card-muted px-4 py-4">
                    <p className="app-label">Validees</p>
                    <p className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
                      {stats.playable}
                    </p>
                  </article>
                </div>
              </AccordionPanel>
            </>
          )}
        </div>
        <DayRadar focusRace={focusRace} focusParticipants={focusParticipants} stats={stats} />
      </div>
      </main>
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
