import { asArray } from "@/lib/array-utils";
import {
  computeClientRaceScore,
  formatBetTypeLabelFr,
  SEUIL_JOUABLE,
  type ApiRaceScoreLite,
} from "@/lib/client-race-scoring";
import {
  formatDateToPmu,
  getMinutesUntilStart,
  getTodayDateStr,
  parsePmuDate,
} from "@/lib/date-utils";
import {
  getRacePriorityBadge,
  type RacePriorityBadge,
} from "@/lib/race-priority";
import type { RoleCheval } from "@/lib/horse-roles";
import type { Lisibilite, PredictionDecision, RaceSummary } from "@/lib/types";

export type ScoreStage = "preview_2h" | "preview_1h" | "final_30m" | "finished";
export type SortMode = "hour" | "score" | "urgent" | "allocation";
export type HomeSecondaryPanel =
  | "performance"
  | "results"
  | "demo"
  | "method";
export type BoardFilter = "all" | "prioritaire" | "jouable" | "surveillance" | "passer";
export type BoardSectionKey = Exclude<BoardFilter, "all"> | "resultat";

export type RaceScore = {
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
  comboCandidate?: {
    cheval_num: number;
    cheval_nom: string;
    cote: number;
    role: "PEPITE" | "OUTSIDER";
    confiance: number;
    score_cheval: number;
  } | null;
};

export type RacesResponse = {
  success: boolean;
  date: string;
  races: RaceSummary[];
};

export type ScoresResponse = {
  success: boolean;
  scores?:
    | RaceScore[]
    | Record<string, Omit<RaceScore, "dateStr" | "reunion" | "course">>
    | null;
};

export type FeaturedRace = {
  race: RaceSummary;
  score?: RaceScore;
  scoreValue: number;
  minutesUntilStart: number;
  confidence: number;
  status: "jouable" | "surveillance" | "passer" | "resultat";
  hint: string;
  priorityBadge: RacePriorityBadge | null;
};

export type PriorityCard = {
  key: string;
  title: string;
  subtitle: string;
  value: string;
  description: string;
  tone: "primary" | "warning" | "neutral";
  race?: FeaturedRace | null;
};

export type HomeSummaryStats = {
  meetings: number;
  playable: number;
};

export type HomeBoardSection = {
  key: BoardSectionKey;
  items: FeaturedRace[];
  label: string;
  title: string;
  description: string;
  color: string;
};

export type FocusParticipant = {
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

export type FocusDetailResponse = {
  success?: boolean;
  participants?: FocusParticipant[] | number | null;
  roles?: RoleCheval[] | null;
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

export type HomeTopParisItem = {
  rank: number;
  raceCode: string;
  meetingLabel: string;
  courseLabel: string;
  trackLabel: string;
  timeLabel: string;
  metaLabel: string;
  title: string;
  subtitle: string;
  horse: string;
  stake: string;
  betType: string;
  confidence: number;
  sourceLabel: string;
  onClick: () => void;
};

export const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "hour", label: "Par heure" },
  { value: "score", label: "Meilleure note" },
  { value: "urgent", label: "A suivre vite" },
  { value: "allocation", label: "Gros enjeux" },
];

export function coerceRaceSummaries(raw: unknown): RaceSummary[] {
  return Array.isArray(raw)
    ? raw.filter(
        (race): race is RaceSummary =>
          race != null &&
          String((race as RaceSummary).pays ?? "").toUpperCase() === "FRA"
      )
    : [];
}

export function normalizeDateParam(value: string | null) {
  return value && /^\d{8}$/.test(value) ? value : getTodayDateStr();
}

export function addDays(dateStr: string, diff: number) {
  const date = parsePmuDate(dateStr);
  date.setUTCDate(date.getUTCDate() + diff);
  return formatDateToPmu(date);
}

export function formatDisplayDate(dateStr: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parsePmuDate(dateStr));
}

export function formatRelativeDay(dateStr: string) {
  const today = getTodayDateStr();

  if (dateStr === today) return "Aujourd'hui";
  if (dateStr === addDays(today, 1)) return "Demain";
  if (dateStr === addDays(today, -1)) return "Hier";

  return formatDisplayDate(dateStr);
}

