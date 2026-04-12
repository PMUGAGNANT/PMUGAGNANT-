"use client";

import { useEffect, useMemo, useState } from "react";
import { getMinutesUntilStart } from "@/lib/date-utils";
import type { RaceProfile } from "@/lib/client-race-scoring";
import { interpretScore } from "@/lib/scoring-policy";

export type RadarHeroProps = {
  raceTitle: string;
  hippodrome: string;
  raceMeta: string;
  displayScore: number;
  profile: RaceProfile;
  heureDepart: string;
  dateStr: string;
  onClick: () => void;
};

function radarMessage(minutes: number): string {
  if (minutes <= 0) return "Course en cours";
  if (minutes < 30) return "Signal actif";
  if (minutes <= 60) return `Fenetre finale dans ${minutes} min`;
  return "Course a garder en haut du board";
}

function ctaFromScore(score: number): string {
  if (score >= 9) return "Executer maintenant";
  if (score >= 7) return "Voir la selection";
  if (score >= 5) return "Surveiller la course";
  return "Lire le detail";
}

export function RadarHero({
  raceTitle,
  hippodrome,
  raceMeta,
  displayScore,
  profile,
  heureDepart,
  dateStr,
  onClick,
}: RadarHeroProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const interpreted = useMemo(() => interpretScore(displayScore), [displayScore]);
  const scoreRounded = Math.round(displayScore * 10) / 10;
  const minutesUntilStart = Math.max(
    0,
    Math.round(getMinutesUntilStart(heureDepart, dateStr))
  );
  void tick;

  const msg = radarMessage(minutesUntilStart);
  const ticketStr = profile.ticketNums.length
    ? profile.ticketNums.join(" - ")
    : "A confirmer";

  const lines: Array<{ k: string; v: string }> = [];
  if (profile.favoriFragileNum != null) {
    lines.push({ k: "Favori fragile", v: String(profile.favoriFragileNum) });
  }
  if (profile.valueBetNum != null) {
    lines.push({ k: "Value", v: String(profile.valueBetNum) });
  }
  lines.push({ k: "Selection", v: ticketStr });

  return (
    <section className="app-card h-full p-5 md:p-6">
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="app-kicker">Radar de course</p>
            <h2 className="mt-2 text-2xl font-black leading-[0.96] text-[var(--pmu-text)]">
              {raceTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
              {hippodrome} - {raceMeta}
            </p>
          </div>
          <div
            className="rounded-[1.25rem] border px-4 py-3 text-right"
            style={{
              borderColor: `color-mix(in srgb, ${interpreted.color} 24%, transparent)`,
              background: `color-mix(in srgb, ${interpreted.color} 10%, var(--pmu-surface))`,
            }}
          >
            <p
              className="text-3xl font-black leading-none"
              style={{ color: interpreted.color }}
            >
              {scoreRounded}/10
            </p>
            <p
              className="mt-1 text-xs font-extrabold uppercase tracking-[0.14em]"
              style={{ color: interpreted.color }}
            >
              {interpreted.label}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {lines.map((row) => (
            <div
              key={row.k}
              className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] px-4 py-3"
            >
              <p className="app-label">{row.k}</p>
              <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
                {row.v}
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-[1.2rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] p-4">
          <p className="text-sm font-semibold text-[var(--pmu-text)]">{msg}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
            Ce bloc sert a garder la meilleure course du moment visible, meme
            quand le ticket principal n&apos;est pas encore totalement verrouille.
          </p>
        </div>

        <div className="mt-auto">
          <button type="button" onClick={onClick} className="app-button-primary w-full">
            {ctaFromScore(displayScore)}
          </button>
        </div>
      </div>
    </section>
  );
}
