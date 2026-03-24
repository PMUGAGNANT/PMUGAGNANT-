"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  formatDateToPmu,
  fromIsoDate,
  getMinutesUntilStart,
  getTodayDateStr,
  parsePmuDate,
  toIsoDate,
} from "@/lib/date-utils";
import type { Lisibilite, PredictionDecision, RaceSummary } from "@/lib/types";

type ScoreStage = "preview_2h" | "preview_1h" | "final_30m" | "finished";

type RaceScore = {
  score: number;
  stage: ScoreStage;
  lisibilite: Lisibilite;
  decision: PredictionDecision;
  playable: boolean;
  recommendation: string | null;
  pick:
    | {
        numPmu: number;
        nom: string;
        decision: PredictionDecision;
        betType: "GAGNANT" | "PLACE";
        confidence: number;
      }
    | null;
};

type RacesResponse = {
  success: boolean;
  date: string;
  races: RaceSummary[];
};

type ScoresResponse = {
  success: boolean;
  scores: Record<string, RaceScore>;
};

type SortMode = "hour" | "score" | "urgent" | "allocation";

type FeaturedRace = {
  race: RaceSummary;
  score: number | null;
  stage: ScoreStage | null;
  rank: 1 | 2 | 3;
  reason: string;
  source: "score" | "fallback";
};

type DailyBet = {
  rank: 1 | 2 | 3;
  race: RaceSummary;
  raceScore: RaceScore;
};

function formatCurrency(value: number | null | undefined) {
  if (!value) return "Allocation -";
  return `${new Intl.NumberFormat("fr-FR").format(value)} EUR`;
}

function formatDisplayDate(dateStr: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parsePmuDate(dateStr));
}

function formatRelativeDay(dateStr: string) {
  const today = parsePmuDate(getTodayDateStr());
  const target = parsePmuDate(dateStr);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diff === 0) return "Aujourd'hui";
  if (diff === -1) return "Hier";
  if (diff === 1) return "Demain";
  return "Selection";
}

function addDays(dateStr: string, delta: number) {
  const next = parsePmuDate(dateStr);
  next.setDate(next.getDate() + delta);
  return formatDateToPmu(next);
}

function formatDiscipline(race: RaceSummary) {
  if (race.estPlat) return "Plat";
  if (race.estTrot && race.discipline.includes("MONTE")) return "Monte";
  if (race.estTrot) return "Attele";
  if (race.discipline.includes("OBSTACLE") || race.discipline.includes("HAIES") || race.discipline.includes("STEEPLE")) {
    return "Obstacle";
  }
  return race.discipline.replaceAll("_", " ");
}

function getStageLabel(stage: ScoreStage | null) {
  if (stage === "preview_2h") return "Note 2h";
  if (stage === "preview_1h") return "Note 1h";
  if (stage === "final_30m") return "Note 30 min";
  if (stage === "finished") return "Course finie";
  return "En attente";
}

function getStageClasses(stage: ScoreStage | null) {
  if (stage === "preview_2h") return "bg-[#EEF5FF] text-[#2563EB]";
  if (stage === "preview_1h") return "bg-[#E7F8EE] text-[#0b8f4d]";
  if (stage === "final_30m") return "bg-[#FFF4D8] text-[#A66B00]";
  if (stage === "finished") return "bg-gray-100 text-slate-500";
  return "bg-gray-100 text-slate-500";
}

function getScoreClasses(score: number | null) {
  if (score === null) return "bg-gray-100 text-slate-500";
  if (score >= 7.5) return "bg-[#E7F8EE] text-[#0b8f4d]";
  if (score >= 6) return "bg-[#FFF4D8] text-[#A66B00]";
  return "bg-[#FDECEA] text-[#D64545]";
}

function getDecisionBadge(decision: PredictionDecision | null | undefined) {
  if (decision === "VALIDE") {
    return {
      label: "Jouable",
      classes: "bg-[#E7F8EE] text-[#0b8f4d]",
    };
  }

  if (decision === "SURVEILLANCE") {
    return {
      label: "Sous surveillance",
      classes: "bg-[#FFF4D8] text-[#A66B00]",
    };
  }

  return {
    label: "A eviter",
    classes: "bg-[#FDECEA] text-[#D64545]",
  };
}

function getRaceHint(race: RaceSummary, score: number | null, stage: ScoreStage | null, minutesUntilStart: number) {
  if (stage === "finished") {
    return "La course est terminee. Ouvre le detail pour voir le ticket et le resultat final.";
  }
  if (score === null) {
    if (minutesUntilStart > 120) {
      return "Le moteur ouvrira l'analyse a partir de 2 heures avant le depart.";
    }
    return "La course est dans la fenetre d'analyse, le moteur termine sa lecture.";
  }
  if (score >= 7.5) {
    return "Base lisible avec un ticket principal qui ressort proprement.";
  }
  if (score >= 6) {
    return "Course jouable, mais elle demande plus de selection et de prudence.";
  }
  return "Lecture prudente. La course reste ouverte ou nerveuse.";
}

