import { getTodayDateStr as getTodayDateStrFromUtils, toIsoDate } from "@/lib/date-utils";
import { isValidPmuDate } from "@/lib/request-utils";
import { logger } from "@/lib/server-logger";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type {
  LiveCourseSnapshot,
  Participant,
  PredictionRow,
  RaceSummary,
  RunnerFeatureSnapshotRow,
  SignalVariation,
} from "@/lib/types";

const BASE_URL = "https://online.turfinfo.api.pmu.fr/rest/client/1";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_REVALIDATE_SECONDS = 300;
const PMU_RETRY_ATTEMPTS = 3;

export type LiveOddsDetails = {
  numero: number;
  cote: number;
  typePari: string;
  source: "PMU_PARTICIPANTS" | "PMU_MASSE_ENJEUX";
  updatedAtMs: number | null;
  updatedAt: string | null;
};

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
  const parsedOrdreArrivee =
    typeof raw.ordreArrivee === "number" || typeof raw.ordreArrivee === "string"
      ? Number(raw.ordreArrivee)
      : null;
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
      parsedOrdreArrivee !== null && Number.isInteger(parsedOrdreArrivee) && parsedOrdreArrivee > 0
        ? parsedOrdreArrivee
        : null,
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

function uniqueLatestByHorse<T extends { cheval_num: number; created_at?: string }>(rows: T[]) {
  const byHorse = new Map<number, T>();

  for (const row of rows) {
    const current = byHorse.get(row.cheval_num);
    if (!current || (row.created_at ?? "") > (current.created_at ?? "")) {
      byHorse.set(row.cheval_num, row);
    }
  }

  return [...byHorse.values()].sort((left, right) => left.cheval_num - right.cheval_num);
}

function participantFromFeatureSnapshot(row: RunnerFeatureSnapshotRow) {
  const payload = asRecord(row.payload);
  const participant = asRecord(payload.participant);
  return mapParticipant({
    ...participant,
    numPmu: row.cheval_num,
    nom: row.cheval_nom,
    statut: participant.statut ?? "PARTANT",
  });
}

function participantFromPrediction(row: PredictionRow) {
  return mapParticipant({
    numPmu: row.cheval_num,
    nom: row.cheval_nom,
    cotePmu: row.cote_depart ?? row.cote_matin ?? null,
    coteMatin: row.cote_matin ?? null,
    coteDepart: row.cote_depart ?? null,
    variationCote: row.variation_cote ?? null,
    signalVariation: row.signal_variation ?? null,
    ordreArrivee:
      row.resultat_gagnant || row.resultat_place
        ? row.resultat_gagnant
          ? 1
          : 3
        : null,
    statut: row.non_partant ? "NON_PARTANT" : "PARTANT",
  });
}

async function getStoredParticipantsFallback(
  dateStr: string,
  reunion: number,
  course: number
) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return [] as Participant[];
  }

  const isoDate = toIsoDate(dateStr);
  const { data: featureData, error: featureError } = await admin
    .from("runner_feature_snapshots")
    .select("*")
    .eq("date", isoDate)
    .eq("reunion", reunion)
    .eq("course", course)
    .order("created_at", { ascending: false })
    .limit(300);

  if (!featureError) {
    const featureRows = uniqueLatestByHorse(
      ((featureData ?? []) as RunnerFeatureSnapshotRow[]).filter((row) => row.cheval_num > 0)
    );
    if (featureRows.length > 0) {
      return featureRows.map(participantFromFeatureSnapshot);
    }
  } else {
    logger.warn("pmu_api.participants_feature_fallback_unavailable", {
      dateStr,
      reunion,
      course,
      error: featureError.message,
    });
  }

  const { data: predictionData, error: predictionError } = await admin
    .from("predictions")
    .select("*")
    .eq("date", isoDate)
    .eq("reunion", reunion)
    .eq("course", course)
    .order("cheval_num", { ascending: true });

  if (predictionError) {
    logger.warn("pmu_api.participants_prediction_fallback_unavailable", {
      dateStr,
      reunion,
      course,
      error: predictionError.message,
    });
    return [];
  }

  const predictionRows = uniqueLatestByHorse(
    ((predictionData ?? []) as PredictionRow[]).filter((row) => row.cheval_num > 0)
  );
  return predictionRows.map(participantFromPrediction);
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
    const fallback = await getStoredParticipantsFallback(dateStr, reunion, course);
    if (fallback.length > 0) {
      logger.warn("pmu_api.participants_fallback_supabase", {
        dateStr,
        reunion,
        course,
        participants: fallback.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return fallback;
    }
    throw error;
  }
  const participants = ((data.participants ?? []) as Record<string, unknown>[])
    .filter((participant) => String(participant.statut ?? "PARTANT") !== "SUPPRIME")
    .map(mapParticipant);

  if (participants.length > 0) {
    return participants;
  }

  const fallback = await getStoredParticipantsFallback(dateStr, reunion, course);
  if (fallback.length > 0) {
    logger.warn("pmu_api.participants_empty_fallback_supabase", {
      dateStr,
      reunion,
      course,
      participants: fallback.length,
    });
    return fallback;
  }

  return participants;
}

