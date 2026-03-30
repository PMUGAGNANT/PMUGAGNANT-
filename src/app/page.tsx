"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CourseCard } from "@/components/ui/CourseCard";
import { FilterPills } from "@/components/ui/FilterPills";
import { RadarHero } from "@/components/ui/RadarHero";
import { TopParisStrip, type TopParisItem } from "@/components/ui/TopParisStrip";
import {
  formatDateToPmu,
  getMinutesUntilStart,
  getTodayDateStr,
  parsePmuDate,
  toIsoDate,
} from "@/lib/date-utils";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";
import type { Lisibilite, PredictionDecision, RaceSummary } from "@/lib/types";

type ScoreStage = "preview_2h" | "preview_1h" | "final_30m" | "finished";
type SortMode = "hour" | "score" | "urgent" | "allocation";

type RaceScore = {
  dateStr: string;
  reunion: number;
  course: number;
  score: number;
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
  } | null;
};

type RacesResponse = {
  success: boolean;
  date: string;
  races: RaceSummary[];
};

type ScoresResponse = {
  success: boolean;
  scores: RaceScore[];
};

type FeaturedRace = {
  race: RaceSummary;
  score?: RaceScore;
  scoreValue: number;
  minutesUntilStart: number;
  noteLabel: string;
  confidence: number;
  status: "jouable" | "surveillance" | "resultat";
  reason: string;
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

function formatCompactCurrency(value?: number | null) {
  if (!value) {
    return "Allocation n.c.";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
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

function formatMinutesLabel(minutesUntilStart: number) {
  if (minutesUntilStart <= 0) {
    return "Départ proche ou course déjà lancée";
  }

  if (minutesUntilStart < 60) {
    return `Départ dans ${minutesUntilStart} min`;
  }

  const hours = Math.floor(minutesUntilStart / 60);
  const minutes = minutesUntilStart % 60;
  return minutes === 0 ? `Départ dans ${hours} h` : `Départ dans ${hours} h ${minutes}`;
}

function getStageLabel(stage?: ScoreStage) {
  switch (stage) {
    case "preview_2h":
      return "Note 2h";
    case "preview_1h":
      return "Note 1h";
    case "final_30m":
      return "Note 30 min";
    case "finished":
      return "Résultat";
    default:
      return "Analyse";
  }
}

function getStatusFromScore(score?: RaceScore): "jouable" | "surveillance" | "resultat" {
  if (!score) {
    return "surveillance";
  }

  if (score.stage === "finished") {
    return "resultat";
  }

  if (score.playable && score.decision === "VALIDE") {
    return "jouable";
  }

  return "surveillance";
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
  return score?.pick?.betType ? score.pick.betType.replaceAll("_", " ") : "Lecture premium";
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

function buildFeaturedRaces(races: RaceSummary[], scoresMap: Map<string, RaceScore>) {
  return races.map((race) => {
    const key = `${race.reunion}-${race.course}`;
    const score = scoresMap.get(key);
    const scoreValue = score?.score ?? 0;
    const minutesUntilStart = Math.max(0, Math.round(getMinutesUntilStart(race.heureDepart, race.dateStr)));

    return {
      race,
      score,
      scoreValue,
      minutesUntilStart,
      noteLabel: getStageLabel(score?.stage),
      confidence: scoreValue,
      status: getStatusFromScore(score),
      reason: getRaceHint(race, score),
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
  const priorityPlayable = items.find(
    (item) => item.status === "jouable" && item.score?.decision === "VALIDE"
  );

  return priorityPlayable ?? items.find((item) => item.status !== "resultat") ?? items[0] ?? null;
}

function getTopParisItems(items: FeaturedRace[], navigate: (race: RaceSummary) => void): TopParisItem[] {
  return items
    .filter((item) => item.status !== "resultat")
    .sort((a, b) => {
      if (a.status === "jouable" && b.status !== "jouable") {
        return -1;
      }

      if (a.status !== "jouable" && b.status === "jouable") {
        return 1;
      }

      return b.scoreValue - a.scoreValue;
    })
    .slice(0, 3)
    .map((item, index) => ({
      rank: index + 1,
      title: item.race.nomCourse,
      subtitle: `${item.race.hippodrome} • ${item.race.heureDepart}`,
      horse: getPickLabel(item.score),
      stake: formatStake(item.score?.pick?.confidence ? Math.max(6, Math.round(item.score.pick.confidence * 2.5)) : 8),
      betType: getBetTypeLabel(item.score),
      confidence: item.confidence || 5,
      sourceLabel: item.score?.playable ? "Signal validé" : "Lecture auto",
      onClick: () => navigate(item.race),
    }));
}

function PageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = normalizeDateParam(searchParams.get("date"));

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [sortMode, setSortMode] = useState<SortMode>("hour");
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [scores, setScores] = useState<RaceScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedSort = window.localStorage.getItem("pmu-sort-mode");
    if (storedSort === "hour" || storedSort === "score" || storedSort === "urgent" || storedSort === "allocation") {
      setSortMode(storedSort);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("pmu-sort-mode", sortMode);
  }, [sortMode]);

  useEffect(() => {
    setSelectedDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    const currentParam = normalizeDateParam(searchParams.get("date"));
    if (currentParam === selectedDate) {
      return;
    }

    const nextPath = selectedDate === getTodayDateStr() ? "/" : `/?date=${selectedDate}`;
    router.replace(nextPath, { scroll: false });
  }, [router, searchParams, selectedDate]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const racesResponse = await fetch(`/api/races?date=${selectedDate}`, { cache: "no-store" });
        if (!racesResponse.ok) {
          throw new Error("Impossible de charger le programme du jour.");
        }

        const racesJson = (await racesResponse.json()) as RacesResponse;
        if (!racesJson.success) {
          throw new Error("Le service courses a renvoyé une réponse invalide.");
        }

        let authorization = "";
        if (hasSupabaseConfig()) {
          const supabase = getSupabaseBrowserClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          authorization = session?.access_token ? `Bearer ${session.access_token}` : "";
        }

        const scoresResponse = await fetch(`/api/races/scores?date=${selectedDate}`, {
          cache: "no-store",
          headers: authorization ? { Authorization: authorization } : undefined,
        });

        let scoresJson: ScoresResponse = { success: true, scores: [] };
        if (scoresResponse.ok) {
          scoresJson = (await scoresResponse.json()) as ScoresResponse;
        }

        if (!cancelled) {
          setRaces(racesJson.races ?? []);
          setScores(scoresJson.success ? (scoresJson.scores ?? []) : []);
        }
      } catch (loadError) {
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
    };
  }, [selectedDate]);

  const scoresMap = useMemo(() => new Map(scores.map((score) => [`${score.reunion}-${score.course}`, score])), [scores]);

  const featuredRaces = useMemo(() => sortFeaturedRaces(buildFeaturedRaces(races, scoresMap), sortMode), [races, scoresMap, sortMode]);

  const navigateToRace = useCallback(
    (race: RaceSummary) => {
      router.push(`/course/${race.reunion}/${race.course}?date=${selectedDate}`);
    },
    [router, selectedDate]
  );

  const radarRace = useMemo(() => getRadarRace(featuredRaces), [featuredRaces]);
  const topParisItems = useMemo(() => getTopParisItems(featuredRaces, navigateToRace), [featuredRaces, navigateToRace]);

  const summaryStats = useMemo(() => {
    const meetings = new Set(races.map((race) => race.reunion)).size;
    const playable = featuredRaces.filter((item) => item.status === "jouable").length;
    const hot = featuredRaces.filter((item) => item.confidence >= 8).length;
    const closingSoon = featuredRaces.filter((item) => item.status !== "resultat" && item.minutesUntilStart <= 60).length;

    return { meetings, playable, hot, closingSoon };
  }, [featuredRaces, races]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="app-card overflow-hidden p-6 md:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr] xl:items-start">
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="app-kicker">Radar public + premium</p>
              <h1 className="max-w-4xl text-4xl font-black leading-[0.94] tracking-tight text-white md:text-6xl">
                Une console nette pour repérer les bonnes courses, filtrer vite et jouer seulement quand le signal est propre.
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
                La page Courses doit faire un travail simple et dense : montrer le radar du jour, les trois tickets prioritaires,
                puis dérouler le programme sans bruit inutile. Le premium sert ensuite à exécuter avec discipline.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => router.push("/login")} className="app-button-secondary">
                Se connecter
              </button>
              <button type="button" onClick={() => router.push("/premium")} className="app-button-primary">
                Voir l’offre premium
              </button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--pmu-text-soft)]">
              {[
                "Radar du jour",
                "Top 3 exécutables",
                "Value bets filtrées",
                "Mises bankroll",
                "Lecture réservée aux vraies opportunités",
              ].map((label) => (
                <span key={label} className="app-pill text-xs">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {[
              {
                title: "Lecture publique",
                text: "Le radar, les priorités du jour et le tri moteur doivent être lisibles en quelques secondes.",
              },
              {
                title: "Exécution premium",
                text: "On n’ouvre les tickets bankroll et les value bets filtrées que quand il y a une vraie fenêtre de jeu.",
              },
              {
                title: "Après course",
                text: "Le bilan sert à savoir si le moteur aide réellement, pas à raconter une histoire flatteuse.",
              },
            ].map((item) => (
              <div key={item.title} className="app-card-muted px-5 py-4">
                <h2 className="text-lg font-bold text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="app-card p-5">
          <p className="app-label">Date active</p>
          <p className="mt-3 text-2xl font-black capitalize tracking-tight text-white">{formatRelativeDay(selectedDate)}</p>
          <p className="mt-1 text-sm text-[var(--pmu-text-muted)]">{formatDisplayDate(selectedDate)}</p>
        </div>
        <div className="app-card p-5">
          <p className="app-label">Programme</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white">{races.length}</p>
          <p className="mt-1 text-sm text-[var(--pmu-text-muted)]">{summaryStats.meetings} réunions chargées</p>
        </div>
        <div className="app-card p-5">
          <p className="app-label">Courses jouables</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-[var(--pmu-primary)]">{summaryStats.playable}</p>
          <p className="mt-1 text-sm text-[var(--pmu-text-muted)]">signaux validés par le moteur</p>
        </div>
        <div className="app-card p-5">
          <p className="app-label">Départs proches</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white">{summaryStats.closingSoon}</p>
          <p className="mt-1 text-sm text-[var(--pmu-text-muted)]">courses à moins d’une heure</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="app-card p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="app-kicker">Pilotage du jour</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">{formatDisplayDate(selectedDate)}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
                Change de journée sans quitter l’écran principal. Le tri et le radar se recalculent automatiquement.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
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
        </div>

        <div className="app-card p-5 md:p-6">
          <p className="app-kicker">Date rapide</p>
          <label className="mt-3 block">
            <span className="sr-only">Choisir une date</span>
            <input
              type="date"
              className="app-input"
              value={toIsoDate(selectedDate)}
              onChange={(event) => setSelectedDate(normalizeDateParam(event.target.value.replaceAll("-", "")))}
            />
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="app-card-muted px-4 py-3">
              <p className="app-label">Pistes chaudes</p>
              <p className="mt-2 text-xl font-black text-white">{summaryStats.hot}</p>
            </div>
            <div className="app-card-muted px-4 py-3">
              <p className="app-label">Tri actif</p>
              <p className="mt-2 text-xl font-black text-white">
                {SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? "Par heure"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {radarRace ? (
        <RadarHero
          title={`R${radarRace.race.reunion}C${radarRace.race.course} - ${radarRace.race.nomCourse}`}
          hippodrome={radarRace.race.hippodrome}
          raceMeta={formatRaceMeta(radarRace.race)}
          confidence={radarRace.confidence || 5}
          summary={radarRace.reason}
          ctaLabel="Voir le ticket complet"
          onClick={() => navigateToRace(radarRace.race)}
        />
      ) : null}

      {topParisItems.length ? <TopParisStrip items={topParisItems} /> : null}

      <section className="app-card p-5 md:p-6">
        <div className="app-section-heading">
          <div>
            <p className="app-kicker">Programme trié</p>
            <h2 className="app-section-title">Courses à suivre</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-[var(--pmu-text-soft)]">
            Un affichage plus sobre, plus dense et mieux hiérarchisé. Chaque carte doit pouvoir être lue rapidement sans transformer la page en mur de blocs.
          </p>
        </div>
        <FilterPills options={SORT_OPTIONS} value={sortMode} onChange={setSortMode} />
      </section>

      {error ? (
        <section className="app-card border-[rgba(255,92,92,0.26)] p-6">
          <p className="text-lg font-bold text-[var(--pmu-red)]">Impossible de charger la page Courses</p>
          <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{error}</p>
        </section>
      ) : null}

      {isLoading ? (
        <section className="grid gap-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="app-card h-52 animate-pulse bg-[linear-gradient(180deg,#131313_0%,#0f0f0f_100%)]" />
          ))}
        </section>
      ) : null}

      {!isLoading && !error && featuredRaces.length ? (
        <section className="grid gap-5 2xl:grid-cols-2">
          {featuredRaces.map((item) => (
            <CourseCard
              key={`${item.race.reunion}-${item.race.course}`}
              timeLabel={item.race.heureDepart}
              hippodrome={item.race.hippodrome}
              raceTitle={`R${item.race.reunion}C${item.race.course} - ${item.race.nomCourse}`}
              raceMeta={formatCourseMeta(item.race)}
              horseLabel={getPickLabel(item.score)}
              betTypeLabel={getBetTypeLabel(item.score)}
              confidence={item.confidence || 5}
              status={item.status}
              noteLabel={item.noteLabel}
              allocationLabel={formatCompactCurrency(item.race.allocation)}
              summary={`${item.reason} ${formatMinutesLabel(item.minutesUntilStart)}.`}
              onClick={() => navigateToRace(item.race)}
            />
          ))}
        </section>
      ) : null}

      {!isLoading && !error && !featuredRaces.length ? (
        <section className="app-card p-8 text-center">
          <p className="text-xl font-bold text-white">Aucune course exploitable pour cette date</p>
          <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
            Change de journée ou recharge la page. Le moteur n’a pas encore remonté de programme utilisable.
          </p>
        </section>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <PageContent />
    </Suspense>
  );
}
