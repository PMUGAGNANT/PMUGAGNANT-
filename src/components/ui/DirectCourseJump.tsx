"use client";

import { useEffect, useMemo, useState } from "react";

import type { RaceSummary } from "@/lib/types";

type DirectCourseJumpProps = {
  races: RaceSummary[];
  onOpenRace: (race: RaceSummary) => void;
};

function sortRaces(items: RaceSummary[]) {
  return [...items].sort((a, b) => {
    if (a.reunion !== b.reunion) {
      return a.reunion - b.reunion;
    }

    if (a.course !== b.course) {
      return a.course - b.course;
    }

    return (a.heureDepart || "").localeCompare(b.heureDepart || "");
  });
}

export function DirectCourseJump({ races, onOpenRace }: DirectCourseJumpProps) {
  const sortedRaces = useMemo(() => sortRaces(races), [races]);

  const meetings = useMemo(() => {
    const map = new Map<number, RaceSummary[]>();

    for (const race of sortedRaces) {
      const current = map.get(race.reunion) ?? [];
      current.push(race);
      map.set(race.reunion, current);
    }

    return [...map.entries()].map(([reunion, entries]) => ({
      reunion,
      entries,
    }));
  }, [sortedRaces]);

  const [selectedMeeting, setSelectedMeeting] = useState<number | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);

  useEffect(() => {
    if (meetings.length === 0) {
      setSelectedMeeting(null);
      setSelectedCourse(null);
      return;
    }

    const meetingExists = meetings.some((item) => item.reunion === selectedMeeting);
    const fallbackMeeting = meetingExists ? selectedMeeting : meetings[0]!.reunion;
    const currentMeeting = meetings.find((item) => item.reunion === fallbackMeeting) ?? meetings[0]!;
    const courseExists = currentMeeting.entries.some((race) => race.course === selectedCourse);
    const fallbackCourse = courseExists ? selectedCourse : currentMeeting.entries[0]?.course ?? null;

    if (fallbackMeeting !== selectedMeeting) {
      setSelectedMeeting(fallbackMeeting);
    }

    if (fallbackCourse !== selectedCourse) {
      setSelectedCourse(fallbackCourse);
    }
  }, [meetings, selectedCourse, selectedMeeting]);

  const courseOptions = useMemo(() => {
    if (selectedMeeting == null) {
      return [];
    }

    return meetings.find((item) => item.reunion === selectedMeeting)?.entries ?? [];
  }, [meetings, selectedMeeting]);

  const selectedRace = useMemo(() => {
    if (selectedMeeting == null || selectedCourse == null) {
      return null;
    }

    return courseOptions.find((race) => race.course === selectedCourse) ?? null;
  }, [courseOptions, selectedCourse, selectedMeeting]);

  return (
    <div className="app-card-muted flex h-full flex-col gap-4 p-4">
      <div className="space-y-2">
        <p className="app-kicker">Accès direct</p>
        <h3 className="text-lg font-black tracking-tight text-[var(--pmu-text)]">Ouvrir une course en un geste</h3>
        <p className="text-sm leading-6 text-[var(--pmu-text-soft)]">
          Choisis la réunion puis la course. Tu arrives directement sur la fiche détaillée.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">Réunion</span>
          <select
            className="app-input"
            value={selectedMeeting ?? ""}
            onChange={(event) => {
              const nextMeeting = Number(event.target.value);
              setSelectedMeeting(Number.isFinite(nextMeeting) ? nextMeeting : null);
              const firstRace = meetings.find((item) => item.reunion === nextMeeting)?.entries[0];
              setSelectedCourse(firstRace?.course ?? null);
            }}
          >
            {meetings.map((item) => (
              <option key={item.reunion} value={item.reunion}>
                {`R${item.reunion}`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">Course</span>
          <select
            className="app-input"
            value={selectedCourse ?? ""}
            onChange={(event) => {
              const nextCourse = Number(event.target.value);
              setSelectedCourse(Number.isFinite(nextCourse) ? nextCourse : null);
            }}
            disabled={courseOptions.length === 0}
          >
            {courseOptions.map((race) => (
              <option key={`${race.reunion}-${race.course}`} value={race.course}>
                {`C${race.course} • ${race.heureDepart}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedRace ? (
        <div className="rounded-xl border border-[var(--pmu-border)] bg-[var(--pmu-surface)] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">
            {`${selectedRace.hippodrome} • ${selectedRace.heureDepart}`}
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--pmu-text)]">{selectedRace.nomCourse}</p>
          <p className="mt-1 text-sm text-[var(--pmu-text-soft)]">
            {`${selectedRace.discipline || "Discipline"} • ${selectedRace.nombrePartants} partants • ${selectedRace.distance} m`}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--pmu-border)] px-4 py-3 text-sm text-[var(--pmu-text-soft)]">
          Aucune course disponible pour cette journée.
        </div>
      )}

      <button
        type="button"
        className="app-button-primary w-full"
        disabled={!selectedRace}
        onClick={() => {
          if (selectedRace) {
            onOpenRace(selectedRace);
          }
        }}
      >
        {selectedRace ? `Ouvrir R${selectedRace.reunion}C${selectedRace.course}` : "Choisir une course"}
      </button>
    </div>
  );
}