export function formatStake(value?: number | null) {
  if (!value) return "8 EUR";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDiscipline(race: RaceSummary) {
  if (race.estTrot) return "Attele";
  if (race.estPlat) return "Plat";
  return race.discipline || "Discipline";
}

export function formatCourseMeta(race: RaceSummary) {
  return [formatDiscipline(race), `${race.nombrePartants} partants`, `${race.distance} m`]
    .filter(Boolean)
    .join(" - ");
}

export function formatRaceCode(race: RaceSummary) {
  return `R${race.reunion}C${race.course}`;
}

export function formatMinutesLabel(value?: number | null) {
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

export function formatOddsLabel(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(1);
}

export function getParticipantNum(participant: FocusParticipant) {
  const raw = participant.numPmu ?? participant.numero;
  return typeof raw === "number" ? raw : Number(raw);
}

export function normalizeFocusParticipants(
  raw: FocusParticipant[] | number | null | undefined
) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((participant) => {
    const num = getParticipantNum(participant);
    return Number.isFinite(num);
  });
}

export function getStageLabel(stage?: ScoreStage) {
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

export function getPickLabel(score?: RaceScore) {
  if (!score?.pick?.numPmu && !score?.pick?.nom) {
    return "Ticket principal en preparation";
  }

  const num = score?.pick?.numPmu ? `${score.pick.numPmu}` : "";
  const horse = score?.pick?.nom ?? "Cheval principal";
  return [num, horse].filter(Boolean).join(" - ");
}

export function getBetTypeLabel(score?: RaceScore) {
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

export function buildFeaturedRaces(
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

    const baseItem: FeaturedRace = {
      race,
      score,
      scoreValue: client.displayScore,
      minutesUntilStart,
      confidence: client.displayScore,
      status: client.playTier,
      hint: getRaceHint(race, score),
      priorityBadge: null,
    };

    return {
      ...baseItem,
      priorityBadge: getBoardPriorityBadge(baseItem),
    } satisfies FeaturedRace;
  });
}

export function sortFeaturedRaces(items: FeaturedRace[], sortMode: SortMode) {
  return [...items].sort((a, b) => {
    const priorityWeightDelta =
      (b.priorityBadge?.weight ?? 0) - (a.priorityBadge?.weight ?? 0);

    if (priorityWeightDelta !== 0) {
      return priorityWeightDelta;
    }

    switch (sortMode) {
      case "score":
        return b.scoreValue - a.scoreValue;
      case "urgent":
        return (
          a.minutesUntilStart - b.minutesUntilStart || b.scoreValue - a.scoreValue
        );
      case "allocation":
        return (
          (b.race.allocation ?? 0) - (a.race.allocation ?? 0) ||
          b.scoreValue - a.scoreValue
        );
      case "hour":
      default:
        return (
          (a.race.heureDepart || "").localeCompare(b.race.heureDepart || "") ||
          b.scoreValue - a.scoreValue
        );
    }
  });
}

export function getRadarRace(items: FeaturedRace[]) {
  const list = asArray<FeaturedRace>(items).filter(
    (item) => item.status !== "resultat"
  );

  if (list.length === 0) {
    return asArray<FeaturedRace>(items)[0] ?? null;
  }

  const priority = list.filter((item) => (item.priorityBadge?.weight ?? 0) > 0);
  const priorityPlayable = priority.filter((item) => item.status === "jouable");
  const jouables = list.filter((item) => item.status === "jouable");
  const pool =
    priorityPlayable.length > 0
      ? priorityPlayable
      : priority.length > 0
        ? priority
        : jouables.length > 0
          ? jouables
          : list;
  return pool.reduce(
    (best, cur) => (cur.scoreValue > best.scoreValue ? cur : best),
    pool[0]!
  );
}

export function getTopParisItems(
  items: FeaturedRace[],
  navigate: (race: RaceSummary) => void
): HomeTopParisItem[] {
  return asArray<FeaturedRace>(items)
    .filter((item) => item.status === "jouable" && item.confidence >= SEUIL_JOUABLE)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map((item, index) => ({
      rank: index + 1,
      raceCode: formatRaceCode(item.race),
      meetingLabel: `Reunion ${item.race.reunion}`,
      courseLabel: `Course ${item.race.course}`,
      trackLabel: item.race.hippodrome,
      timeLabel: item.race.heureDepart,
      metaLabel: formatCourseMeta(item.race),
      title: item.race.nomCourse,
      subtitle: `${item.race.hippodrome} - ${item.race.heureDepart} - ${formatCourseMeta(item.race)}`,
      horse: getPickLabel(item.score),
      stake: formatStake(
        item.score?.pick?.confidence
          ? Math.max(6, Math.round(item.score.pick.confidence * 2.5))
          : 8
      ),
      betType: getBetTypeLabel(item.score),
      confidence: item.confidence,
      sourceLabel: item.priorityBadge?.label ?? "Jouable",
      onClick: () => navigate(item.race),
    }));
}

export function getPriorityCards(items: FeaturedRace[]): PriorityCard[] {
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

export function getBoardSectionMeta(section: BoardSectionKey) {
  switch (section) {
    case "prioritaire":
      return {
        label: "Suivi renforce",
        title: "Courses sous cadence active",
        description:
          "Le moteur repasse plus souvent ici. C'est la file chaude du board V6.",
        color: "var(--pmu-primary)",
      };
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

export function getBoardPriorityBadge(item: FeaturedRace): RacePriorityBadge | null {
  return getRacePriorityBadge({
    race: item.race,
    status: item.status,
    decision: item.score?.decision,
  });
}
