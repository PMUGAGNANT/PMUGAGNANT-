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

function formatDiscipline(race: RaceSummary) {
  if (race.estTrot) {
    return "Attelé";
  }
  if (race.estPlat) {
    return "Plat";
  }
  return race.discipline || "Discipline";
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

  const [isOpen, setIsOpen] = useState(false);
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

    return () => controller.abort();
  }, [selectedDate]);

  const sortedRaces = useMemo(() => sortRaces(races).slice(0, 6), [races]);
  const reunionGroups = useMemo(() => getReunionGroups(races).slice(0, 6), [races]);
  const reunionCount = reunionGroups.length;

  const currentCourseKey = useMemo(() => {
    const match = pathname.match(/^\/course\/(\d+)\/(\d+)$/);
    if (!match) {
      return null;
    }

    return `${match[1]}-${match[2]}`;
  }, [pathname]);

  return (
    <section className="ml-3 overflow-hidden rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface)]">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-[var(--pmu-surface-2)]"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="sidebar-programme-panel"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] text-[var(--pmu-text)]">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6.5h12M4 10h12M4 13.5h8" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[var(--pmu-text)]">Programme PMU</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--pmu-text-soft)]">
            Courses / Réunions • {sortedRaces.length} accès • {getDateLabel(selectedDate)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[var(--pmu-border)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
            {isOpen ? "Ouvert" : "Fermé"}
          </span>
          <svg
            className={`h-4 w-4 shrink-0 text-[var(--pmu-text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 7.5l5 5 5-5" />
          </svg>
        </div>
      </button>

      {isOpen ? (
        <div id="sidebar-programme-panel" className="border-t border-[var(--pmu-border)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2 rounded-2xl bg-[var(--pmu-surface-2)] p-1">
              <button
                type="button"
                className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                  tab === "courses"
                    ? "bg-[var(--pmu-bg)] text-[var(--pmu-text)]"
                    : "text-[var(--pmu-text-muted)] hover:text-[var(--pmu-text)]"
                }`}
                onClick={() => setTab("courses")}
              >
                Courses
              </button>
              <button
                type="button"
                className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                  tab === "reunions"
                    ? "bg-[var(--pmu-bg)] text-[var(--pmu-text)]"
                    : "text-[var(--pmu-text-muted)] hover:text-[var(--pmu-text)]"
                }`}
                onClick={() => setTab("reunions")}
              >
                Réunions
              </button>
            </div>

            <a
              href={selectedDate === getTodayDateStr() ? "/" : `/?date=${selectedDate}`}
              className="text-[11px] font-semibold text-[var(--pmu-text-muted)] transition hover:text-[var(--pmu-text)]"
            >
              Voir tout
            </a>
          </div>

          <div className="mt-3 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
            {loading
              ? Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)]"
                  />
                ))
              : null}

            {!loading && error ? (
              <div className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-3 text-xs leading-5 text-[var(--pmu-text-soft)]">
                {error}
              </div>
            ) : null}

            {!loading && !error && tab === "courses" && sortedRaces.length === 0 ? (
              <div className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-3 text-xs leading-5 text-[var(--pmu-text-soft)]">
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
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-[var(--pmu-primary)] bg-[var(--pmu-primary-soft)]"
                          : "border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] hover:border-[var(--pmu-border-strong)]"
                      }`}
                      onClick={() => router.push(`/course/${race.reunion}/${race.course}?date=${selectedDate}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 gap-3">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--pmu-bg)] text-center">
                            <span className="text-sm font-black uppercase leading-none tracking-tight text-[var(--pmu-text)]">
                              R{race.reunion}
                              <br />
                              C{race.course}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-black text-[var(--pmu-text)]">{race.hippodrome}</p>
                            <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-5 text-[var(--pmu-text)]">
                              {race.nomCourse}
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-[var(--pmu-text-soft)]">
                              {formatDiscipline(race)} • {race.distance} m • {race.nombrePartants} partants
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black text-[var(--pmu-text)]">{race.heureDepart}</p>
                          <span
                            className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                              active
                                ? "bg-[var(--pmu-bg)] text-[var(--pmu-primary)]"
                                : "bg-[var(--pmu-bg)] text-[var(--pmu-text-soft)]"
                            }`}
                          >
                            {getRaceStatus(race)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              : null}

            {!loading && !error && tab === "reunions" && reunionGroups.length === 0 ? (
              <div className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-3 text-xs leading-5 text-[var(--pmu-text-soft)]">
                Aucune réunion chargée pour cette journée.
              </div>
            ) : null}

            {!loading && !error && tab === "reunions"
              ? reunionGroups.map((group) => (
                  <button
                    key={`${selectedDate}-reunion-${group.reunion}`}
                    type="button"
                    className="w-full rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-3 text-left transition hover:border-[var(--pmu-border-strong)]"
                    onClick={() =>
                      router.push(`/course/${group.firstRace.reunion}/${group.firstRace.course}?date=${selectedDate}`)
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--pmu-bg)] text-center">
                          <span className="text-base font-black uppercase leading-none tracking-tight text-[var(--pmu-text)]">
                            R{group.reunion}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-black text-[var(--pmu-text)]">{group.hippodrome}</p>
                          <p className="mt-1 text-[12px] leading-5 text-[var(--pmu-text-soft)]">
                            {group.count} courses • première fiche en ouverture
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-[var(--pmu-bg)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--pmu-text-soft)]">
                              {group.firstTime} → {group.lastTime}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className="shrink-0 text-sm font-black text-[var(--pmu-text)]">{group.firstTime}</span>
                    </div>
                  </button>
                ))
              : null}
          </div>

          <div className="mt-3 rounded-2xl border border-dashed border-[var(--pmu-border)] px-3 py-2 text-[11px] leading-5 text-[var(--pmu-text-soft)]">
            Déroule ce dossier pour faire défiler les fenêtres Courses / Réunions comme un mini-programme PMU.
          </div>
        </div>
      ) : null}
    </section>
  );
}