function getCardAccent(score: number | null, stage: ScoreStage | null) {
  if (stage === "finished") return "border-l-slate-300";
  if (score === null) return "border-l-[#D7DEE7]";
  if (score >= 7.5) return "border-l-[#0b8f4d]";
  if (score >= 6) return "border-l-[#D4A017]";
  return "border-l-[#D64545]";
}

function getFeaturedReason(
  race: RaceSummary,
  score: number | null,
  stage: ScoreStage | null,
  minutesUntilStart: number,
  source: "score" | "fallback",
  raceScore?: RaceScore | null
) {
  if (source === "score" && score !== null) {
    if (raceScore?.recommendation === "PARI OFFENSIF") {
      return "Course vraiment jouable: le moteur valide un signal offensif propre.";
    }
    if (raceScore?.recommendation === "BASE PLACE") {
      return "Course jouable avec une base place solide et plus saine que speculative.";
    }
    if (raceScore?.recommendation === "SURVEILLANCE ACTIVE") {
      return "Course encore jouable, mais a suivre avec davantage de discipline avant le depart.";
    }
    if (score >= 7.5) {
      return "Lecture tres propre du moteur, base prioritaire du jour.";
    }
    if (score >= 6) {
      return "Course interessante avec un profil jouable et encore lisible.";
    }
    return "Course suivie par le moteur, mais a jouer avec plus de prudence.";
  }

  if (race.estQuinte && race.allocation >= 40000) {
    return "Selection premium avec gros enjeu et profondeur de marche.";
  }

  if (minutesUntilStart >= 0 && minutesUntilStart <= 120) {
    return "Course proche du depart, ideale pour entrer vite dans la lecture du jour.";
  }

  if (race.allocation >= 30000) {
    return "Allocation elevee et profil de course a surveiller en priorite.";
  }

  if (stage === "finished") {
    return "Course deja terminee, conservee ici pour rester dans le top du jour.";
  }

  return "La note IA arrive plus tard, mais cette course ressort deja dans la priorite du jour.";
}

/* ─── Skeleton placeholders ─── */

function SkeletonCard() {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-[0_18px_36px_rgba(15,23,42,0.08)] grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="skeleton h-5 w-16 mb-2" />
          <div className="skeleton h-5 w-24" />
        </div>
        <div className="skeleton h-5 w-20" />
      </div>
      <div>
        <div className="skeleton h-5 w-48 mb-2" />
        <div className="skeleton h-4 w-36" />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="skeleton h-7 w-28 rounded-full" />
        <div className="skeleton h-7 w-24 rounded-full" />
        <div className="skeleton h-7 w-28 rounded-full" />
      </div>
      <div className="skeleton h-4 w-full" />
    </div>
  );
}

function SkeletonRadar() {
  return (
    <div className="bg-gradient-to-br from-[#132126] to-[#1b252b] rounded-3xl p-5 shadow-[0_24px_46px_rgba(15,23,42,0.22)]">
      <div className="skeleton h-4 w-24 mb-3 !bg-[#2a3a42]" />
      <div className="skeleton h-5 w-56 mb-2 !bg-[#2a3a42]" />
      <div className="skeleton h-4 w-44 mb-4 !bg-[#2a3a42]" />
      <div className="flex gap-2">
        <div className="skeleton h-7 w-28 rounded-full !bg-[#2a3a42]" />
        <div className="skeleton h-7 w-24 rounded-full !bg-[#2a3a42]" />
      </div>
    </div>
  );
}

/* ─── DateNavigator ─── */

