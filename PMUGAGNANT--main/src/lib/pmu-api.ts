import { getTodayDateStr as getTodayDateStrFromUtils, toIsoDate } from "@/lib/date-utils";
import { isValidPmuDate } from "@/lib/request-utils";
import { logger } from "@/lib/server-logger";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type {
  LiveCourseSnapshot,
  Participant,
  RaceSummary,
  SignalVariation,
} from "@/lib/types";

const BASE_URL = "https://online.turfinfo.api.pmu.fr/rest/client/1";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_REVALIDATE_SECONDS = 300;
const PMU_RETRY_ATTEMPTS = 3;

class RetryablePmuError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryablePmuError";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryablePmuError(error: unknown) {
  return (
    error instanceof RetryablePmuError ||
    (error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.includes("fetch failed") ||
        error.message.includes("ECONNRESET") ||
        error.message.includes("ETIMEDOUT")))
  );
}

async function fetchPmuJson<T>(path: string, revalidate = 60): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= PMU_RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        next: { revalidate: Math.max(0, Math.min(MAX_REVALIDATE_SECONDS, revalidate)) },
        headers: {
          Accept: "application/json",
          "User-Agent": "pmu-ai-v92/1.0",
        },
        signal: controller.signal,
      } as RequestInit);

      if (!response.ok) {
        const message = `PMU API error: ${response.status} ${response.statusText} (${path})`;
        if (response.status === 429 || response.status >= 500) {
          throw new RetryablePmuError(message);
        }
        throw new Error(message);
      }

      const text = await response.text();
      if (!text.trim()) {
        return {} as T;
      }

      return JSON.parse(text) as T;
    } catch (error) {
      lastError = error;
      if (attempt >= PMU_RETRY_ATTEMPTS || !isRetryablePmuError(error)) {
        logger.error("pmu_api.fetch_failed", error, { path, attempt });
        throw error;
      }

      logger.warn("pmu_api.fetch_retry", {
        path,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(300 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`PMU API error (${path})`);
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

function hasQuinteOffer(course: Record<string, unknown>) {
  if (Boolean(course.grandPrixNationalTrot)) {
    return true;
  }

  const categorieParticularite = String(course.categorieParticularite ?? "").toUpperCase();
  if (categorieParticularite.includes("QUINTE")) {
    return true;
  }

  const paris = Array.isArray(course.paris) ? (course.paris as Record<string, unknown>[]) : [];
  if (
    paris.some((pari) => {
      const pariType = String(pari.typePari ?? pari.codePari ?? "").toUpperCase();
      return pariType.includes("QUINTE") || pari.nouveauQuinte === true;
    })
  ) {
    return true;
  }

  const cagnottes = Array.isArray(course.cagnottes)
    ? (course.cagnottes as Record<string, unknown>[])
    : [];

  return cagnottes.some((cagnotte) =>
    String(cagnotte.typePari ?? cagnotte.codePari ?? "").toUpperCase().includes("QUINTE")
  );
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

function getNumericCandidate(raw: Record<string, unknown>, candidates: string[]) {
  for (const candidate of candidates) {
    const value = raw[candidate];
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
  }

  return null;
}

function normalizePercentValue(value: number | null) {
  if (value === null) return null;
  if (value > 1) return value / 100;
  if (value < 0) return null;
  return value;
}

function getNestedNumeric(
  raw: Record<string, unknown>,
  sectionKey: string,
  candidates: string[]
) {
  const section = raw[sectionKey] as Record<string, unknown> | undefined;
  if (!section) return null;
  return getNumericCandidate(section, candidates);
}

function getDaysSinceLastRun(raw: Record<string, unknown>) {
  const direct = getNumericCandidate(raw, [
    "joursDepuisDerniereCourse",
    "joursRepos",
    "delaiDepuisDerniereCourse",
  ]);
  if (direct !== null) {
    return direct;
  }

  const dateCandidate = [
    raw.dateDerniereCourse,
    raw.derniereCourseDate,
    raw.dateLastRun,
  ].find((value) => typeof value === "string");

  if (!dateCandidate || typeof dateCandidate !== "string") {
    return null;
  }

  const parsed = new Date(dateCandidate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const diffDays = Math.round((Date.now() - parsed.getTime()) / 86_400_000);
  return diffDays >= 0 ? diffDays : null;
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
  const jockeyWinRate = normalizePercentValue(
    getNumericCandidate(raw, ["tauxVictoireJockey", "jockeyWinRate"]) ??
      getNestedNumeric(raw, "statistiquesJockey", ["tauxVictoire", "winRate"])
  );
  const jockeyRecentForm = normalizePercentValue(
    getNumericCandidate(raw, ["formeRecenteJockey", "jockeyRecentForm"]) ??
      getNestedNumeric(raw, "statistiquesJockey", ["formeRecente", "recentForm"])
  );
  const trainerTrackWinRate = normalizePercentValue(
    getNumericCandidate(raw, ["tauxVictoireEntraineurHippodrome", "trainerTrackWinRate"]) ??
      getNestedNumeric(raw, "statistiquesEntraineur", ["tauxVictoireHippodrome", "trackWinRate"])
  );
  const distanceWinRate = normalizePercentValue(
    getNumericCandidate(raw, ["tauxVictoireDistance", "distanceWinRate"]) ??
      getNestedNumeric(raw, "statistiquesDistance", ["tauxVictoire", "winRate"])
  );
  const distancePlaceRate = normalizePercentValue(
    getNumericCandidate(raw, ["tauxPlaceDistance", "distancePlaceRate"]) ??
      getNestedNumeric(raw, "statistiquesDistance", ["tauxPlace", "placeRate"])
  );
  const trackWinRate = normalizePercentValue(
    getNumericCandidate(raw, ["tauxVictoireHippodrome", "trackWinRate"]) ??
      getNestedNumeric(raw, "statistiquesHippodrome", ["tauxVictoire", "winRate"])
  );
  const trackPlaceRate = normalizePercentValue(
    getNumericCandidate(raw, ["tauxPlaceHippodrome", "trackPlaceRate"]) ??
      getNestedNumeric(raw, "statistiquesHippodrome", ["tauxPlace", "placeRate"])
  );
  const terrainWinRate = normalizePercentValue(
    getNumericCandidate(raw, ["tauxVictoireTerrain", "terrainWinRate"]) ??
      getNestedNumeric(raw, "statistiquesTerrain", ["tauxVictoire", "winRate"])
  );
  const terrainPlaceRate = normalizePercentValue(
    getNumericCandidate(raw, ["tauxPlaceTerrain", "terrainPlaceRate"]) ??
      getNestedNumeric(raw, "statistiquesTerrain", ["tauxPlace", "placeRate"])
  );
  const terrainPreference =
    typeof raw.preferenceTerrain === "string"
      ? String(raw.preferenceTerrain)
      : typeof raw.terrainFavori === "string"
        ? String(raw.terrainFavori)
        : null;
  const meteoPreference =
    typeof raw.preferenceMeteo === "string"
      ? String(raw.preferenceMeteo)
      : typeof raw.meteoFavorite === "string"
        ? String(raw.meteoFavorite)
        : null;

  return {
    numPmu: Number(raw.numPmu ?? 0),
    nom: String(raw.nom ?? ""),
    driver: String(raw.driver ?? raw.driverPrincipal ?? ""),
    entraineur: String(raw.entraineur ?? raw.entraineurPrincipal ?? ""),
    jockey: String(raw.jockey ?? raw.jockeyPrincipal ?? raw.driver ?? ""),
    proprietaire: String(raw.proprietaire ?? raw.proprietairePrincipal ?? raw.owner ?? ""),
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
    jockeyWinRate,
    jockeyRecentForm,
    trainerTrackWinRate,
    distanceWinRate,
    distancePlaceRate,
    trackWinRate,
    trackPlaceRate,
    terrainWinRate,
    terrainPlaceRate,
    terrainPreference,
    meteoPreference,
    daysSinceLastRun: getDaysSinceLastRun(raw),
  };
}

export function getTodayDateStr(): string {
  return getTodayDateStrFromUtils();
}

function isEligiblePmuReunion(reunion: Record<string, unknown>) {
  const pays = String(
    ((reunion.pays as Record<string, unknown> | undefined)?.code as string) ?? ""
  ).toUpperCase();

  // On garde uniquement le périmètre PMU France pour éviter
  // que des réunions étrangères (DEU, ARG, URY, etc.) alimentent
  // l'accueil, le scoring et les sélections du jour.
  return pays === "FRA";
}

export function isEligiblePmuFranceRace(race: Pick<RaceSummary, "pays"> | null | undefined) {
  return String(race?.pays ?? "").toUpperCase() === "FRA";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

async function getStoredRaces(dateStr: string): Promise<RaceSummary[]> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return [];
  }

  const isoDate = toIsoDate(dateStr);
  const { data, error } = await admin
    .from("courses")
    .select("*")
    .eq("date", isoDate)
    .order("heure_depart", { ascending: true });

  if (error) {
    logger.warn("pmu_api.fallback_courses_unavailable", { error: error.message, dateStr });
    return [];
  }

  return ((data ?? []) as unknown[]).map((row) => {
    const record = asRecord(row);
    const discipline = asString(record.discipline);
    const nomCourse = asString(record.nom_course);
    return {
      dateStr,
      reunion: asNumber(record.reunion),
      course: asNumber(record.course),
      hippodrome: asString(record.hippodrome),
      pays: "FRA",
      nomCourse,
      heureDepart: asString(record.heure_depart),
      discipline,
      estTrot: Boolean(record.est_trot) || discipline.includes("TROT"),
      estPlat: Boolean(record.est_plat) || discipline === "PLAT",
      estQuinte:
        Boolean(record.est_quinte) ||
        nomCourse
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toUpperCase()
          .includes("QUINTE"),
      allocation: asNumber(record.allocation),
      distance: asNumber(record.distance),
      nombrePartants: asNumber(record.nombre_partants),
      terrain: asString(record.terrain, "") || null,
      meteo: asString(record.meteo, "") || null,
    };
  });
}

async function getStoredParticipants(
  dateStr: string,
  reunion: number,
  course: number
): Promise<Participant[]> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return [];
  }

  const { data, error } = await admin
    .from("runners")
    .select("*")
    .eq("race_date", toIsoDate(dateStr))
    .eq("reunion", reunion)
    .eq("course", course)
    .order("cheval_num", { ascending: true });

  if (error) {
    logger.warn("pmu_api.fallback_runners_unavailable", {
      error: error.message,
      dateStr,
      reunion,
      course,
    });
    return [];
  }

  return ((data ?? []) as unknown[]).map((row) => {
    const record = asRecord(row);
    return {
      numPmu: asNumber(record.cheval_num),
      nom: asString(record.cheval_nom),
      driver: asString(record.driver),
      entraineur: asString(record.entraineur),
      jockey: asString(record.jockey),
      age: asNumber(record.age),
      sexe: asString(record.sexe),
      cote: asNullableNumber(record.cote),
      coteMatin: asNullableNumber(record.cote_matin),
      coteDepart: asNullableNumber(record.cote),
      musique: asString(record.musique),
      nombreCourses: 0,
      nombreVictoires: 0,
      nombrePlaces: 0,
      gainCarriere: 0,
      nombreSuiveurs: 0,
      ordreArrivee: null,
      statut: asString(record.statut, "PARTANT"),
      nonPartant: Boolean(record.non_partant),
    };
  });
}

export async function getAllRaces(dateStr?: string): Promise<RaceSummary[]> {
  const date = dateStr ?? getTodayDateStr();
  if (!isValidPmuDate(date)) {
    throw new Error(`Invalid PMU date format: ${date}`);
  }

  let data: Record<string, unknown>;
  try {
    data = await fetchPmuJson<Record<string, unknown>>(`/programme/${date}`);
  } catch (error) {
    const fallback = await getStoredRaces(date);
    if (fallback.length > 0) {
      logger.warn("pmu_api.programme_fallback_supabase", {
        date,
        races: fallback.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return fallback;
    }
    throw error;
  }
  const reunions = ((data.programme as Record<string, unknown> | undefined)?.reunions ??
    []) as Record<string, unknown>[];

  const races: RaceSummary[] = [];

  for (const reunion of reunions) {
    if (!isEligiblePmuReunion(reunion)) {
      continue;
    }

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
        estQuinte: hasQuinteOffer(course),
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
  return races.filter(isEligiblePmuFranceRace);
}

export async function getParticipants(
  dateStr: string,
  reunion: number,
  course: number
): Promise<Participant[]> {
  if (!isValidPmuDate(dateStr)) {
    throw new Error(`Invalid PMU date format: ${dateStr}`);
  }

  if (!Number.isInteger(reunion) || reunion <= 0 || !Number.isInteger(course) || course <= 0) {
    throw new Error(`Invalid race identifier: R${reunion}C${course}`);
  }

  let data: Record<string, unknown>;
  try {
    data = await fetchPmuJson<Record<string, unknown>>(
      `/programme/${dateStr}/R${reunion}/C${course}/participants`
    );
  } catch (error) {
    const fallback = await getStoredParticipants(dateStr, reunion, course);
    if (fallback.length > 0) {
      logger.warn("pmu_api.participants_fallback_supabase", {
        dateStr,
        reunion,
        course,
        runners: fallback.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return fallback;
    }
    throw error;
  }
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
  } catch (error) {
    logger.warn("pmu_api.realtime_odds_unavailable", {
      dateStr,
      reunion,
      course,
      error: error instanceof Error ? error.message : String(error),
    });
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
  } catch (error) {
    logger.warn("pmu_api.live_snapshot_unavailable", {
      dateStr,
      reunion,
      course,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      coteActuelleByHorse: {},
      nonPartants: [],
      ferrureChanges: {},
    };
  }
}

export interface FinalReports {
  simpleGagnant: Record<number, number>;
  simplePlace: Record<number, number>;
  coupleGagnant: Record<string, number>;
  couplePlace: Record<string, number>;
  trio: Record<string, number>;
  quinteOrdre: Record<string, number>;
  quinteDesordre: Record<string, number>;
  multi: Record<string, number>;
  generic: Record<string, Record<string, number>>;
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
  if (!isValidPmuDate(dateStr)) {
    throw new Error(`Invalid PMU date format: ${dateStr}`);
  }

  const data = await fetchPmuJson<Record<string, unknown> | Record<string, unknown>[]>(
    `/programme/${dateStr}/R${reunion}/C${course}/rapports-definitifs`,
    30
  );
  const rapports = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : ((data.rapports ?? []) as Record<string, unknown>[]);

  const result: FinalReports = {
    simpleGagnant: {},
    simplePlace: {},
    coupleGagnant: {},
    couplePlace: {},
    trio: {},
    quinteOrdre: {},
    quinteDesordre: {},
    multi: {},
    generic: {},
  };

  for (const rapport of rapports) {
    const typePari = String(rapport.typePari ?? "");
    const combinaisons =
      ((rapport.rapports ?? rapport.combinaisons ?? []) as Record<string, unknown>[]) ?? [];

    for (const combinaison of combinaisons) {
      const rawRapport =
        typeof combinaison.dividendePourUnEuro === "number"
          ? (combinaison.dividendePourUnEuro as number)
          : typeof combinaison.dividende === "number"
            ? (combinaison.dividende as number)
            : typeof combinaison.rapport === "number"
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
          : typeof combinaison.combinaison === "string" && !String(combinaison.combinaison).includes("-")
            ? Number(combinaison.combinaison)
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

      if (typePari.includes("TRIO") && combinaisonKey) {
        result.trio[combinaisonKey] = rapportValue;
      }

      if (typePari.includes("QUINTE_ORDRE") && combinaisonKey) {
        result.quinteOrdre[combinaisonKey] = rapportValue;
      }

      if (
        (typePari.includes("QUINTE_DESORDRE") || typePari.includes("QUINTE_BONUS")) &&
        combinaisonKey
      ) {
        result.quinteDesordre[combinaisonKey] = rapportValue;
      }

      if (typePari.includes("MULTI") && combinaisonKey) {
        result.multi[combinaisonKey] = rapportValue;
      }

      if (combinaisonKey) {
        if (!result.generic[typePari]) {
          result.generic[typePari] = {};
        }
        result.generic[typePari][combinaisonKey] = rapportValue;
      } else if (numPmu !== null) {
        if (!result.generic[typePari]) {
          result.generic[typePari] = {};
        }
        result.generic[typePari][String(numPmu)] = rapportValue;
      }
    }
  }

  return result;
}
