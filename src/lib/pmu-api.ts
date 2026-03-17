import type { RaceSummary, Participant } from './types';

const BASE_URL = 'https://online.turfinfo.api.pmu.fr/rest/client/1';

type PmuProgrammeCourse = {
  heureDepart: number;
  discipline?: string;
  grandPrixNationalTrot?: boolean;
  categorieParticularite?: string;
  numOrdre: number;
  libelle?: string;
  libelleCourt?: string;
  montantTotalOffert?: number;
  distance?: number;
  nombreDeclaresPartants?: number;
};

type PmuProgrammeReunion = {
  numOfficiel: number;
  hippodrome?: { libelleCourt?: string };
  pays?: { code?: string };
  courses?: PmuProgrammeCourse[];
};

type PmuProgrammeResponse = {
  programme?: {
    reunions?: PmuProgrammeReunion[];
  };
};

type PmuParticipant = {
  statut?: string;
  numPmu: number;
  nom?: string;
  placeCorde?: number | null;
  poidsConditionMonte?: number | null;
  handicapPoids?: number | null;
  poids?: number | null;
  poidsTotal?: number | null;
  charge?: number | null;
  driver?: string;
  entraineur?: string;
  jockey?: string;
  age?: number;
  sexe?: string;
  coteDirect?: { cotePmu?: number | null };
  dernierRapportDirect?: { rapport?: number | null };
  musique?: string;
  nombreCourses?: number;
  nombreVictoires?: number;
  nombrePlaces?: number;
  gainsParticipant?: {
    gainsCarriere?: number;
    gainsAnneeEnCours?: number;
  };
  nombreIndicateursFavoris?: number;
  ordreArrivee?: number | null;
};

type PmuParticipantsResponse = {
  participants?: PmuParticipant[];
};

type PmuLegacyRapportCombinaison = {
  numPmu?: number;
  combinaison?: number[];
  rapport?: number | null;
};

type PmuLegacyRapport = {
  typePari?: string;
  combinaisons?: PmuLegacyRapportCombinaison[];
};

type PmuLegacyRapportsResponse = {
  rapports?: PmuLegacyRapport[];
};

type PmuDefinitiveRapportEntry = {
  combinaison?: string;
  dividendePourUnEuro?: number | null;
  dividendePourUneMiseDeBase?: number | null;
  dividendeUnite?: string;
};

type PmuDefinitiveRapport = {
  typePari?: string;
  rapports?: PmuDefinitiveRapportEntry[];
};

type PmuDefinitiveRapportsResponse = {
  value?: PmuDefinitiveRapport[];
};

export type DefinitiveRapportsMap = Record<string, Record<string, number>>;

function getParticipantWeightKg(participant: PmuParticipant): number | null {
  const rawWeight =
    participant.poidsConditionMonte ??
    participant.handicapPoids ??
    participant.poids ??
    participant.poidsTotal ??
    participant.charge ??
    null;

  if (rawWeight === null || rawWeight === undefined || Number.isNaN(rawWeight)) {
    return null;
  }

  // PMU payloads can expose either kilograms directly or decagrams/grams depending on feed.
  if (rawWeight > 200) {
    return Math.round((rawWeight / 10) * 10) / 10;
  }

  return Math.round(rawWeight * 10) / 10;
}

/**
 * Returns today's date as DDMMYYYY format.
 */
export function getTodayDateStr(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}${month}${year}`;
}

/**
 * Fetches all races for a given date from the PMU API.
 * Returns a flat, sorted array of RaceSummary.
 */
export async function getAllRaces(dateStr?: string): Promise<RaceSummary[]> {
  const date = dateStr ?? getTodayDateStr();
  const url = `${BASE_URL}/programme/${date}`;

  const res = await fetch(url, { next: { revalidate: 60 } } as RequestInit);
  if (!res.ok) {
    throw new Error(`PMU API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as PmuProgrammeResponse;
  const reunions = data?.programme?.reunions ?? [];

  const races: RaceSummary[] = [];

  for (const reunion of reunions) {
    const numOfficiel: number = reunion.numOfficiel;
    const hippodrome: string = reunion.hippodrome?.libelleCourt ?? '';
    const pays: string = reunion.pays?.code ?? '';
    const courses = reunion.courses ?? [];

    for (const course of courses) {
      const heureDepartMs: number = course.heureDepart;

      // Convert ms timestamp to HH:mm in Europe/Paris timezone
      const heureDepart = new Date(heureDepartMs).toLocaleTimeString('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const discipline: string = course.discipline ?? '';
      const estTrot = discipline.includes('TROT');
      const estPlat = discipline === 'PLAT';
      const estQuinte = Boolean(course.grandPrixNationalTrot) || course.categorieParticularite === 'QUINTE';

      races.push({
        dateStr: date,
        reunion: numOfficiel,
        course: course.numOrdre,
        hippodrome,
        pays,
        nomCourse: course.libelle || course.libelleCourt || '',
        heureDepart,
        discipline,
        estTrot,
        estPlat,
        estQuinte,
        allocation: course.montantTotalOffert ?? 0,
        distance: course.distance ?? 0,
        nombrePartants: course.nombreDeclaresPartants ?? 0,
      });
    }
  }

  // Sort by heureDepart (HH:mm string sort works correctly)
  races.sort((a, b) => a.heureDepart.localeCompare(b.heureDepart));

  return races;
}