function DateNavigator({
  dateStr,
  onChange,
}: {
  dateStr: string;
  onChange: (nextDate: string) => void;
}) {
  return (
    <div className="grid grid-cols-[44px_1fr_44px] gap-2.5 items-center mb-4">
      <button
        onClick={() => onChange(addDays(dateStr, -1))}
        className="h-11 rounded-2xl border border-[rgba(15,23,42,0.08)] bg-white text-[#171b1f] text-lg font-extrabold cursor-pointer hover:bg-gray-50 active:scale-95 transition-all"
      >
        {"<"}
      </button>

      <div className="bg-white rounded-[20px] border border-[rgba(15,23,42,0.06)] shadow-[0_16px_32px_rgba(15,23,42,0.06)] p-3 grid gap-2">
        <div className="flex items-center justify-between gap-2.5">
          <div>
            <div className="text-xs font-extrabold text-[#7A8A9A] uppercase tracking-wide">
              {formatRelativeDay(dateStr)}
            </div>
            <div className="text-base font-extrabold text-[#171b1f]">{formatDisplayDate(dateStr)}</div>
          </div>
          <button
            onClick={() => onChange(getTodayDateStr())}
            className="border-none rounded-full bg-[#E7F8EE] text-[#0b8f4d] px-3 py-2 text-xs font-extrabold cursor-pointer hover:bg-[#d4f0de] active:scale-95 transition-all"
          >
            Aujourd&apos;hui
          </button>
        </div>
        <input
          type="date"
          value={toIsoDate(dateStr)}
          onChange={(event) => onChange(fromIsoDate(event.target.value))}
          className="w-full rounded-[14px] border border-[rgba(15,23,42,0.08)] px-3 py-2.5 text-sm font-bold text-[#171b1f] focus:outline-none focus:ring-2 focus:ring-[#0b8f4d]/30 transition-shadow"
        />
      </div>

      <button
        onClick={() => onChange(addDays(dateStr, 1))}
        className="h-11 rounded-2xl border border-[rgba(15,23,42,0.08)] bg-white text-[#171b1f] text-lg font-extrabold cursor-pointer hover:bg-gray-50 active:scale-95 transition-all"
      >
        {">"}
      </button>
    </div>
  );
}

