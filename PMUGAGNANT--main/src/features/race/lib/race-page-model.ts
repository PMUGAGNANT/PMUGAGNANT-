import type {
  ArrivalRow,
  CourseParticipantRow,
} from "@/features/race/components/ParticipantsTable";
import type { AvisExpertPrediction } from "@/lib/avis-generator";
import type { RoleCheval } from "@/lib/horse-roles";
import type { LiveCotesSeries } from "@/lib/live-cotes";
import type { MeteoData } from "@/lib/meteo";
import type { RacePriorityBadge } from "@/lib/race-priority";
import type { Participant, RaceAnalysis } from "@/lib/types";
import type {
  ParticipantTableRow,
  RaceVerdictSummary,
} from "@/features/vmax/vmax-model";

export type RaceApiParticipant = {
  numPmu?: number | string | null;
  numero?: number | string | null;
  nom?: string | null;
  driver?: string | null;
  jockey?: string | null;
  entraineur?: string | null;
  proprietaire?: string | null;
  age?: number | null;
  sexe?: string | null;
  placeCorde?: number | string | null;
  corde?: number | string | null;
  poids?: number | null;
  musique?: string | null;
  cote?: number | null;
  statut?: string | null;
  nonPartant?: boolean | null;
  prediction?: {
    confiance?: number | null;
    scoreCheval?: number | null;
    topFacteurs?: string[] | null;
    typePariConseille?: string | null;
    miseConseillee?: number | null;
  } | null;
};

