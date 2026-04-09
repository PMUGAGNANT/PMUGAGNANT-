import type {
  ArrivalRow,
  CourseParticipantRow,
} from "@/features/race/components/ParticipantsTable";
import type { RacePriorityBadge } from "@/lib/race-priority";

export type RaceApiParticipant = {
  numPmu?: number | string | null;
  numero?: number | string | null;
  nom?: string | null;
  driver?: string | null;
  jockey?: string | null;
  entraineur?: string | null;
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
  return mergeParticipantData(payload).map(toParticipantRow);
}

export function normalizeOfficialArrival(payload: RaceApiResponse | null) {
  return Array.isArray(payload?.officialArrival) ? payload.officialArrival : [];
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
