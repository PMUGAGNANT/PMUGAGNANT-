"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { getMinutesUntilStart, getTodayDateStr } from "@/lib/date-utils";
import type { RaceSummary } from "@/lib/types";

type SidebarProgrammeTab = "reunions" | "courses";

type RacesResponse = {
  success: boolean;
  date: string;
  races?: RaceSummary[];
  error?: string;
};

type ReunionGroup = {
  reunion: number;
  hippodrome: string;
  count: number;
  firstTime: string;
  lastTime: string;
};

type ReunionSummary = {
  live: number;
  pending: number;
  done: number;
};

function normalizeDateParam(value: string | null) {
  return value && /^\d{8}$/.test(value) ? value : getTodayDateStr();
}

function sortRaces(items: RaceSummary[]) {
  return [...items].sort((a, b) => {
    const timeCompare = (a.heureDepart || "").localeCompare(b.heureDepart || "");
    if (timeCompare !== 0) return timeCompare;
    if (a.reunion !== b.reunion) return a.reunion - b.reunion;
    return a.course - b.course;
  });
}

function formatDateLabel(dateStr: string) {
  if (dateStr === getTodayDateStr()) {
    return "Aujourd'hui";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(
    new Date(`${dateStr.slice(4, 8)}-${dateStr.slice(2, 4)}-${dateStr.slice(0, 2)}T12:00:00Z`),
  );
}

function buildReunionGroups(races: RaceSummary[]) {
  const grouped = new Map<number, RaceSummary[]>();

  for (const race of races) {
    const current = grouped.get(race.reunion) ?? [];
    current.push(race);
    grouped.set(race.reunion, current);
  }

  return [...grouped.entries()]
    .map(([reunion, items]) => {
      const sorted = sortRaces(items);

      return {
        reunion,
        hippodrome: sorted[0]?.hippodrome ?? `Réunion ${reunion}`,
        count: sorted.length,
        firstTime: sorted[0]?.heureDepart ?? "--:--",
        lastTime: sorted.at(-1)?.heureDepart ?? "--:--",
      } satisfies ReunionGroup;
    })
    .sort((a, b) => a.firstTime.localeCompare(b.firstTime));
}

function getRaceStatus(race: RaceSummary) {
  const minutes = getMinutesUntilStart(race.heureDepart, race.dateStr);

  if (minutes <= -15) return "Courue";
  if (minutes <= 8) return "En cours";
  if (minutes <= 60) return `${Math.max(1, Math.round(minutes))} min`;
  return race.heureDepart;
}

function getRaceStatusTone(status: string, active: boolean) {
  if (active || status === "En cours") {
    return "border-[var(--pmu-primary)]/25 bg-[var(--pmu-primary-soft)] text-[var(--pmu-primary)]";
  }

  if (status === "Courue") {
    return "border-[var(--pmu-border)] bg-[var(--pmu-bg)] text-[var(--pmu-text-soft)]";
  }

  return "border-[var(--pmu-border)] bg-[var(--pmu-bg)] text-[var(--pmu-text)]";
}

function buildReunionSummary(courses: RaceSummary[]): ReunionSummary {
  return courses.reduce<ReunionSummary>(
    (summary, race) => {
      const status = getRaceStatus(race);
      if (status === "En cours") {
        summary.live += 1;
      } else if (status === "Courue") {
        summary.done += 1;
      } else {
        summary.pending += 1;
      }
      return summary;
    },
    { live: 0, pending: 0, done: 0 },
  );
}

function formatDiscipline(race: RaceSummary) {
  if (race.estTrot) return "Trot";
  if (race.estPlat) return "Plat";
  return race.discipline || "Discipline";
}

function ReunionCode({ reunion }: { reunion: number }) {
  return (
    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-bg)] text-[var(--pmu-text)]">
      <span className="text-[13px] font-black tracking-[-0.03em]">R{reunion}</span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">
        Run
      </span>
    </div>
  );
}

function CourseCode({ reunion, course }: { reunion: number; course: number }) {
  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-[var(--pmu-border)] bg-[linear-gradient(180deg,var(--pmu-surface-2)_0%,var(--pmu-bg)_100%)] text-[var(--pmu-text)]">
      <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">
        R{reunion}
      </span>
      <span className="text-[17px] font-black tracking-[-0.04em]">C{course}</span>
    </div>
  );
}

