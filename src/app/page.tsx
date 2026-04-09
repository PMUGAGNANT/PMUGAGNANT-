"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AccordionPanel } from "@/components/ui/AccordionPanel";
import { CourseCard } from "@/components/ui/CourseCard";
import { FilterPills } from "@/components/ui/FilterPills";
import { HowItWorks } from "@/components/ui/HowItWorks";
import { PerformanceProof } from "@/components/ui/PerformanceProof";
import { PromoVideoSection } from "@/components/ui/PromoVideoSection";
import { RecentResults } from "@/components/ui/RecentResults";
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
  | "method";
type BoardFilter = "all" | "jouable" | "surveillance" | "passer";
type BoardSectionKey = Exclude<BoardFilter, "all"> | "resultat";

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

type FocusParticipant = {
  numPmu?: number | string | null;
  numero?: number | string | null;
  nom?: string | null;
  jockey?: string | null;
  driver?: string | null;
  entraineur?: string | null;
  cote?: number | null;
  prediction?: {
    confiance?: number | null;
    scoreCheval?: number | null;
    typePariConseille?: string | null;
    topFacteurs?: string[] | null;
  } | null;
};

type FocusDetailResponse = {
  success?: boolean;
  participants?: FocusParticipant[] | number | null;
  minutesUntilStart?: number | null;
  pronoAvailable?: boolean;
  isFinished?: boolean;
  analysis?: {
    ranking?: FocusParticipant[] | null;
    favori?: FocusParticipant | null;
    recommandation?: {
      decision?: string | null;
    } | null;
    scoreConfiance?: {
      score?: number | null;
      facteurs?: string[] | null;
    } | null;
  } | null;
  paywall?: {
    required?: boolean;
    preview?: {
      lisibilite?: string | null;
      recommendation?: string | null;
      favori?: {
        numPmu?: number | string | null;
        nom?: string | null;
      } | null;
    } | null;
  } | null;
};

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "hour", label: "Par heure" },
  { value: "score", label: "Meilleure note" },
  { value: "urgent", label: "A suivre vite" },
  { value: "allocation", label: "Gros enjeux" },
];

const BOARD_FILTER_OPTIONS: Array<{ value: BoardFilter; label: string }> = [
  { value: "all", label: "Toutes" },
  { value: "jouable", label: "Vertes" },
  { value: "surveillance", label: "Jaunes" },
  { value: "passer", label: "Rouges" },
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

function formatCourseMeta(race: RaceSummary) {
  return [formatDiscipline(race), `${race.nombrePartants} partants`, `${race.distance} m`]
    .filter(Boolean)
    .join(" - ");
}

function formatMinutesLabel(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Horaire PMU";
  }

  const roundedMinutes = Math.round(value);

  if (roundedMinutes <= -10) return "Course reglee";
  if (roundedMinutes <= 0) return "Depart imminent";
  if (roundedMinutes < 60) return `${roundedMinutes} min`;

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes}`;
}

function formatOddsLabel(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(1);
}

function getParticipantNum(participant: FocusParticipant) {
  const raw = participant.numPmu ?? participant.numero;
  return typeof raw === "number" ? raw : Number(raw);
}

function normalizeFocusParticipants(raw: FocusParticipant[] | number | null | undefined) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((participant) => {
    const num = getParticipantNum(participant);
    return Number.isFinite(num);
  });
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

function getBoardSectionMeta(section: BoardSectionKey) {
  switch (section) {
    case "jouable":
      return {
        label: "Vertes",
        title: "Jouables maintenant",
        description:
          "Les meilleurs spots a ouvrir en premier. C'est la zone prioritaire du board.",
        color: "var(--pmu-primary)",
      };
    case "surveillance":
      return {
        label: "Jaunes",
        title: "Sous surveillance",
        description:
          "Courses encore observables, mais le ticket ou la lisibilite demandent de la prudence.",
        color: "var(--pmu-orange)",
      };
    case "passer":
      return {
        label: "Rouges",
        title: "A filtrer",
        description:
          "Courses faibles, bruyantes ou peu propres. Elles restent plus bas pour ne pas polluer l'ouverture.",
        color: "var(--pmu-red)",
      };
    case "resultat":
    default:
      return {
        label: "Reglees",
        title: "Courses terminees",
        description:
          "Les courses deja reglees restent separees du board d'action.",
        color: "var(--pmu-text-muted)",
      };
  }
}

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
          }
        }

        const response = await fetch(
          `/api/race/${focusRace.race.reunion}/${focusRace.race.course}?date=${selectedDate}`,
          {
            cache: "no-store",
            signal: ac.signal,
            headers: authorization
              ? { Authorization: authorization }
              : undefined,
          }
        );

        if (!response.ok) {
          throw new Error("Le desk course n'est pas disponible.");
        }

        const payload = (await response.json()) as FocusDetailResponse;

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
  const boardSections = useMemo(() => {
    const grouped: Record<BoardSectionKey, FeaturedRace[]> = {
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
  }, [boardFilter, featuredRaces]);

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
                  options={BOARD_FILTER_OPTIONS}
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
                <div className="app-card p-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
                  {section.key === "jouable"
                    ? "Aucune course verte pour le moment. Le board garde seulement les sections jaune et rouge."
                    : section.key === "surveillance"
                      ? "Aucune course jaune n'a besoin d'etre gardee sous surveillance sur cette journee."
                      : "Aucune course rouge ne remonte pour cette vue."}
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
