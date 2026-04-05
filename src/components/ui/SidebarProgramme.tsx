"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { getMinutesUntilStart, getTodayDateStr } from "@/lib/date-utils";
import type { RaceSummary } from "@/lib/types";

type SidebarProgrammeTab = "courses" | "reunions";

type RacesResponse = {
  success: boolean;
  date: string;
  races?: RaceSummary[];
  error?: string;
};

type ReunionGroup = {
  reunion: number;
  hippodrome: string;
  firstRace: RaceSummary;
  count: number;
  firstTime: string;
  lastTime: string;
};

function normalizeDateParam(value: string | null) {
  return value && /^\d{8}$/.test(value) ? value : getTodayDateStr();
}

function sortRaces(items: RaceSummary[]) {
  return [...items].sort((a, b) => {
    const timeCompare = (a.heureDepart || "").localeCompare(b.heureDepart || "");
    if (timeCompare !== 0) {
      return timeCompare;
    }

    if (a.reunion !== b.reunion) {
      return a.reunion - b.reunion;
    }

    return a.course - b.course;
  });
}

function getDateLabel(dateStr: string) {
  const today = getTodayDateStr();
  if (dateStr === today) {
    return "Aujourd’hui";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateStr.slice(4, 8)}-${dateStr.slice(2, 4)}-${dateStr.slice(0, 2)}T12:00:00Z`));
}

function getRaceStatus(race: RaceSummary) {
  const minutes = getMinutesUntilStart(race.heureDepart, race.dateStr);
  if (minutes <= 0) {
    return "En cours";
  }
  if (minutes <= 45) {
    return `${Math.round(minutes)} min`;
  }
  return race.heureDepart;
}

function getReunionGroups(races: RaceSummary[]) {
  const map = new Map<number, RaceSummary[]>();

  for (const race of races) {
    const current = map.get(race.reunion) ?? [];
    current.push(race);
    map.set(race.reunion, current);
  }

  return [...map.entries()]
    .map(([reunion, entries]) => {
      const sorted = sortRaces(entries);
      return {
        reunion,
        hippodrome: sorted[0]?.hippodrome ?? `Réunion ${reunion}`,
        firstRace: sorted[0]!,
        count: sorted.length,
        firstTime: sorted[0]?.heureDepart ?? "--:--",
        lastTime: sorted.at(-1)?.heureDepart ?? "--:--",
      } satisfies ReunionGroup;
    })
    .sort((a, b) => a.firstTime.localeCompare(b.firstTime));
}

export function SidebarProgramme() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedDate = normalizeDateParam(searchParams.get("date"));

  const [tab, setTab] = useState<SidebarProgrammeTab>("courses");
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void fetch(`/api/races?date=${selectedDate}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as RacesResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Programme indisponible.");
        }

        setRaces(Array.isArray(payload.races) ? payload.races : []);
      })
      .catch((fetchError) => {
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          return;
        }

        setRaces([]);
        setError(fetchError instanceof Error ? fetchError.message : "Programme indisponible.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedDate]);

  const sortedRaces = useMemo(() => sortRaces(races).slice(0, 6), [races]);
  const reunionGroups = useMemo(() => getReunionGroups(races).slice(0, 6), [races]);

  const currentCourseKey = useMemo(() => {
    const match = pathname.match(/^\/course\/(\d+)\/(\d+)$/);
    if (!match) {
      return null;
    }

    return `${match[1]}-${match[2]}`;
  }, [pathname]);

  return (
    <section className="mt-4 rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="app-kicker text-[10px]">Programme rapide</p>
          <p className="mt-1 text-xs font-semibold text-[var(--pmu-text-soft)]">{getDateLabel(selectedDate)}</p>
        </div>
        <a
          href={selectedDate === getTodayDateStr() ? "/" : `/?date=${selectedDate}`}
          className="text-[11px] font-semibold text-[var(--pmu-text-muted)] transition hover:text-[var(--pmu-text)]"
        >
          Voir tout
        </a>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
            tab === "courses"
              ? "bg-[var(--pmu-surface-2)] text-[var(--pmu-text)]"
              : "text-[var(--pmu-text-muted)] hover:bg-[var(--pmu-surface-2)]"
          }`}
          onClick={() => setTab("courses")}
        >
          Courses
        </button>
        <button
          type="button"
          className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
            tab === "reunions"
              ? "bg-[var(--pmu-surface-2)] text-[var(--pmu-text)]"
              : "text-[var(--pmu-text-muted)] hover:bg-[var(--pmu-surface-2)]"
          }`}
          onClick={() => setTab("reunions")}
        >
          Réunions
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {loading
          ? Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)]"
              />
            ))
          : null}

        {!loading && error ? (
          <div className="rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-3 text-xs leading-5 text-[var(--pmu-text-soft)]">
            {error}
          </div>
        ) : null}

        {!loading && !error && tab === "courses" && sortedRaces.length === 0 ? (
          <div className="rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-3 text-xs leading-5 text-[var(--pmu-text-soft)]">
            Aucune course chargée pour cette journée.
          </div>
        ) : null}

        {!loading && !error && tab === "courses"
          ? sortedRaces.map((race) => {
              const raceKey = `${race.reunion}-${race.course}`;
              const active = currentCourseKey === raceKey;
              return (
                <button
                  key={`${race.dateStr}-${raceKey}`}
                  type="button"
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-[var(--pmu-primary)] bg-[var(--pmu-primary-soft)]"
                      : "border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] hover:border-[var(--pmu-border-strong)]"
                  }`}
                  onClick={() => router.push(`/course/${race.reunion}/${race.course}?date=${selectedDate}`)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--pmu-text)]">
                      R{race.reunion} C{race.course}
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--pmu-primary)]">{getRaceStatus(race)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-[var(--pmu-text)]">{race.hippodrome}</p>
                  <p className="mt-1 truncate text-[11px] leading-5 text-[var(--pmu-text-soft)]">{race.nomCourse}</p>
                </button>
              );
            })
          : null}

        {!loading && !error && tab === "reunions" && reunionGroups.length === 0 ? (
          <div className="rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-3 text-xs leading-5 text-[var(--pmu-text-soft)]">
            Aucune réunion chargée pour cette journée.
          </div>
        ) : null}

        {!loading && !error && tab === "reunions"
          ? reunionGroups.map((group) => (
              <button
                key={`${selectedDate}-reunion-${group.reunion}`}
                type="button"
                className="w-full rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-3 text-left transition hover:border-[var(--pmu-border-strong)]"
                onClick={() =>
                  router.push(`/course/${group.firstRace.reunion}/${group.firstRace.course}?date=${selectedDate}`)
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--pmu-text)]">
                    R{group.reunion}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--pmu-text-muted)]">
                    {group.firstTime} → {group.lastTime}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-[var(--pmu-text)]">{group.hippodrome}</p>
                <p className="mt-1 text-[11px] leading-5 text-[var(--pmu-text-soft)]">
                  {group.count} courses • ouvre la première fiche
                </p>
              </button>
            ))
          : null}
      </div>
    </section>
  );
}