export type RaceApiResponse = {
  success?: boolean;
  courseInfo?: {
    reunion?: number;
    course?: number;
    hippodrome?: string | null;
    pays?: string | null;
    nomCourse?: string | null;
    discipline?: string | null;
    distance?: number | string | null;
    heureDepart?: string | null;
    nombrePartants?: number | null;
    allocation?: number | null;
    terrain?: string | null;
    meteo?: string | null;
    dateStr?: string | null;
  } | null;
  participants?: RaceApiParticipant[] | number | null;
  officialArrival?: ArrivalRow[] | null;
  roles?: RoleCheval[] | null;
  avisExpert?: AvisExpertPrediction[] | null;
  liveCotes?: LiveCotesSeries[] | null;
  meteo?: MeteoData | null;
  minutesUntilStart?: number | null;
  pronoAvailable?: boolean;
  isFinished?: boolean;
  analysis?: {
    ranking?: RaceApiParticipant[] | null;
    top5?: RaceApiParticipant[] | null;
    favori?: RaceApiParticipant | null;
    pepiteDuJour?: RaceApiParticipant | null;
    scoreConfiance?: {
      score?: number | null;
      facteurs?: string[] | null;
    } | null;
    recommandation?: {
      decision?: string | null;
    } | null;
    prediction?: {
      lisibilite?: "LISIBLE" | "COMPLEXE" | "LOTERIE" | null;
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
  refreshPriority?: RacePriorityBadge | null;
};

export type RaceCourseInfo = NonNullable<
  NonNullable<RaceApiResponse["courseInfo"]>
>;

export type RacePaywallPreview = NonNullable<
  NonNullable<NonNullable<RaceApiResponse["paywall"]>["preview"]>
>;

export type PronosticCardData = {
  favoris?: Array<number | string>;
  top5?: Array<number | string>;
  scoreConfiance?: number | null;
  valueBet?: number | string | null;
  miseConseil?: number | null;
  recommandation?: string | null;
  betType?: string | null;
  pourquoi?: string[];
};

export type ArrivalCardRow = {
  numero: number;
  cheval: string;
  selectedByIa: boolean;
};

export type RaceQuickReadItem = {
  numero: number;
  cheval: string;
  cote: number | null;
  score: number | null;
  note: string;
};

export type RaceQuickReadModel = {
  confidence: number;
  confidenceLabel: string;
  bases: RaceQuickReadItem[];
  outsiders: RaceQuickReadItem[];
  eliminations: RaceQuickReadItem[];
};

function getFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRowScore(row: ParticipantTableRow) {
  return getFiniteNumber(row.scoreV10) ?? getFiniteNumber(row.scoreIa);
}

function sortRowsByScore(
  rows: ParticipantTableRow[],
  direction: "asc" | "desc" = "desc"
) {
  return [...rows].sort((left, right) => {
    const leftScore = getRowScore(left) ?? (direction === "desc" ? -1 : 999);
    const rightScore = getRowScore(right) ?? (direction === "desc" ? -1 : 999);

    if (leftScore !== rightScore) {
      return direction === "desc" ? rightScore - leftScore : leftScore - rightScore;
    }

    return (left.cote ?? 999) - (right.cote ?? 999);
  });
}

function getRaceConfidenceLabel(score: number) {
  if (score >= 75) return "Course lisible";
  if (score >= 55) return "Course jouable";
  return "Course piegeuse";
}

function toQuickReadItem(
  row: ParticipantTableRow,
  note: string
): RaceQuickReadItem {
  return {
    numero: row.numero,
    cheval: row.cheval,
    cote: row.cote,
    score: getRowScore(row),
    note,
  };
}

export function formatEuros(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateLabel(dateStr?: string | null) {
  if (!dateStr || !/^\d{8}$/.test(dateStr)) return null;

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(
    new Date(
      `${dateStr.slice(4, 8)}-${dateStr.slice(2, 4)}-${dateStr.slice(0, 2)}T12:00:00Z`
    )
  );
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

export function formatDiscipline(value?: string | null) {
  const upper = (value ?? "").toUpperCase();
  if (!upper) return "Discipline";
  if (upper.includes("ATTELE")) return "Trot attele";
  if (upper.includes("MONTE")) return "Trot monte";
  if (upper.includes("PLAT")) return "Plat";
  if (upper.includes("HAIE") || upper.includes("STEEPLE")) return "Obstacle";
  return value ?? "Discipline";
}

export function getRankingParticipants(payload: RaceApiResponse | null) {
  return Array.isArray(payload?.analysis?.ranking) ? payload.analysis.ranking ?? [] : [];
}

export function mergeParticipantData(payload: RaceApiResponse | null) {
  const rawParticipants = Array.isArray(payload?.participants)
    ? payload.participants
    : [];
  const rankingParticipants = getRankingParticipants(payload);

  if (rawParticipants.length === 0) {
    return rankingParticipants;
  }

  const rankingByNumber = new Map(
    rankingParticipants.map((participant) => [
      String(participant.numero ?? participant.numPmu ?? ""),
      participant,
    ])
  );

  return rawParticipants.map((participant) => {
    const key = String(participant.numero ?? participant.numPmu ?? "");
    const ranked = rankingByNumber.get(key);

    return {
      ...participant,
      prediction: {
        ...ranked?.prediction,
        ...participant.prediction,
        topFacteurs:
          participant.prediction?.topFacteurs ??
          ranked?.prediction?.topFacteurs ??
          [],
        scoreCheval:
          participant.prediction?.scoreCheval ??
          ranked?.prediction?.scoreCheval ??
          null,
      },
      cote: participant.cote ?? ranked?.cote ?? null,
      musique: participant.musique ?? ranked?.musique ?? null,
      nonPartant: participant.nonPartant ?? ranked?.nonPartant ?? null,
    };
  });
}

export function toParticipantRow(
  participant: RaceApiParticipant
): CourseParticipantRow {
  return {
    numero: participant.numero ?? participant.numPmu ?? null,
    nom: participant.nom ?? null,
    driver: participant.driver ?? null,
    jockey: participant.jockey ?? null,
    entraineur: participant.entraineur ?? null,
    proprietaire: participant.proprietaire ?? null,
    age: participant.age ?? null,
    sexe: participant.sexe ?? null,
    corde: participant.corde ?? participant.placeCorde ?? null,
    poids: participant.poids ?? null,
    musique: participant.musique ?? null,
    cote: participant.cote ?? null,
    scoreIa: participant.prediction?.scoreCheval ?? null,
    nonPartant: participant.nonPartant ?? participant.statut === "NON_PARTANT",
    topFacteurs: Array.isArray(participant.prediction?.topFacteurs)
      ? participant.prediction?.topFacteurs ?? []
      : [],
  };
}

export function normalizeParticipants(payload: RaceApiResponse | null) {
  const rolesByNumber = new Map(
    normalizeRoles(payload).map((role) => [String(role.cheval_num), role] as const)
  );

  return mergeParticipantData(payload).map((participant) => {
    const row = toParticipantRow(participant);

    return {
      ...row,
      roleCheval:
        row.numero !== null && row.numero !== undefined
          ? rolesByNumber.get(String(row.numero)) ?? null
          : null,
    };
  });
}

export function normalizeOfficialArrival(payload: RaceApiResponse | null) {
  return Array.isArray(payload?.officialArrival) ? payload.officialArrival : [];
}

export function normalizeRoles(payload: RaceApiResponse | null) {
  return Array.isArray(payload?.roles) ? payload.roles : [];
}

export function normalizePronostic(
  payload: RaceApiResponse | null
): PronosticCardData | null {
  const analysis = payload?.analysis;
  if (!analysis || typeof analysis !== "object") {
    return null;
  }

  const ranking = getRankingParticipants(payload);
  const top5 = Array.isArray(analysis.top5) ? analysis.top5 : [];
  const favori =
    analysis.favori && typeof analysis.favori === "object" ? analysis.favori : null;
  const selected = favori ?? ranking[0] ?? null;
  const facteurs = Array.isArray(selected?.prediction?.topFacteurs)
    ? selected?.prediction?.topFacteurs ?? []
    : Array.isArray(analysis.scoreConfiance?.facteurs)
      ? analysis.scoreConfiance?.facteurs ?? []
      : [];

  if (!selected && top5.length === 0 && ranking.length === 0) {
    return null;
  }

  return {
    favoris:
      selected?.numPmu !== undefined && selected?.numPmu !== null
        ? [selected.numPmu]
        : [],
    top5: (top5.length ? top5 : ranking.slice(0, 5))
      .map((runner) => runner?.numPmu)
      .filter(
        (value): value is number | string =>
          value !== null && value !== undefined
      ),
    scoreConfiance:
      analysis.scoreConfiance?.score ?? selected?.prediction?.confiance ?? null,
    valueBet: analysis.pepiteDuJour?.numPmu ?? null,
    miseConseil: selected?.prediction?.miseConseillee ?? null,
    recommandation: analysis.recommandation?.decision ?? null,
    betType: selected?.prediction?.typePariConseille ?? null,
    pourquoi: facteurs.filter((factor): factor is string => typeof factor === "string"),
  };
}

export function getTopFiveNumbers(
  pronostic: PronosticCardData | null,
  payload: RaceApiResponse | null
) {
  if (Array.isArray(pronostic?.top5)) {
    return pronostic.top5;
  }

  return getRankingParticipants(payload)
    .slice(0, 5)
    .map((runner) => runner?.numPmu)
    .filter(
      (value): value is number | string =>
        value !== null && value !== undefined
    );
}

export function buildArriveeFromParticipants(participants: Participant[]) {
  const arrivee = participants
    .filter(
      (participant) =>
        typeof participant.ordreArrivee === "number" &&
        Number.isInteger(participant.ordreArrivee) &&
        participant.ordreArrivee > 0
    )
    .sort((left, right) => Number(left.ordreArrivee) - Number(right.ordreArrivee))
    .map((participant) => participant.numPmu);

  return arrivee.length > 0 ? arrivee : null;
}

export function getRecommendedRow(
  rows: ParticipantTableRow[],
  analysis: RaceAnalysis | null
) {
  const v10Choice = rows.find((item) => item.scoreV10Role === "CHOIX");
  if (v10Choice) return v10Choice;

  const bestV10 = sortRowsByScore(
    rows.filter((item) => getFiniteNumber(item.scoreV10) !== null)
  )[0];
  if (bestV10) return bestV10;

  const analysisPick = analysis?.favori?.numPmu ?? null;
  if (analysisPick !== null) {
    const row = rows.find((item) => item.numero === analysisPick);
    if (row) return row;
  }

  return sortRowsByScore(rows)[0] ?? null;
}

export function getGaugeScore(
  analysis: RaceAnalysis | null,
  selectedRow: ParticipantTableRow | null
) {
  const selectedScore = getFiniteNumber(selectedRow?.scoreV10);
  if (selectedScore !== null) {
    return Math.max(0, Math.min(100, Math.round(selectedScore)));
  }

  const confidence =
    analysis?.scoreConfiance?.score ??
    analysis?.favori?.prediction.confiance ??
    null;

  if (typeof confidence === "number" && Number.isFinite(confidence)) {
    return Math.max(0, Math.min(100, Math.round(confidence * 10)));
  }

  return Math.max(0, Math.min(100, Math.round(selectedRow?.scoreIa ?? 0)));
}

export function buildTopSelections(
  rows: ParticipantTableRow[],
  limit = 5
) {
  return sortRowsByScore(rows.filter((row) => getRowScore(row) !== null)).slice(0, limit);
}

export function buildArrivalRows(
  arrivee: number[] | null,
  rows: ParticipantTableRow[],
  selectionNumbers: Set<number>
) {
  return (arrivee?.slice(0, 5) ?? []).map((numero) => ({
    numero,
    cheval: rows.find((row) => row.numero === numero)?.cheval ?? `Cheval ${numero}`,
    selectedByIa: selectionNumbers.has(numero),
  })) satisfies ArrivalCardRow[];
}

export function buildRaceQuickReadModel(
  rows: ParticipantTableRow[],
  verdict: RaceVerdictSummary,
  confidenceScore: number
): RaceQuickReadModel {
  const sortedDesc = sortRowsByScore(rows);
  const used = new Set<number>();

  const bases = sortedDesc
    .filter((row) => (row.mise ?? 0) > 0 || (getRowScore(row) ?? 0) >= 60)
    .slice(0, 3)
    .map((row) => {
      used.add(row.numero);
      return toQuickReadItem(
        row,
        row.numero === verdict.numero
          ? "Base du ticket IA"
          : row.mise && row.mise > 0
            ? "Mise active"
            : "Score solide"
      );
    });

  const outsiders = sortedDesc
    .filter((row) => !used.has(row.numero))
    .filter((row) => (row.cote ?? 0) >= 8 && (getRowScore(row) ?? 0) >= 45)
    .slice(0, 2)
    .map((row) => {
      used.add(row.numero);
      return toQuickReadItem(row, "Profil value");
    });

  const eliminations = sortRowsByScore(
    rows.filter((row) => !used.has(row.numero)),
    "asc"
  )
    .filter((row) => (row.mise ?? 0) <= 0)
    .filter((row) => (getRowScore(row) ?? 0) <= 45 || (row.cote ?? 0) >= 15)
    .slice(0, 2)
    .map((row) => toQuickReadItem(row, "Signal faible"));

  return {
    confidence: confidenceScore,
    confidenceLabel: getRaceConfidenceLabel(confidenceScore),
    bases,
    outsiders,
    eliminations,
  };
}
