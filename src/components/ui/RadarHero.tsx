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

function ctaFromScore(score: number, action: string): string {
  if (score >= 9) return `${action} maintenant`;
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
  const minutesUntilStart = Math.max(0, Math.round(getMinutesUntilStart(heureDepart, dateStr)));
  void tick;

  const msg = radarMessage(minutesUntilStart);
  const ticketStr = profile.ticketNums.length ? profile.ticketNums.join(" · ") : "—";

  const lines: Array<{ k: string; v: string }> = [];
  if (profile.favoriFragileNum != null) {
    lines.push({ k: "Favori fragile", v: String(profile.favoriFragileNum) });
  }
  if (profile.valueBetNum != null) {
    lines.push({ k: "Value", v: String(profile.valueBetNum) });
  }
  lines.push({ k: "Selection", v: ticketStr });

  return (
    <section className="app-page-hero p-5 md:p-7">
      <div className="relative z-[1] grid gap-5 xl:grid-cols-[0.9fr,1.1fr] xl:items-center">
        <div className="app-card-muted p-5 text-center">
          <p className="app-kicker">Radar du jour</p>
          <p className="mt-3 text-5xl font-black leading-none" style={{ color: interpreted.color }}>
            {interpreted.emoji} {scoreRounded}/10
          </p>
          <p className="mt-3 text-base font-black" style={{ color: interpreted.color }}>
            {interpreted.label}
          </p>
          <p className="mt-4 text-sm leading-6 text-[var(--pmu-text-soft)]">{msg}</p>
        </div>

        <div className="space-y-5">
          <div>
            <p className="app-kicker">Course a regarder</p>
            <h2 className="mt-3 text-4xl font-black leading-[0.96] text-[var(--pmu-text)] md:text-5xl">
              {raceTitle}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
              {hippodrome} · {raceMeta}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {lines.map((row) => (
              <div key={row.k} className="app-stat-card px-4 py-4">
                <p className="app-label">{row.k}</p>
                <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">{row.v}</p>
              </div>
            ))}
          </div>

          <button type="button" onClick={onClick} className="app-button-primary">
            {ctaFromScore(displayScore, interpreted.action)}
          </button>
        </div>
      </div>
    </section>
  );
}
