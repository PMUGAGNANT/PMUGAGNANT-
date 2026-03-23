import { getTodayDateStr as getTodayDateStrFromUtils } from "@/lib/date-utils";
import type {
  LiveCourseSnapshot,
  Participant,
  RaceSummary,
  SignalVariation,
} from "@/lib/types";

const BASE_URL = "https://online.turfinfo.api.pmu.fr/rest/client/1";

async function fetchPmuJson<T>(path: string, revalidate = 60): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    next: { revalidate },
    headers: {
      Accept: "application/json",
      "User-Agent": "pmu-ai-v92/1.0",
    },
  } as RequestInit);

  if (!response.ok) {
    throw new Error(`PMU API error: ${response.status} ${response.statusText} (${path})`);
  }

  return (await response.json()) as T;
}

function toParisHour(ms?: number | null) {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getCoteFromParticipant(raw: Record<string, unknown>): number | null {
  const coteDirect = raw.coteDirect as Record<string, unknown> | undefined;
  const lastReport = raw.dernierRapportDirect as Record<string, unknown> | undefined;
  const rapportSimple = raw.rapportDirect as Record<string, unknown> | undefined;

  const rawValue =
    coteDirect?.cotePmu ??
    lastReport?.rapport ??
    rapportSimple?.rapport ??
    raw.cotePmu ??
    null;

  if (typeof rawValue !== "number" || Number.isNaN(rawValue)) {
    return null;
  }

  return rawValue > 100 ? rawValue / 100 : rawValue;
}

function getWeight(raw: Record<string, unknown>): number | null {
  const poids =
    raw.poids ??
    raw.handicapPoids ??
    (raw.poidsConditionMonte as number | undefined) ??
    ((raw.valeurHandicapPoids as Record<string, unknown> | undefined)?.poids as number | undefined) ??
    ((raw.valeurHandicapPoids as Record<string, unknown> | undefined)?.valeur as number | undefined) ??
    null;

  return typeof poids === "number" && !Number.isNaN(poids) ? poids : null;
}

function getStall(raw: Record<string, unknown>): number | null {
  const value =
    raw.placeCorde ??
    raw.stalle ??
    raw.corde ??
    ((raw.position as Record<string, unknown> | undefined)?.placeCorde as number | undefined) ??
    null;

  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function normalizeSignalVariation(variation: number | null): SignalVariation | null {
  if (variation === null || Number.isNaN(variation)) return null;
  if (variation <= -20) return "FORTE_BAISSE";
  if (variation < -5) return "BAISSE";
  if (variation >= 30) return "FORTE_HAUSSE";
  if (variation > 10) return "HAUSSE";
  return "STABLE";
}

function mapParticipant(raw: Record<string, unknown>): Participant {
  const cote = getCoteFromParticipant(raw);
  const coteMatin =
    typeof raw.coteMatin === "number"
      ? (raw.coteMatin as number)
      : typeof raw.coteReference === "number"
        ? (raw.coteReference as number)
        : cote;
  const variation =
    cote !== null && coteMatin !== null && coteMatin > 0
      ? ((cote - coteMatin) / coteMatin) * 100
      : null;
  const gainsParticipant = (raw.gainsParticipant as Record<string, unknown> | undefined) ?? {};

  return {
    numPmu: Number(raw.numPmu ?? 0),
    nom: String(raw.nom ?? ""),
    driver: String(raw.driver ?? raw.driverPrincipal ?? ""),
    entraineur: String(raw.entraineur ?? raw.entraineurPrincipal ?? ""),
    jockey: String(raw.jockey ?? raw.jockeyPrincipal ?? raw.driver ?? ""),
    age: Number(raw.age ?? 0),
    sexe: String(raw.sexe ?? ""),
    cote,
    coteMatin,
    coteDepart: cote,
    variationCote: variation,
    signalVariation: normalizeSignalVariation(variation),
    musique: String(raw.musique ?? ""),
    nombreCourses: Number(raw.nombreCourses ?? raw.nombreCoursesDuCheval ?? 0),
    nombreVictoires: Number(raw.nombreVictoires ?? 0),
    nombrePlaces: Number(raw.nombrePlaces ?? 0),
    gainCarriere:
      Number(gainsParticipant.gainsCarriere ?? 0) +
      Number(gainsParticipant.gainsAnneeEnCours ?? 0),
    nombreSuiveurs: Number(raw.nombreIndicateursFavoris ?? raw.nombreSuiveurs ?? 0),
    ordreArrivee:
      typeof raw.ordreArrivee === "number" ? Number(raw.ordreArrivee) : null,
    statut: String(raw.statut ?? ""),
    placeCorde: getStall(raw),
    stalle: getStall(raw),
    poids: getWeight(raw),
    ferrure: typeof raw.ferrure === "string" ? raw.ferrure : null,
    nonPartant: String(raw.statut ?? "") !== "PARTANT",
    formeRecenteAmelioree:
      typeof raw.formeRecenteAmelioree === "boolean"
        ? raw.formeRecenteAmelioree
        : false,
  };
}

export function getTodayDateStr(): string {
  return getTodayDateStrFromUtils();
}

export async function getAllRaces(dateStr?: string): Promise<RaceSummary[]> {
  const date = dateStr ?? getTodayDateStr();
  const data = await fetchPmuJson<Record<string, unknown>>(`/programme/${date}`);
  const reunions = ((data.programme as Record<string, unknown> | undefined)?.reunions ??
    []) as Record<string, unknown>[];

  const races: RaceSummary[] = [];

  for (const reunion of reunions) {
    const reunionNumber = Number(reunion.numOfficiel ?? 0);
    const hippodrome = String(
      ((reunion.hippodrome as Record<string, unknown> | undefined)?.libelleCourt as string) ?? ""
    );
    const pays = String(((reunion.pays as Record<string, unknown> | undefined)?.code as string) ?? "");
    const courses = (reunion.courses ?? []) as Record<string, unknown>[];

    for (const course of courses) {
      const discipline = String(course.discipline ?? "");
      races.push({
        dateStr: date,
        reunion: reunionNumber,
        course: Number(course.numOrdre ?? 0),
        hippodrome,
        pays,
        nomCourse: String(course.libelle ?? course.libelleCourt ?? ""),
        heureDepart: toParisHour(Number(course.heureDepart ?? 0)),
        discipline,
        estTrot: discipline.includes("TROT"),
        estPlat: discipline === "PLAT",
        estQuinte:
          Boolean(course.grandPrixNationalTrot) ||
          String(course.categorieParticularite ?? "") === "QUINTE",
        allocation: Number(course.montantTotalOffert ?? 0),
        distance: Number(course.distance ?? 0),
        nombrePartants: Number(course.nombreDeclaresPartants ?? 0),
        terrain:
          typeof course.etatTerrain === "string"
            ? String(course.etatTerrain)
            : typeof course.libelleTerrain === "string"
              ? String(course.libelleTerrain)
              : null,
        meteo:
          typeof course.meteo === "string"
            ? String(course.meteo)
            : typeof course.conditionsMeteo === "string"
              ? String(course.conditionsMeteo)
              : null,
      });
    }
  }

  races.sort((a, b) => a.heureDepart.localeCompare(b.heureDepart));
  return races;
}

export async function getParticipants(
  dateStr: string,
  reunion: number,
  course: number
): Promise<Participant[]> {
  const data = await fetchPmuJson<Record<string, unknown>>(
    `/programme/${dateStr}/R${reunion}/C${course}/participants`
  );
  const participants = ((data.participants ?? []) as Record<string, unknown>[])
    .filter((participant) => String(participant.statut ?? "PARTANT") !== "SUPPRIME")
    .map(mapParticipant);

  return participants;
}

export async function getRealtimeOdds(
  dateStr: string,
  reunion: number,
  course: number
): Promise<Record<number, number>> {
  try {
    const rapports = await getFinalReports(dateStr, reunion, course);
    const simpleGagnant = rapports.simpleGagnant;
    return Object.fromEntries(
      Object.entries(simpleGagnant).map(([key, value]) => [Number(key), value])
    );
  } catch {
    return {};
  }
}

export async function getLiveCourseSnapshot(
  dateStr: string,
  reunion: number,
  course: number
): Promise<LiveCourseSnapshot> {
  try {
    const participants = await getParticipants(dateStr, reunion, course);
    return {
      coteActuelleByHorse: Object.fromEntries(
        participants.map((participant) => [participant.numPmu, participant.cote ?? null])
      ),
      nonPartants: participants
        .filter((participant) => participant.nonPartant || participant.statut !== "PARTANT")
        .map((participant) => participant.numPmu),
      ferrureChanges: Object.fromEntries(
        participants
          .filter((participant) => participant.ferrure)
          .map((participant) => [participant.numPmu, participant.ferrure as string])
      ),
    };
  } catch {
    return {
      coteActuelleByHorse: {},
      nonPartants: [],
      ferrureChanges: {},
    };
  }
}

interface FinalReports {
  simpleGagnant: Record<number, number>;
  simplePlace: Record<number, number>;
  coupleGagnant: Record<string, number>;
  couplePlace: Record<string, number>;
}

function parseCombinaisonKey(combinaison: unknown): string | null {
  if (Array.isArray(combinaison)) {
    return combinaison.join("-");
  }

  if (typeof combinaison === "string") {
    return combinaison;
  }

  return null;
}

export async function getFinalReports(
  dateStr: string,
  reunion: number,
  course: number
): Promise<FinalReports> {
  const data = await fetchPmuJson<Record<string, unknown>>(
    `/programme/${dateStr}/R${reunion}/C${course}/rapports-definitifs`,
    30
  );
  const rapports = (data.rapports ?? []) as Record<string, unknown>[];

  const result: FinalReports = {
    simpleGagnant: {},
    simplePlace: {},
    coupleGagnant: {},
    couplePlace: {},
  };

  for (const rapport of rapports) {
    const typePari = String(rapport.typePari ?? "");
    const combinaisons = (rapport.combinaisons ?? []) as Record<string, unknown>[];

    for (const combinaison of combinaisons) {
      const rawRapport =
        typeof combinaison.rapport === "number"
          ? (combinaison.rapport as number)
          : typeof combinaison.pourUnEuro === "number"
            ? (combinaison.pourUnEuro as number)
            : null;
      const rapportValue =
        rawRapport === null ? null : rawRapport > 100 ? rawRapport / 100 : rawRapport;

      if (rapportValue === null) continue;

      const numPmu =
        typeof combinaison.numPmu === "number"
          ? Number(combinaison.numPmu)
          : Array.isArray(combinaison.combinaison)
            ? Number((combinaison.combinaison as unknown[])[0])
            : null;
      const combinaisonKey = parseCombinaisonKey(combinaison.combinaison);

      if (typePari.includes("SIMPLE_GAGNANT") && numPmu !== null) {
        result.simpleGagnant[numPmu] = rapportValue;
      }

      if (typePari.includes("SIMPLE_PLACE") && numPmu !== null) {
        result.simplePlace[numPmu] = rapportValue;
      }

      if (typePari.includes("COUPLE_GAGNANT") && combinaisonKey) {
        result.coupleGagnant[combinaisonKey] = rapportValue;
      }

      if (typePari.includes("COUPLE_PLACE") && combinaisonKey) {
        result.couplePlace[combinaisonKey] = rapportValue;
      }
    }
  }

  return result;
}

export async function getDefinitiveRapports(
  dateStr: string,
  reunion: number,
  course: number
) {
  return getFinalReports(dateStr, reunion, course);
}
