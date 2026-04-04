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
  if (minutes < 30) return "Signal actif : fenêtre de jeu ouverte";
  if (minutes <= 60) return `Signal final dans ${minutes} min`;
  return "Fenêtre optimale à T-30";
}

function ctaFromScore(score: number, action: string): string {
  if (score >= 9) return `${action} 🔥`;
  if (score >= 7) return "Voir la sélection";
  if (score >= 5) return "Surveiller la course";
  return "Course à éviter";
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
    ? profile.ticketNums.join(" · ")
    : "—";

  const lines: Array<{ k: string; v: string }> = [];
  if (profile.favoriFragileNum != null) {
    lines.push({ k: "Favori fragile", v: String(profile.favoriFragileNum) });
  }
  if (profile.valueBetNum != null) {
    lines.push({ k: "Opportunité value", v: String(profile.valueBetNum) });
  }
  lines.push({ k: "Sélection", v: ticketStr });

  return (
    <section
      className="w-full overflow-hidden rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-5 md:p-7"
      style={{ boxShadow: "0 4px 16px rgba(0, 0, 0, 0.32)" }}
    >
      <p className="app-kicker">Radar du jour</p>

      <div className="mt-4 flex flex-col items-center text-center">
        <p
          className="font-black tabular-nums leading-none tracking-tight"
          style={{ color: interpreted.color, fontSize: "clamp(2rem, 6vw, 3rem)" }}
        >
          {interpreted.emoji} {scoreRounded}/10
        </p>
        <p
          className="mt-2 text-base font-bold tracking-tight"
          style={{ color: interpreted.color }}
        >
          {interpreted.label}
        </p>
      </div>

      <div className="mt-5 space-y-2 text-center">
        <h2 className="text-xl font-black text-[var(--pmu-text)] md:text-2xl">
          {raceTitle}
        </h2>
        <p className="text-sm font-medium text-[var(--pmu-text-soft)]">
          {hippodrome} • {raceMeta}
        </p>
      </div>

      <div className="mx-auto mt-4 grid max-w-3xl gap-2 md:grid-cols-3">
        {lines.map((row) => (
          <div
            key={row.k}
            className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] px-3 py-2 text-left"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--pmu-text-muted)]">
              {row.k}
            </p>
            <p className="mt-1.5 text-sm font-black text-[var(--pmu-text)]">
              {row.v}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-sm font-medium text-[var(--pmu-text-soft)]">
        {msg}
      </p>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={onClick}
          className="app-button-primary px-6 py-3 text-sm font-bold"
        >
          {ctaFromScore(displayScore, interpreted.action)}
        </button>
      </div>
    </section>
  );
}
