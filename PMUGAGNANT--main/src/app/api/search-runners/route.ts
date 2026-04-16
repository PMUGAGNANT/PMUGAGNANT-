import { NextRequest, NextResponse } from "next/server";

import { badRequest, serviceUnavailable } from "@/lib/api-response";
import {
  getAllRaces,
  getParticipants,
  getTodayDateStr,
  isEligiblePmuFranceRace,
} from "@/lib/pmu-api";
import { isValidPmuDate } from "@/lib/request-utils";
import { logger } from "@/lib/server-logger";
import type { Participant, RaceSummary } from "@/lib/types";

export const revalidate = 300;

type SearchRunnerType = "numero" | "jockey" | "driver" | "entraineur" | "cheval";

type SearchRunnerEntry = {
  reunion: number;
  course: number;
  hippodrome: string;
  nomCourse: string;
  heureDepart: string;
  discipline: string;
  cheval: string;
  numPmu: number;
  cote: number | null;
  nombrePartants: number;
};

type SearchRunnerGroup = {
  type: SearchRunnerType;
  name: string;
  entries: SearchRunnerEntry[];
  totalEntries: number;
};

type SearchIndexRow = {
  type: SearchRunnerType;
  name: string;
  normalizedName: string;
  entry: SearchRunnerEntry;
};

type CacheValue = {
  expiresAt: number;
  rows?: SearchIndexRow[];
  promise?: Promise<SearchIndexRow[]>;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

const searchCache = (
  globalThis as typeof globalThis & {
    __pmuSearchRunnersCache__?: Map<string, CacheValue>;
  }
).__pmuSearchRunnersCache__ ??= new Map<string, CacheValue>();

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildEntry(race: RaceSummary, participant: Participant): SearchRunnerEntry {
  return {
    reunion: race.reunion,
    course: race.course,
    hippodrome: race.hippodrome,
    nomCourse: race.nomCourse,
    heureDepart: race.heureDepart,
    discipline: race.discipline,
    cheval: participant.nom,
    numPmu: participant.numPmu,
    cote: participant.cote ?? null,
    nombrePartants: race.nombrePartants,
  };
}

function buildIndexRows(race: RaceSummary, participant: Participant) {
  const entry = buildEntry(race, participant);
  const fields: Array<{ type: SearchRunnerType; value: string }> = [
    { type: "numero", value: String(participant.numPmu) },
    { type: "driver", value: participant.driver },
    { type: "jockey", value: participant.jockey },
    { type: "entraineur", value: participant.entraineur },
    { type: "cheval", value: participant.nom },
  ];

  return fields.flatMap(({ type, value }) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    return [
      {
        type,
        name: trimmed,
        normalizedName: normalize(trimmed),
        entry,
      } satisfies SearchIndexRow,
    ];
  });
}

function sortEntries(left: SearchRunnerEntry, right: SearchRunnerEntry) {
  return (
    (left.heureDepart || "").localeCompare(right.heureDepart || "") ||
    left.reunion - right.reunion ||
    left.course - right.course ||
    left.numPmu - right.numPmu
  );
}

function sortGroups(left: SearchRunnerGroup, right: SearchRunnerGroup) {
  return (
    right.totalEntries - left.totalEntries ||
    left.name.localeCompare(right.name, "fr", { sensitivity: "base" })
  );
}

async function buildDateIndex(dateStr: string) {
  const races = (await getAllRaces(dateStr)).filter(isEligiblePmuFranceRace);

  if (races.length === 0) {
    return [];
  }

  const settled = await Promise.allSettled(
    races.map(async (race) => {
      const participants = await getParticipants(dateStr, race.reunion, race.course);
      return participants.flatMap((participant) => buildIndexRows(race, participant));
    })
  );

  let rejectedCount = 0;
  const rows: SearchIndexRow[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      rows.push(...result.value);
      return;
    }

    rejectedCount += 1;
    const race = races[index];
    logger.warn("search_runners.participants_unavailable", {
      dateStr,
      reunion: race?.reunion,
      course: race?.course,
      error:
        result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
  });

  if (rejectedCount === settled.length && settled.length > 0) {
    throw new Error("Impossible de récupérer les participants du jour.");
  }

  return rows;
}

async function getCachedDateIndex(dateStr: string) {
  const now = Date.now();
  const cached = searchCache.get(dateStr);

  if (cached?.rows && cached.expiresAt > now) {
    return cached.rows;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = buildDateIndex(dateStr)
    .then((rows) => {
      searchCache.set(dateStr, {
        rows,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return rows;
    })
    .catch((error) => {
      searchCache.delete(dateStr);
      throw error;
    });

  searchCache.set(dateStr, {
    expiresAt: 0,
    rows: cached?.rows,
    promise,
  });

  return promise;
}

function buildResults(rows: SearchIndexRow[], query: string) {
  const normalizedQuery = normalize(query);
  const groups = new Map<
    string,
    {
      type: SearchRunnerType;
      name: string;
      entries: Map<string, SearchRunnerEntry>;
    }
  >();

  for (const row of rows) {
    if (!row.normalizedName.includes(normalizedQuery)) {
      continue;
    }

    const groupKey = `${row.type}:${row.normalizedName}`;
    const group =
      groups.get(groupKey) ??
      {
        type: row.type,
        name: row.name,
        entries: new Map<string, SearchRunnerEntry>(),
      };

    const entryKey = `${row.entry.reunion}-${row.entry.course}-${row.entry.numPmu}`;
    group.entries.set(entryKey, row.entry);
    groups.set(groupKey, group);
  }

  return [...groups.values()]
    .map((group) => {
      const entries = [...group.entries.values()].sort(sortEntries);
      return {
        type: group.type,
        name: group.name,
        entries,
        totalEntries: entries.length,
      } satisfies SearchRunnerGroup;
    })
    .sort(sortGroups);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const rawDate = request.nextUrl.searchParams.get("date");
  const dateStr = rawDate?.trim() || getTodayDateStr();

  if (!isValidPmuDate(dateStr)) {
    return badRequest("Le format de date PMU est invalide.", {
      query,
      date: dateStr,
    });
  }

  const isNumericQuery = /^\d+$/.test(query);

  if (query.length < 2 && !isNumericQuery) {
    return NextResponse.json(
      {
        success: true,
        query,
        date: dateStr,
        results: [],
        totalResults: 0,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=300",
        },
      }
    );
  }

  try {
    const rows = await getCachedDateIndex(dateStr);
    const results = buildResults(rows, query);

    return NextResponse.json(
      {
        success: true,
        query,
        date: dateStr,
        results,
        totalResults: results.length,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    logger.error("search_runners.failed", error, {
      query,
      dateStr,
    });

    return serviceUnavailable(
      "La recherche jockey / entraîneur / cheval est momentanément indisponible."
    );
  }
}