/* ─── HomePageContent ─── */

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlDate = searchParams.get("date") || getTodayDateStr();
  const [selectedDate, setSelectedDate] = useState(urlDate);
  const [sortMode, setSortMode] = useState<SortMode>("hour");
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [scores, setScores] = useState<Record<string, RaceScore>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");

  useEffect(() => {
    setSelectedDate(urlDate);
  }, [urlDate]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("pmu-sort-mode");
      if (
        stored === "hour" ||
        stored === "score" ||
        stored === "urgent" ||
        stored === "allocation"
      ) {
        setSortMode(stored);
      }
    } catch {
      // Ignore storage errors on locked browsers.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("pmu-sort-mode", sortMode);
    } catch {
      // Ignore storage errors on locked browsers.
    }
  }, [sortMode]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [racesResponse, scoresResponse] = await Promise.all([
          fetch(`/api/races?date=${selectedDate}`, { cache: "no-store" }),
          fetch(`/api/races/scores?date=${selectedDate}`, { cache: "no-store" }),
        ]);

        const racesPayload = (await racesResponse.json()) as RacesResponse;
        const scoresPayload = (await scoresResponse.json()) as ScoresResponse;

        if (!racesResponse.ok || !racesPayload.success) {
          throw new Error(racesPayload.success ? "Chargement impossible" : "Courses indisponibles");
        }

        if (!cancelled) {
          setRaces(racesPayload.races);
          setScores(scoresPayload.success ? scoresPayload.scores : {});
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Chargement impossible");
          setRaces([]);
          setScores({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const sortedRaces = useMemo(() => {
    const copy = [...races];

    copy.sort((left, right) => {
      const leftKey = `${left.reunion}-${left.course}`;
      const rightKey = `${right.reunion}-${right.course}`;
      const leftScore = scores[leftKey]?.score ?? -1;
      const rightScore = scores[rightKey]?.score ?? -1;
      const leftMinutes = getMinutesUntilStart(left.heureDepart, left.dateStr);
      const rightMinutes = getMinutesUntilStart(right.heureDepart, right.dateStr);

      if (sortMode === "score") {
        if (rightScore !== leftScore) return rightScore - leftScore;
        return leftMinutes - rightMinutes;
      }

      if (sortMode === "urgent") {
        return leftMinutes - rightMinutes;
      }

      if (sortMode === "allocation") {
        if (right.allocation !== left.allocation) return right.allocation - left.allocation;
        return leftMinutes - rightMinutes;
      }

      return leftMinutes - rightMinutes;
    });

    return copy;
  }, [races, scores, sortMode]);

  const radarRace = useMemo(() => {
    const active = sortedRaces.filter((race) => {
      const key = `${race.reunion}-${race.course}`;
      return scores[key]?.score !== undefined && scores[key]?.stage !== "finished";
    });

    if (active.length > 0) {
      return [...active].sort((left, right) => {
        const leftScore = scores[`${left.reunion}-${left.course}`]?.score ?? 0;
        const rightScore = scores[`${right.reunion}-${right.course}`]?.score ?? 0;
        if (rightScore !== leftScore) return rightScore - leftScore;
        return getMinutesUntilStart(left.heureDepart, left.dateStr) - getMinutesUntilStart(right.heureDepart, right.dateStr);
      })[0];
    }

    return sortedRaces[0] ?? null;
  }, [scores, sortedRaces]);

  const scoredCount = useMemo(
    () => Object.values(scores).filter((entry) => entry.stage !== "finished").length,
    [scores]
  );

  const featuredRaces = useMemo<FeaturedRace[]>(() => {
    const scoredCandidates = races
      .map((race) => {
        const key = `${race.reunion}-${race.course}`;
        const raceScore = scores[key];
        return {
          race,
          score: raceScore?.score ?? null,
          stage: raceScore?.stage ?? null,
          minutesUntilStart: getMinutesUntilStart(race.heureDepart, race.dateStr),
        };
      })
      .filter(
        (entry) =>
          entry.score !== null &&
          entry.stage !== "finished" &&
          Boolean(scores[`${entry.race.reunion}-${entry.race.course}`]?.playable)
      )
      .sort((left, right) => {
        const leftRaceScore = scores[`${left.race.reunion}-${left.race.course}`];
        const rightRaceScore = scores[`${right.race.reunion}-${right.race.course}`];
        const leftDecisionWeight =
          leftRaceScore?.decision === "VALIDE"
            ? 2
            : leftRaceScore?.decision === "SURVEILLANCE"
              ? 1
              : 0;
        const rightDecisionWeight =
          rightRaceScore?.decision === "VALIDE"
            ? 2
            : rightRaceScore?.decision === "SURVEILLANCE"
              ? 1
              : 0;

        if (rightDecisionWeight !== leftDecisionWeight) {
          return rightDecisionWeight - leftDecisionWeight;
        }
        if ((right.score ?? 0) !== (left.score ?? 0)) {
          return (right.score ?? 0) - (left.score ?? 0);
        }
        return left.minutesUntilStart - right.minutesUntilStart;
      })
      .slice(0, 3)
      .map((entry, index) => ({
        race: entry.race,
        score: entry.score,
        stage: entry.stage,
        rank: (index + 1) as 1 | 2 | 3,
        reason: getFeaturedReason(
          entry.race,
          entry.score,
          entry.stage,
          entry.minutesUntilStart,
          "score",
          scores[`${entry.race.reunion}-${entry.race.course}`]
        ),
        source: "score" as const,
      }));

    if (scoredCandidates.length === 3) {
      return scoredCandidates;
    }

    const usedKeys = new Set(
      scoredCandidates.map((entry) => `${entry.race.reunion}-${entry.race.course}`)
    );

    const fallbackCandidates = races
      .filter((race) => !usedKeys.has(`${race.reunion}-${race.course}`))
      .map((race) => {
        const key = `${race.reunion}-${race.course}`;
        const raceScore = scores[key];
        const minutesUntilStart = getMinutesUntilStart(race.heureDepart, race.dateStr);
        const urgencyBonus =
          minutesUntilStart >= 0 && minutesUntilStart <= 180
            ? 10
            : minutesUntilStart > 180
              ? 4
              : 0;
        const quinteBonus = race.estQuinte ? 16 : 0;
        const allocationBonus = Math.min((race.allocation ?? 0) / 4000, 12);
        const fieldBonus =
          race.nombrePartants >= 12 && race.nombrePartants <= 16 ? 5 : 2;

        return {
          race,
          score: raceScore?.score ?? null,
          stage: raceScore?.stage ?? null,
          minutesUntilStart,
          fallbackScore: urgencyBonus + quinteBonus + allocationBonus + fieldBonus,
        };
      })
      .sort((left, right) => {
        if (right.fallbackScore !== left.fallbackScore) {
          return right.fallbackScore - left.fallbackScore;
        }
        return left.minutesUntilStart - right.minutesUntilStart;
      })
      .slice(0, 3 - scoredCandidates.length)
      .map((entry, index) => ({
        race: entry.race,
        score: entry.score,
        stage: entry.stage,
        rank: (scoredCandidates.length + index + 1) as 1 | 2 | 3,
        reason: getFeaturedReason(
          entry.race,
          entry.score,
          entry.stage,
          entry.minutesUntilStart,
          "fallback",
          scores[`${entry.race.reunion}-${entry.race.course}`]
        ),
        source: "fallback" as const,
      }));

    return [...scoredCandidates, ...fallbackCandidates];
  }, [races, scores]);

  const dailyBets = useMemo<DailyBet[]>(() => {
    return featuredRaces
      .map((entry) => {
        const raceScore = scores[`${entry.race.reunion}-${entry.race.course}`];
        if (!raceScore?.pick || !raceScore.playable) {
          return null;
        }

        return {
          rank: entry.rank,
          race: entry.race,
          raceScore,
        } satisfies DailyBet;
      })
      .filter((entry): entry is DailyBet => entry !== null);
  }, [featuredRaces, scores]);

  const dailyBetsText = useMemo(() => {
    if (dailyBets.length === 0) {
      return "";
    }

    const lines = [
      `Mes 3 paris du jour - ${formatDisplayDate(selectedDate)}`,
      "",
      ...dailyBets.map(({ rank, race, raceScore }) => {
        const pick = raceScore.pick;
        if (!pick) {
          return `${rank}. R${race.reunion}C${race.course} ${race.heureDepart} - selection indisponible`;
        }

        const betLabel = pick.betType === "GAGNANT" ? "Simple gagnant" : "Simple place";
        return `${rank}. R${race.reunion}C${race.course} ${race.heureDepart} - ${pick.numPmu} ${pick.nom} - ${betLabel} - confiance ${pick.confidence}/10`;
      }),
    ];

    return lines.join("\n");
  }, [dailyBets, selectedDate]);

  function updateDate(nextDate: string) {
    setSelectedDate(nextDate);
    router.replace(`/?date=${nextDate}`, { scroll: false });
  }

  function openRace(race: RaceSummary) {
    router.push(`/course/${race.reunion}/${race.course}?date=${selectedDate}`);
  }

  async function copyDailyBets() {
    if (!dailyBetsText) {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(dailyBetsText);
      setCopyState("done");
    } catch {
      setCopyState("error");
    }

    window.setTimeout(() => {
      setCopyState("idle");
    }, 2200);
  }

  return (
    <div
      className="w-full max-w-md sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto min-h-screen pb-24"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(11,143,77,0.14), transparent 26%), radial-gradient(circle at top right, rgba(19,35,28,0.16), transparent 22%), linear-gradient(180deg, #f7faf9 0%, #eef3f4 100%)",
      }}
    >
      {/* ─── Sticky header ─── */}
      <div className="sticky top-0 z-30 bg-[rgba(23,27,31,0.92)] backdrop-blur-xl text-white border-b border-white/[0.06] h-[76px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-black tracking-tight">PMU AI</div>
          <div className="text-xs font-bold text-white/[0.68] tracking-widest">
            PRONOSTICS IA
          </div>
        </div>
      </div>

      {/* ─── Main content area ─── */}
      <div className="p-4 md:p-6 grid gap-4">
        <DateNavigator dateStr={selectedDate} onChange={updateDate} />

        {/* ─── Hero summary card ─── */}
        <div className="bg-gradient-to-br from-[#0b8f4d] to-[#09723d] text-white rounded-3xl p-6 shadow-[0_24px_46px_rgba(9,114,61,0.26)] relative overflow-hidden">
          {/* Decorative circle */}
          <div className="absolute -top-5 -right-6 w-[150px] h-[150px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18)_0%,transparent_72%)]" />
          <div className="relative">
            <div className="text-[13px] font-extrabold text-white/[0.86] mb-2">
              {formatRelativeDay(selectedDate)}
            </div>
            <div className="text-lg font-extrabold mb-2.5">
              {formatDisplayDate(selectedDate)}
            </div>
            <div className="text-2xl font-black leading-tight mb-1.5">
              {races.length} courses · {new Set(races.map((race) => race.reunion)).size} reunions
            </div>
            <div className="text-sm text-white/[0.82] mb-4">
              {scoredCount} course{scoredCount > 1 ? "s" : ""} deja notee{scoredCount > 1 ? "s" : ""} par le moteur
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.12] rounded-[18px] p-3.5">
                <div className="text-xs text-white/70 mb-1.5 uppercase font-extrabold">
                  Radar actif
                </div>
                <div className="text-base font-black">{scoredCount} courses notees</div>
              </div>
              <div className="bg-white/[0.12] rounded-[18px] p-3.5">
                <div className="text-xs text-white/70 mb-1.5 uppercase font-extrabold">
                  Tri moteur
                </div>
                <div className="text-base font-black">
                  {sortMode === "hour"
                    ? "Par heure"
                    : sortMode === "score"
                      ? "Meilleure note"
                      : sortMode === "urgent"
                        ? "A suivre vite"
                        : "Gros enjeux"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Radar du jour ─── */}
        {loading && !radarRace ? (
          <SkeletonRadar />
        ) : radarRace ? (() => {
          const key = `${radarRace.reunion}-${radarRace.course}`;
          const raceScore = scores[key];
          const minutesUntilStart = getMinutesUntilStart(radarRace.heureDepart, radarRace.dateStr);
          const scoreValue = raceScore?.score ?? null;
          const scoreClasses = getScoreClasses(scoreValue);
          const stageClasses = getStageClasses(raceScore?.stage ?? null);

          return (
            <button
              onClick={() => openRace(radarRace)}
              className="border-none cursor-pointer text-left bg-gradient-to-br from-[#132126] to-[#1b252b] text-white rounded-3xl p-5 shadow-[0_24px_46px_rgba(15,23,42,0.22)] hover:shadow-[0_28px_52px_rgba(15,23,42,0.30)] active:scale-[0.98] transition-all duration-200"
            >
              <div className="text-xs font-extrabold text-[#6CE4A0] uppercase tracking-wider mb-2.5">
                Radar du jour
              </div>
              <div className="text-lg font-black leading-tight mb-2">
                R{radarRace.reunion}C{radarRace.course} - {radarRace.nomCourse}
              </div>
              <div className="text-white/[0.74] text-sm mb-3.5">
                {radarRace.hippodrome} · {radarRace.heureDepart} · {radarRace.nombrePartants} partants · {radarRace.distance} m
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {scoreValue !== null ? (
                  <span className={`${scoreClasses} rounded-full px-3 py-2 text-[13px] font-extrabold`}>
                    Confiance {scoreValue}/10
                  </span>
                ) : null}
                <span className={`${stageClasses} rounded-full px-3 py-2 text-[13px] font-extrabold`}>
                  {getStageLabel(raceScore?.stage ?? null)}
                </span>
              </div>
              <div className="text-white/[0.82] text-sm leading-relaxed">
                {getRaceHint(radarRace, scoreValue, raceScore?.stage ?? null, minutesUntilStart)}
              </div>
            </button>
          );
        })() : null}

        {/* ─── Sort controls ─── */}
        {!loading && !error && featuredRaces.length > 0 ? (
          <section className="grid gap-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-lg font-black text-[#171b1f] mb-1">Top 3 du jour</div>
                <div className="text-sm text-[#738395]">
                  Selection priorisee par la note IA, puis completee intelligemment si le moteur n&apos;a pas encore tout note.
                </div>
              </div>
              <div className="rounded-full bg-[#171b1f] text-white px-3 py-2 text-xs font-extrabold">
                {featuredRaces.length} priorites
              </div>
            </div>

            <div className="grid gap-3">
              {featuredRaces.map((entry) => {
                const key = `${entry.race.reunion}-${entry.race.course}`;
                const raceScore = scores[key];
                const scoreValue = entry.score ?? raceScore?.score ?? null;
                const stageValue = entry.stage ?? raceScore?.stage ?? null;
                const decisionBadge = getDecisionBadge(raceScore?.decision);
                const featuredPick = raceScore?.pick ?? null;
                const minutesUntilStart = getMinutesUntilStart(
                  entry.race.heureDepart,
                  entry.race.dateStr
                );

                return (
                  <button
                    key={`featured-${entry.race.reunion}-${entry.race.course}`}
                    onClick={() => openRace(entry.race)}
                    className="border-none cursor-pointer text-left rounded-[28px] bg-white p-5 shadow-[0_18px_36px_rgba(15,23,42,0.08)] hover:shadow-[0_22px_44px_rgba(15,23,42,0.14)] active:scale-[0.99] transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#171b1f] text-white text-base font-black">
                          {entry.rank}
                        </div>
                        <div>
                          <div className="text-[17px] font-black text-[#171b1f] leading-tight">
                            R{entry.race.reunion}C{entry.race.course} - {entry.race.nomCourse}
                          </div>
                          <div className="text-sm text-slate-500">
                            {entry.race.hippodrome} · {entry.race.heureDepart} · {entry.race.nombrePartants} partants
                          </div>
                        </div>
                      </div>
                      <span className="rounded-full bg-[#EEF7EF] px-3 py-2 text-xs font-extrabold text-[#0b8f4d]">
                        {entry.source === "score" ? "Note IA" : "Selection auto"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className={`${decisionBadge.classes} rounded-full px-2.5 py-[7px] text-xs font-extrabold`}>
                        {decisionBadge.label}
                      </span>
                      {scoreValue !== null ? (
                        <span className={`${getScoreClasses(scoreValue)} rounded-full px-2.5 py-[7px] text-xs font-extrabold`}>
                          Confiance {scoreValue}/10
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-slate-500 rounded-full px-2.5 py-[7px] text-xs font-extrabold">
                          Note en attente
                        </span>
                      )}
                      <span className={`${getStageClasses(stageValue)} rounded-full px-2.5 py-[7px] text-xs font-extrabold`}>
                        {getStageLabel(stageValue)}
                      </span>
                      <span className="bg-gray-100 text-slate-600 rounded-full px-2.5 py-[7px] text-xs font-extrabold">
                        {formatCurrency(entry.race.allocation)}
                      </span>
                      <span className="bg-[#FFF4D8] text-[#A66B00] rounded-full px-2.5 py-[7px] text-xs font-extrabold">
                        {minutesUntilStart >= 60
                          ? `Dans ${Math.round(minutesUntilStart / 60)}h`
                          : minutesUntilStart >= 0
                            ? `Dans ${Math.round(minutesUntilStart)} min`
                            : stageValue === "finished"
                              ? "Terminee"
                              : "En cours"}
                      </span>
                    </div>

                    <div className="text-sm leading-relaxed text-[#5B6472]">
                      {entry.reason}
                    </div>

                    {featuredPick ? (
                      <div className="mt-3 rounded-2xl bg-[#F6F8F9] px-4 py-3">
                        <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#7A8A9A] mb-1">
                          Pari du jour
                        </div>
                        <div className="text-sm font-black text-[#171b1f]">
                          {featuredPick.numPmu} - {featuredPick.nom}
                        </div>
                        <div className="text-sm text-[#5B6472]">
                          {featuredPick.betType === "GAGNANT" ? "Simple gagnant" : "Simple place"} · confiance {featuredPick.confidence}/10
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 flex justify-end">
                      <span className="inline-flex items-center rounded-full bg-[#171b1f] px-4 py-2 text-xs font-extrabold text-white">
                        Voir le ticket
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {!loading && !error && dailyBets.length > 0 ? (
          <section className="grid gap-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-lg font-black text-[#171b1f] mb-1">Mes 3 paris du jour</div>
                <div className="text-sm text-[#738395]">
                  Vue express pour jouer vite: course, cheval, type de pari et confiance.
                </div>
              </div>
              <button
                onClick={copyDailyBets}
                className={`
                  border-none rounded-full px-4 py-2 text-xs font-extrabold cursor-pointer transition-all duration-200
                  ${
                    copyState === "done"
                      ? "bg-[#E7F8EE] text-[#0b8f4d]"
                      : copyState === "error"
                        ? "bg-[#FDECEA] text-[#D64545]"
                        : "bg-[#171b1f] text-white hover:bg-[#242a30]"
                  }
                `}
              >
                {copyState === "done"
                  ? "Copie"
                  : copyState === "error"
                    ? "Impossible"
                    : "Copier mes 3 paris"}
              </button>
            </div>

            <div className="grid gap-3">
              {dailyBets.map(({ rank, race, raceScore }) => (
                <button
                  key={`daily-bet-${race.reunion}-${race.course}`}
                  onClick={() => openRace(race)}
                  className="border-none cursor-pointer text-left rounded-[24px] bg-[#171b1f] text-white p-5 shadow-[0_20px_40px_rgba(15,23,42,0.18)] hover:shadow-[0_24px_48px_rgba(15,23,42,0.24)] active:scale-[0.99] transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#171b1f] text-sm font-black">
                        {rank}
                      </div>
                      <div>
                        <div className="text-base font-black">
                          R{race.reunion}C{race.course} - {race.heureDepart}
                        </div>
                        <div className="text-sm text-white/70">
                          {race.hippodrome} · {race.nomCourse}
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#6CE4A0] px-3 py-2 text-[11px] font-extrabold text-[#0c2517]">
                      {raceScore.pick?.betType === "GAGNANT" ? "Simple gagnant" : "Simple place"}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-white/10 px-4 py-3 mb-3">
                    <div className="text-[11px] font-extrabold uppercase tracking-wide text-white/60 mb-1">
                      Cheval a jouer
                    </div>
                    <div className="text-lg font-black">
                      {raceScore.pick?.numPmu} - {raceScore.pick?.nom}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-extrabold text-white">
                      Confiance {raceScore.pick?.confidence}/10
                    </span>
                    <span className={`${getDecisionBadge(raceScore.decision).classes} rounded-full px-3 py-2 text-xs font-extrabold`}>
                      {getDecisionBadge(raceScore.decision).label}
                    </span>
                    <span className={`${getStageClasses(raceScore.stage)} rounded-full px-3 py-2 text-xs font-extrabold`}>
                      {getStageLabel(raceScore.stage)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-2.5">
          <div className="flex flex-wrap gap-2">
            {([
              { key: "hour", label: "Par heure" },
              { key: "score", label: "Meilleure note" },
              { key: "urgent", label: "A suivre vite" },
              { key: "allocation", label: "Gros enjeux" },
            ] satisfies Array<{ key: SortMode; label: string }>).map((option) => (
              <button
                key={option.key}
                onClick={() => setSortMode(option.key)}
                className={`
                  rounded-full px-3.5 py-2.5 text-[13px] font-extrabold cursor-pointer
                  transition-all duration-200 active:scale-95
                  ${
                    option.key === sortMode
                      ? "border-none bg-[#171b1f] text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)]"
                      : "border border-[rgba(15,23,42,0.08)] bg-white text-slate-600 hover:bg-gray-50 hover:border-[rgba(15,23,42,0.14)]"
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div>
            <div className="text-lg font-black text-[#171b1f] mb-1.5">Courses a suivre</div>
            <div className="text-[#738395] text-sm">
              Tri intelligent par heure, confiance, urgence et niveau d&apos;enjeu.
            </div>
          </div>
        </div>

        {/* ─── Loading skeleton ─── */}
        {loading ? (
          <div className="grid gap-3.5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : null}

        {/* ─── Error state ─── */}
        {error ? (
          <div className="text-[#D64545] bg-white rounded-3xl p-5">{error}</div>
        ) : null}

        {/* ─── Race cards ─── */}
        {!loading && !error ? (
          <div className="grid gap-3.5 transition-all duration-300">
            {sortedRaces.map((race) => {
              const key = `${race.reunion}-${race.course}`;
              const raceScore = scores[key];
              const minutesUntilStart = getMinutesUntilStart(race.heureDepart, race.dateStr);
              const accentClass = getCardAccent(raceScore?.score ?? null, raceScore?.stage ?? null);
              const scoreClasses = getScoreClasses(raceScore?.score ?? null);
              const stageClasses = getStageClasses(raceScore?.stage ?? null);

              return (
                <button
                  key={`${race.reunion}-${race.course}-${race.dateStr}`}
                  onClick={() => openRace(race)}
                  className={`
                    border-none cursor-pointer text-left bg-white rounded-[26px] p-5
                    shadow-[0_18px_36px_rgba(15,23,42,0.08)] border-l-[5px] ${accentClass}
                    grid gap-3
                    hover:shadow-[0_22px_44px_rgba(15,23,42,0.14)] hover:-translate-y-0.5
                    active:scale-[0.99] transition-all duration-200
                  `}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-black text-[#171b1f] mb-1.5">
                        {race.heureDepart}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="bg-[#EEF7EF] text-[#0b8f4d] rounded-full px-2.5 py-1.5 text-xs font-extrabold">
                          {formatDiscipline(race)}
                        </span>
                        {race.estQuinte ? (
                          <span className="bg-[#FFF4D8] text-[#A66B00] rounded-full px-2.5 py-1.5 text-xs font-extrabold">
                            Quinte
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-amber-600 text-sm font-extrabold whitespace-nowrap">
                      {minutesUntilStart >= 60
                        ? `Dans ${Math.round(minutesUntilStart / 60)}h`
                        : minutesUntilStart >= 0
                          ? `Dans ${Math.round(minutesUntilStart)} min`
                          : raceScore?.stage === "finished"
                            ? "Resultat"
                            : "En cours"}
                    </span>
                  </div>

                  <div>
                    <div className="text-[17px] font-black text-[#171b1f] leading-tight mb-1.5">
                      R{race.reunion}C{race.course} - {race.nomCourse}
                    </div>
                    <div className="text-slate-500 text-sm">
                      {race.hippodrome} · {race.nombrePartants} partants · {race.distance} m
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {raceScore?.score !== undefined ? (
                      <span className={`${scoreClasses} rounded-full px-2.5 py-[7px] text-xs font-extrabold`}>
                        Confiance {raceScore.score}/10
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-slate-500 rounded-full px-2.5 py-[7px] text-xs font-extrabold">
                        Analyse a venir
                      </span>
                    )}
                    <span className={`${stageClasses} rounded-full px-2.5 py-[7px] text-xs font-extrabold`}>
                      {getStageLabel(raceScore?.stage ?? null)}
                    </span>
                    <span className="bg-gray-100 text-slate-600 rounded-full px-2.5 py-[7px] text-xs font-extrabold">
                      {formatCurrency(race.allocation)}
                    </span>
                  </div>

                  <div className="text-[#5B6472] text-sm leading-relaxed">
                    {getRaceHint(race, raceScore?.score ?? null, raceScore?.stage ?? null, minutesUntilStart)}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* ─── Bottom navigation bar ─── */}
      <div className="fixed bottom-0 left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl bg-white/[0.94] backdrop-blur-lg border-t border-[rgba(15,23,42,0.08)] grid grid-cols-3 z-40">
        {[
          { label: "Courses", active: true, href: `/?date=${selectedDate}` },
          { label: "Mes Paris", active: false, href: "/mes-paris" },
          { label: "Bilan", active: false, href: `/bilan?date=${selectedDate}` },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            className={`
              border-none bg-transparent pt-3.5 px-2.5 pb-4 cursor-pointer
              transition-colors duration-150
              ${
                item.active
                  ? "font-black text-[#0b8f4d]"
                  : "font-bold text-[#5B6472] hover:text-[#171b1f]"
              }
            `}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen w-full max-w-md sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(0,132,61,0.12), transparent 26%), radial-gradient(circle at top right, rgba(18,183,106,0.1), transparent 18%), #F6F7F8",
          }}
        />
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