export function SidebarProgramme() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedDate = normalizeDateParam(searchParams.get("date"));
  const isCoursePage = /^\/course\/\d+\/\d+$/.test(pathname);

  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<SidebarProgrammeTab>("reunions");
  const [selectedReunion, setSelectedReunion] = useState<number | null>(null);
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

  const sortedRaces = useMemo(() => sortRaces(races), [races]);
  const reunionGroups = useMemo(() => buildReunionGroups(races), [races]);

  const currentRoute = useMemo(() => {
    const match = pathname.match(/^\/course\/(\d+)\/(\d+)$/);
    if (!match) {
      return null;
    }

    return {
      key: `${match[1]}-${match[2]}`,
    };
  }, [pathname]);

  useEffect(() => {
    if (reunionGroups.length === 0) {
      setSelectedReunion(null);
      return;
    }

    setSelectedReunion((current) => {
      if (current && reunionGroups.some((group) => group.reunion === current)) {
        return current;
      }

      return reunionGroups[0]?.reunion ?? null;
    });
  }, [reunionGroups]);

  const selectedGroup = useMemo(
    () => reunionGroups.find((group) => group.reunion === selectedReunion) ?? null,
    [reunionGroups, selectedReunion],
  );

  const visibleCourses = useMemo(() => {
    if (selectedReunion === null) {
      return [];
    }

    return sortedRaces.filter((race) => race.reunion === selectedReunion);
  }, [selectedReunion, sortedRaces]);

  const reunionSummary = useMemo(() => buildReunionSummary(visibleCourses), [visibleCourses]);

  function openReunion(reunion: number) {
    setSelectedReunion(reunion);
    setTab("courses");
  }

  function openCourse(race: RaceSummary) {
    router.push(`/course/${race.reunion}/${race.course}?date=${selectedDate}`);
  }

  if (isCoursePage) {
    return null;
  }

  return (
    <section className="ml-3 mt-3 overflow-hidden rounded-[1.35rem] border border-[var(--pmu-border)] bg-[linear-gradient(180deg,var(--pmu-surface)_0%,color-mix(in_srgb,var(--pmu-surface)_84%,var(--pmu-bg)_16%)_100%)] shadow-[0_4px_18px_rgba(0,0,0,0.18)]">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-[color-mix(in_srgb,var(--pmu-surface-2)_80%,transparent)]"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="sidebar-programme-panel"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] text-[var(--pmu-text)]">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6.5h12M4 10h12M4 13.5h8" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[var(--pmu-text)]">Programme du jour</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--pmu-text-soft)]">
            {reunionGroups.length} réunions • {formatDateLabel(selectedDate)}
          </p>
        </div>

        <span className="rounded-full border border-[var(--pmu-border)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
          {isOpen ? "Ouvert" : "Fermé"}
        </span>
      </button>

      {isOpen ? (
        <div id="sidebar-programme-panel" className="border-t border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-3">
          <div className="flex items-center gap-2 rounded-2xl bg-[var(--pmu-surface-2)] p-1">
            <button
              type="button"
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
                tab === "reunions"
                  ? "bg-[var(--pmu-bg)] text-[var(--pmu-text)]"
                  : "text-[var(--pmu-text-muted)] hover:text-[var(--pmu-text)]"
              }`}
              onClick={() => setTab("reunions")}
            >
              Réunions
            </button>
            <button
              type="button"
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
                tab === "courses"
                  ? "bg-[var(--pmu-bg)] text-[var(--pmu-text)]"
                  : "text-[var(--pmu-text-muted)] hover:text-[var(--pmu-text)]"
              }`}
              onClick={() => setTab("courses")}
            >
              Courses
            </button>
          </div>

          {tab === "courses" ? (
            <div className="mt-3 rounded-xl border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_88%,var(--pmu-bg)_12%)] px-2.5 py-2">
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-bg)] text-[var(--pmu-text)] transition hover:border-[var(--pmu-border-strong)]"
                  onClick={() => setTab("reunions")}
                  aria-label="Retour aux réunions"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 5.5L8 10l4.5 4.5" />
                  </svg>
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-black text-[var(--pmu-text)]">
                      {selectedGroup ? `R${selectedGroup.reunion} ${selectedGroup.hippodrome}` : "Choisis une réunion"}
                    </p>
                    {selectedGroup ? (
                      <span className="shrink-0 rounded-full border border-[var(--pmu-border)] bg-[var(--pmu-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--pmu-text-soft)]">
                        {selectedGroup.count} courses
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-[var(--pmu-text-soft)]">
                    {selectedGroup
                      ? `${selectedGroup.firstTime} → ${selectedGroup.lastTime} • ${reunionSummary.pending} à venir${
                          reunionSummary.live > 0 ? ` • ${reunionSummary.live} en cours` : ""
                        }${reunionSummary.done > 0 ? ` • ${reunionSummary.done} courues` : ""}`
                      : "Sélectionne une réunion pour afficher ses courses"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-3 max-h-[31rem] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
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
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selectedReunion === group.reunion
                        ? "border-[var(--pmu-border-strong)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--pmu-surface-highlight)_55%,var(--pmu-surface)_45%)_0%,color-mix(in_srgb,var(--pmu-surface-2)_72%,var(--pmu-surface-highlight)_28%)_100%)]"
                        : "border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] hover:border-[var(--pmu-border-strong)] hover:bg-[color-mix(in_srgb,var(--pmu-surface-highlight)_24%,var(--pmu-surface-2)_76%)]"
                    }`}
                    onClick={() => openReunion(group.reunion)}
                  >
                    <div className="flex items-center gap-3">
                      <ReunionCode reunion={group.reunion} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-black text-[var(--pmu-text)]">{group.hippodrome}</p>
                          <span className="rounded-full border border-[var(--pmu-border)] bg-[var(--pmu-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--pmu-text-soft)]">
                            {group.firstTime}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-5 text-[var(--pmu-text-soft)]">
                          {group.count} courses • fenêtre {group.firstTime} → {group.lastTime}
                        </p>
                      </div>

                      <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-bg)] text-[var(--pmu-text-soft)]">
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 5.5L12 10l-4.5 4.5" />
                        </svg>
                      </span>
                    </div>
                  </button>
                ))
              : null}

            {!loading && !error && tab === "courses" && visibleCourses.length === 0 ? (
              <div className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-3 text-xs leading-5 text-[var(--pmu-text-soft)]">
                Sélectionne une réunion pour voir ses courses.
              </div>
            ) : null}

            {!loading && !error && tab === "courses"
              ? visibleCourses.map((race) => {
                  const raceKey = `${race.reunion}-${race.course}`;
                  const active = currentRoute?.key === raceKey;
                  const status = getRaceStatus(race);

                  return (
                    <button
                      key={`${race.dateStr}-${raceKey}`}
                      type="button"
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-[var(--pmu-border-strong)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--pmu-surface-highlight)_62%,var(--pmu-surface)_38%)_0%,color-mix(in_srgb,var(--pmu-surface-2)_72%,var(--pmu-surface-highlight)_28%)_100%)]"
                          : "border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] hover:border-[var(--pmu-border-strong)] hover:bg-[color-mix(in_srgb,var(--pmu-surface-highlight)_24%,var(--pmu-surface-2)_76%)]"
                      }`}
                      onClick={() => openCourse(race)}
                    >
                      <div className="flex items-start gap-3">
                        <CourseCode reunion={race.reunion} course={race.course} />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[13px] font-black leading-5 text-[var(--pmu-text)]">
                              {race.hippodrome}
                            </p>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${getRaceStatusTone(
                                status,
                                active,
                              )}`}
                            >
                              {status}
                            </span>
                          </div>

                          <p className="mt-1 text-sm font-semibold leading-5 text-[var(--pmu-text)]">
                            {race.nomCourse}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--pmu-text-soft)]">
                            <span className="rounded-lg bg-[var(--pmu-bg)] px-2 py-1 font-semibold">
                              {formatDiscipline(race)}
                            </span>
                            <span className="rounded-lg bg-[var(--pmu-bg)] px-2 py-1 font-semibold">
                              {race.distance} m
                            </span>
                            <span className="rounded-lg bg-[var(--pmu-bg)] px-2 py-1 font-semibold">
                              {race.nombrePartants} partants
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
