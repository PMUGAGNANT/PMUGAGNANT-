import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase";

type NormalizableRaceScore = {
  reunion: number;
  course: number;
};

type IndexedRaceScoreEntry<T extends object> =
  | T
  | Omit<T, keyof NormalizableRaceScore | "dateStr">;

export async function getBrowserAuthorizationHeader() {
  if (!hasSupabaseConfig()) {
    return undefined;
  }

  try {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeRaceScoresPayload<T extends object>(
  raw:
    | Array<(T & Partial<{ dateStr: string }> & NormalizableRaceScore)>
    | Record<string, IndexedRaceScoreEntry<T>>
    | null
    | undefined,
  dateStr: string
) {
  if (
    raw == null ||
    typeof raw === "string" ||
    typeof raw === "number" ||
    typeof raw === "boolean"
  ) {
    return [] as Array<T & NormalizableRaceScore & { dateStr: string }>;
  }

  if (Array.isArray(raw)) {
    return raw.flatMap((item) => {
      if (
        item == null ||
        typeof item.reunion !== "number" ||
        typeof item.course !== "number"
      ) {
        return [];
      }

      return [{
        ...item,
        dateStr,
      } as T & NormalizableRaceScore & { dateStr: string }];
    });
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

    return [{
      ...entry,
      dateStr,
      reunion,
      course,
    } as T & NormalizableRaceScore & { dateStr: string }];
  });
}

async function parseJsonOrThrow<T>(
  response: Response,
  fallbackMessage: string
): Promise<NonNullable<T>> {
  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const apiMessage =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : fallbackMessage;
    throw new Error(apiMessage);
  }

  if (payload == null) {
    throw new Error(fallbackMessage);
  }

  return payload as NonNullable<T>;
}

export async function fetchRacesForDate<T>(dateStr: string, signal?: AbortSignal) {
  const response = await fetch(`/api/races?date=${dateStr}`, {
    cache: "no-store",
    signal,
  });

  return parseJsonOrThrow<T>(response, "Impossible de charger le programme du jour.");
}

export async function fetchRaceScoresForDate<T>(
  dateStr: string,
  signal?: AbortSignal
) {
  const headers = await getBrowserAuthorizationHeader();
  const response = await fetch(`/api/races/scores?date=${dateStr}`, {
    cache: "no-store",
    signal,
    headers,
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

export async function fetchRaceDetails<T>(
  reunion: string | number,
  course: string | number,
  options?: {
    date?: string | null;
    signal?: AbortSignal;
  }
) {
  const url = new URL(`/api/race/${reunion}/${course}`, window.location.origin);
  if (options?.date) {
    url.searchParams.set("date", options.date);
  }

  const response = await fetch(url.toString(), {
    cache: "no-store",
    signal: options?.signal,
    headers: await getBrowserAuthorizationHeader(),
  });

  return parseJsonOrThrow<T>(response, "Impossible de charger cette course");
}