/**
 * Fetches participants for a specific race from the PMU API.
 * Returns only participants with PARTANT status.
 */
export async function getParticipants(
  dateStr: string,
  reunion: number,
  course: number
): Promise<Participant[]> {
  const url = `${BASE_URL}/programme/${dateStr}/R${reunion}/C${course}/participants`;

  const res = await fetch(url, { next: { revalidate: 60 } } as RequestInit);
  if (!res.ok) {
    throw new Error(`PMU API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as PmuParticipantsResponse;
  const rawParticipants = data?.participants ?? [];

  const participants: Participant[] = rawParticipants
    .filter((p) => p.statut === 'PARTANT')
    .map((p) => {
      // Determine cote: prefer coteDirect.cotePmu, then dernierRapportDirect.rapport
      let cote: number | null = null;
      if (p.coteDirect?.cotePmu != null) {
        cote = p.coteDirect.cotePmu;
      } else if (p.dernierRapportDirect?.rapport != null) {
        cote = p.dernierRapportDirect.rapport;
      }

      // Sum career gains
      const gainsCarriere = (p.gainsParticipant?.gainsCarriere ?? 0) +
        (p.gainsParticipant?.gainsAnneeEnCours ?? 0);

      return {
        numPmu: p.numPmu,
        nom: p.nom ?? '',
        placeCorde: p.placeCorde ?? null,
        poids: getParticipantWeightKg(p),
        driver: p.driver ?? '',
        entraineur: p.entraineur ?? '',
        jockey: p.jockey ?? '',
        age: p.age ?? 0,
        sexe: p.sexe ?? '',
        cote,
        musique: p.musique ?? '',
        nombreCourses: p.nombreCourses ?? 0,
        nombreVictoires: p.nombreVictoires ?? 0,
        nombrePlaces: p.nombrePlaces ?? 0,
        gainCarriere: gainsCarriere,
        nombreSuiveurs: p.nombreIndicateursFavoris ?? 0,
        ordreArrivee: p.ordreArrivee ?? null,
        statut: p.statut ?? 'PARTANT',
      };
    });

  return participants;
}

/**
 * Fetches real-time odds for a specific race.
 * Returns a map of numPmu -> odds (PMU returns odds * 100, so we divide by 100).
 */
export async function getRealtimeOdds(
  dateStr: string,
  reunion: number,
  course: number
): Promise<Record<number, number>> {
  try {
    const data = await getDefinitiveRapports(dateStr, reunion, course);
    const odds: Record<number, number> = {};

    const simpleGagnantRapports = data.SIMPLE_GAGNANT ?? {};
    for (const [combinaison, rapport] of Object.entries(simpleGagnantRapports)) {
      const numPmu = Number.parseInt(combinaison, 10);
      if (Number.isFinite(numPmu)) {
        odds[numPmu] = rapport;
      }
    }

    return odds;
  } catch {
    return {};
  }
}

function normalizeRapportType(typePari: string | undefined): string | null {
  if (!typePari) return null;
  return typePari.replace(/^E_/, '');
}

function normalizeCombinaisonKey(rawCombinaison: string): string {
  return rawCombinaison
    .split('-')
    .map((part) => part.trim())
    .filter(Boolean)
    .sort((left, right) => Number(left) - Number(right))
    .join('-');
}

export async function getDefinitiveRapports(
  dateStr: string,
  reunion: number,
  course: number
): Promise<DefinitiveRapportsMap> {
  const url = `${BASE_URL}/programme/${dateStr}/R${reunion}/C${course}/rapports-definitifs`;

  const res = await fetch(url, { next: { revalidate: 60 } } as RequestInit);
  if (!res.ok) {
    throw new Error(`PMU API error: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as PmuDefinitiveRapportsResponse | PmuLegacyRapportsResponse;
  const definitiveRapports = 'value' in raw ? raw.value ?? [] : [];
  const legacyRapports = 'rapports' in raw ? raw.rapports ?? [] : [];
  const rapportsMap: DefinitiveRapportsMap = {};

  for (const rapport of definitiveRapports) {
    const typePari = normalizeRapportType(rapport.typePari);
    if (!typePari) continue;
    if (!rapportsMap[typePari]) {
      rapportsMap[typePari] = {};
    }

    for (const entry of rapport.rapports ?? []) {
      if (!entry.combinaison) continue;
      const rapportPour1Euro = entry.dividendePourUnEuro;
      if (rapportPour1Euro == null || !Number.isFinite(rapportPour1Euro)) continue;
      rapportsMap[typePari][normalizeCombinaisonKey(entry.combinaison)] = rapportPour1Euro / 100;
    }
  }

  for (const rapport of legacyRapports) {
    const typePari = normalizeRapportType(rapport.typePari);
    if (!typePari) continue;
    if (!rapportsMap[typePari]) {
      rapportsMap[typePari] = {};
    }

    for (const entry of rapport.combinaisons ?? []) {
      const combinaisonKey = entry.numPmu != null
        ? String(entry.numPmu)
        : entry.combinaison?.join('-');
      if (!combinaisonKey) continue;
      const rapportPour1Euro = entry.rapport;
      if (rapportPour1Euro == null || !Number.isFinite(rapportPour1Euro)) continue;
      rapportsMap[typePari][normalizeCombinaisonKey(combinaisonKey)] = rapportPour1Euro / 100;
    }
  }

  return rapportsMap;
}
