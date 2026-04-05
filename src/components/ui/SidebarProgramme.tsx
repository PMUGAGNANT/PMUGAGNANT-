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
    return "Aujourd’hui";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateStr.slice(4, 8)}-${dateStr.slice(2, 4)}-${dateStr.slice(0, 2)}T12:00:00Z`));
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
    return "bg-[var(--pmu-primary-soft)] text-[var(--pmu-primary)]";
  }

  if (status === "Courue") {
    return "bg-[var(--pmu-bg)] text-[var(--pmu-text-soft)]";
  }

  return "bg-[var(--pmu-bg)] text-[var(--pmu-text)]";
}

function formatDiscipline(race: RaceSummary) {
  if (race.estTrot) return "Trot";
  if (race.estPlat) return "Plat";
  return race.discipline || "Discipline";
}

function getCourseMeta(race: RaceSummary) {
  return `${formatDiscipline(race)} • ${race.distance} m • ${race.nombrePartants} partants`;
}

function RaceCode({ reunion, course }: { reunion: number; course: number }) {
  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-[var(--pmu-bg)] text-[var(--pmu-text)]">
      <span className="text-lg font-black leading-none">R{reunion}</span>
      <span className="mt-0.5 text-lg font-black leading-none">C{course}</span>
    </div>
  );
}

export function SidebarProgramme() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedDate = normalizeDateParam(searchParams.get("date"));

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
        if (fetchError instanceof Error && fetchError.name === "AbortError") return;
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
    if (!match) return null;

    return {
      reunion: Number(match[1]),
      course: Number(match[2]),
      key: `${match[1]}-${match[2]}`,
    };
  }, [pathname]);

  useEffect(() => {
    if (currentRoute) {
      setIsOpen(true);
      setTab("courses");
      setSelectedReunion(currentRoute.reunion);
    }
  }, [currentRoute]);

  useEffect(() => {
    if (reunionGroups.length === 0) {
      setSelectedReunion(null);
      return;
    }

    setSelectedReunion((current) => {
      if (current && reunionGroups.some((group) => group.reunion === current)) {
        return current;
      }

      return currentRoute?.reunion ?? reunionGroups[0]?.reunion ?? null;
    });
  }, [currentRoute?.reunion, reunionGroups]);

  const selectedGroup = useMemo(
    () => reunionGroups.find((group) => group.reunion === selectedReunion) ?? null,
    [reunionGroups, selectedReunion],
  );

  const visibleCourses = useMemo(() => {
    if (selectedReunion === null) return [];
    return sortedRaces.filter((race) => race.reunion === selectedReunion);
  }, [selectedReunion, sortedRaces]);

  function openReunion(reunion: number) {
    setSelectedReunion(reunion);
    setTab("courses");
  }

  function openCourse(race: RaceSummary) {
    router.push(`/course/${race.reunion}/${race.course}?date=${selectedDate}`);
  }

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
          <p className="text-sm font-black text-[var(--pmu-text)]">Programme du jour</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--pmu-text-soft)]">
            Réunions puis courses • {reunionGroups.length} réunions • {formatDateLabel(selectedDate)}
          </p>
        </div>

        <span className="rounded-full border border-[var(--pmu-border)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
          {isOpen ? "Ouvert" : "Fermé"}
        </span>
      </button>

      {isOpen ? (
        <div id="sidebar-programme-panel" className="border-t border-[var(--pmu-border)] p-3">
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
            <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-2">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-bg)] text-[var(--pmu-text)] transition hover:border-[var(--pmu-border-strong)]"
                onClick={() => setTab("reunions")}
                aria-label="Retour aux réunions"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 5.5L8 10l4.5 4.5" />
                </svg>
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-[var(--pmu-text)]">
                  {selectedGroup ? `R${selectedGroup.reunion} ${selectedGroup.hippodrome}` : "Choisis une réunion"}
                </p>
                <p className="truncate text-[11px] text-[var(--pmu-text-soft)]">
                  {selectedGroup
                    ? `${selectedGroup.count} courses • ${selectedGroup.firstTime} → ${selectedGroup.lastTime}`
                    : "Sélectionne une réunion pour afficher ses courses"}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-3 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
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
                        ? "border-[var(--pmu-primary)] bg-[var(--pmu-primary-soft)]"
                        : "border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] hover:border-[var(--pmu-border-strong)]"
                    }`}
                    onClick={() => openReunion(group.reunion)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--pmu-bg)] text-[var(--pmu-text)]">
                          <span className="text-lg font-black leading-none">R{group.reunion}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-black text-[var(--pmu-text)]">
                            {group.hippodrome}
                          </p>
                          <p className="mt-1 text-[12px] leading-5 text-[var(--pmu-text-soft)]">
                            {group.count} courses • premier départ {group.firstTime}
                          </p>
                          <div className="mt-2 inline-flex rounded-full bg-[var(--pmu-bg)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--pmu-text-soft)]">
                            {group.firstTime} → {group.lastTime}
                          </div>
                        </div>
                      </div>

                      <span className="shrink-0 text-xs font-black uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">
                        Ouvrir
                      </span>
                    </div>
                  </button>
                ))
              : null}

            {!loading && !error && tab === "courses" && visibleCourses.length === 0 ? (
              <div className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-3 text-xs leading-5 text-[var(--pmu-text-soft)]">
                Choisis d’abord une réunion, puis ses courses apparaîtront ici.
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
                          ? "border-[var(--pmu-primary)] bg-[var(--pmu-primary-soft)]"
                          : "border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] hover:border-[var(--pmu-border-strong)]"
                      }`}
                      onClick={() => openCourse(race)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 gap-3">
                          <RaceCode reunion={race.reunion} course={race.course} />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-black text-[var(--pmu-text)]">
                              {race.hippodrome}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-5 text-[var(--pmu-text)]">
                              {race.nomCourse}
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-[var(--pmu-text-soft)]">
                              {getCourseMeta(race)}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black text-[var(--pmu-text)]">{race.heureDepart}</p>
                          <span
                            className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${getRaceStatusTone(
                              status,
                              active,
                            )}`}
                          >
                            {status}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              : null}
          </div>

          <div className="mt-3 rounded-2xl border border-dashed border-[var(--pmu-border)] px-3 py-2 text-[11px] leading-5 text-[var(--pmu-text-soft)]">
            Tu choisis d’abord une réunion, puis tu fais défiler ses courses dans la même fenêtre.
          </div>
        </div>
      ) : null}
    </section>
  );
}