export async function getRealtimeOdds(
  dateStr: string,
  reunion: number,
  course: number
): Promise<Record<number, number>> {
  const cotes = await getCotesDirectes(dateStr, reunion, course);
  return cotes ? Object.fromEntries(cotes.entries()) : {};
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

export type CourseRapports = Pick<FinalReports, "simpleGagnant" | "simplePlace">;

function normalizePmuMoneyValue(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return value > 100 ? value / 100 : value;
}

function getHorseNumberFromRecord(record: Record<string, unknown>) {
  const candidate =
    record.numPmu ??
    record.numero ??
    record.numeroCheval ??
    record.numCheval ??
    record.num ??
    record.cheval_num ??
    null;
  const parsed = typeof candidate === "number" ? candidate : Number(candidate);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getArrivalOrderFromRecord(record: Record<string, unknown>, fallback: number) {
  const candidate =
    record.ordreArrivee ??
    record.position ??
    record.rang ??
    record.ordre ??
    record.place ??
    fallback;
  const parsed = typeof candidate === "number" ? candidate : Number(candidate);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getOddsFromRecord(record: Record<string, unknown>) {
  const coteDirect = asRecord(record.coteDirect);
  const dernierRapportDirect = asRecord(record.dernierRapportDirect);
  const rapportDirect = asRecord(record.rapportDirect);
  return normalizePmuMoneyValue(
    record.cote ??
      record.cotePmu ??
      record.coteActuelle ??
      record.coteProbable ??
      coteDirect.cotePmu ??
      coteDirect.cote ??
      dernierRapportDirect.rapport ??
        rapportDirect.rapport
    );
  }

function getParisTimeLabel(ms: unknown) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) {
    return null;
  }

  return new Date(ms).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getLiveOddsDetailsFromParticipant(record: Record<string, unknown>): LiveOddsDetails | null {
  const numero = getHorseNumberFromRecord(record);
  if (numero === null) return null;

  const dernierRapportDirect = asRecord(record.dernierRapportDirect);
  const cote = normalizePmuMoneyValue(
    dernierRapportDirect.rapport ??
      asRecord(record.coteDirect).cotePmu ??
      asRecord(record.rapportDirect).rapport ??
      record.cotePmu
  );
  if (cote === null || cote <= 0) return null;

  const updatedAtMs =
    typeof dernierRapportDirect.dateRapport === "number" &&
    Number.isFinite(dernierRapportDirect.dateRapport)
      ? dernierRapportDirect.dateRapport
      : null;

  return {
    numero,
    cote,
    typePari:
      typeof dernierRapportDirect.typePari === "string"
        ? dernierRapportDirect.typePari
        : "SIMPLE_GAGNANT",
    source: "PMU_PARTICIPANTS",
    updatedAtMs,
    updatedAt: getParisTimeLabel(updatedAtMs),
  };
}

function buildArriveeFromParticipants(participants: Participant[]) {
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

function collectRecords(value: unknown, records: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectRecords(item, records);
    return records;
  }

  if (typeof value !== "object" || value === null) {
    return records;
  }

  const record = value as Record<string, unknown>;
  records.push(record);
  for (const child of Object.values(record)) {
    if (typeof child === "object" && child !== null) {
      collectRecords(child, records);
    }
  }
  return records;
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

export async function getArriveeCourse(
  dateStr: string,
  reunion: number,
  course: number
): Promise<number[] | null> {
  try {
    if (!isValidPmuDate(dateStr)) return null;
    const data = await fetchPmuJson<Record<string, unknown> | unknown[]>(
      `/programme/${dateStr}/R${reunion}/C${course}/arrivee`,
      10
    );
    console.log("[pmu-api.getArriveeCourse] raw arrivee", { dateStr, reunion, course, data });
    const rawSource = Array.isArray(data)
      ? data
      : ((data.arrivee ??
          data.arrivees ??
          data.classement ??
          data.resultat ??
          data.resultats ??
          data.ordreArrivee ??
          data.participants ??
          []) as unknown[]);
    const source = Array.isArray(rawSource) ? rawSource : collectRecords(rawSource);
    if (!Array.isArray(source) || source.length === 0) {
      return buildArriveeFromParticipants(await getParticipants(dateStr, reunion, course));
    }

    const arrivee = source
      .map((item, index) => {
        if (typeof item === "number") {
          return { numero: item, ordre: index + 1 };
        }
        const record = asRecord(item);
        const numero = getHorseNumberFromRecord(record);
        return numero === null
          ? null
          : { numero, ordre: getArrivalOrderFromRecord(record, index + 1) };
      })
      .filter((item): item is { numero: number; ordre: number } => item !== null)
      .sort((left, right) => left.ordre - right.ordre)
      .map((item) => item.numero);

    return arrivee.length > 0
      ? arrivee
      : buildArriveeFromParticipants(await getParticipants(dateStr, reunion, course));
  } catch (error) {
    console.log("[pmu-api.getArriveeCourse] arrivee endpoint failed, fallback participants", {
      dateStr,
      reunion,
      course,
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      return buildArriveeFromParticipants(await getParticipants(dateStr, reunion, course));
    } catch {
      return null;
    }
  }
}

export async function getRapportsCourse(
  dateStr: string,
  reunion: number,
  course: number
): Promise<CourseRapports | null> {
  try {
    const reports = await getFinalReports(dateStr, reunion, course);
    return {
      simpleGagnant: reports.simpleGagnant,
      simplePlace: reports.simplePlace,
    };
  } catch {
    return null;
  }
}

export async function getCotesDirectes(
  dateStr: string,
  reunion: number,
  course: number
): Promise<Map<number, number> | null> {
  const details = await getCotesDirectesAvecDetails(dateStr, reunion, course);
  if (!details) return null;

  return new Map([...details.entries()].map(([numero, detail]) => [numero, detail.cote]));
}

export async function getCotesDirectesAvecDetails(
  dateStr: string,
  reunion: number,
  course: number
): Promise<Map<number, LiveOddsDetails> | null> {
  const getParticipantOdds = async () => {
    if (!isValidPmuDate(dateStr)) return null;
    const data = await fetchPmuJson<{ participants?: unknown[] }>(
      `/programme/${dateStr}/R${reunion}/C${course}/participants`,
      5
    );
    const cotes = new Map<number, LiveOddsDetails>();

    for (const raw of data.participants ?? []) {
      const detail = getLiveOddsDetailsFromParticipant(asRecord(raw));
      if (detail) {
        cotes.set(detail.numero, detail);
      }
    }

    return cotes.size > 0 ? cotes : null;
  };

  const participantOdds = await getParticipantOdds().catch((error) => {
    logger.warn("pmu_api.participant_odds_unavailable", {
      dateStr,
      reunion,
      course,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });
  if (participantOdds) {
    return participantOdds;
  }

  try {
    if (!isValidPmuDate(dateStr)) return null;
    const data = await fetchPmuJson<Record<string, unknown> | unknown[]>(
      `/programme/${dateStr}/R${reunion}/C${course}/masse-enjeux/direct`,
      5
    );
    const cotes = new Map<number, LiveOddsDetails>();
    for (const record of collectRecords(data)) {
      const numero = getHorseNumberFromRecord(record);
      const cote = getOddsFromRecord(record);
      if (numero !== null && cote !== null) {
        cotes.set(numero, {
          numero,
          cote,
          typePari:
            typeof record.typePari === "string" ? record.typePari : "SIMPLE_GAGNANT",
          source: "PMU_MASSE_ENJEUX",
          updatedAtMs: null,
          updatedAt: null,
        });
      }
    }
    return cotes.size > 0 ? cotes : null;
  } catch (error) {
    logger.warn("pmu_api.direct_odds_unavailable", {
      dateStr,
      reunion,
      course,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
