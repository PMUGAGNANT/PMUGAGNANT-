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
  if (minutes < 30) return "🔴 SIGNAL ACTIF — Jouer maintenant";
  if (minutes <= 60) return `Analyse finale dans ${minutes} minutes`;
  return "Signal optimisé à T-30 minutes";
}

function ctaFromScore(score: number, action: string): string {
  if (score >= 9) return `${action} 🔥`;
  if (score >= 7) return "VOIR QUOI JOUER MAINTENANT →";
  if (score >= 5) return "ANALYSER ⚠️";
  return "PASSER ❌";
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

  const ticketStr = profile.ticketNums.length ? profile.ticketNums.join(" - ") : "—";

  const lines: Array<{ k: string; v: string }> = [];
  if (profile.favoriFragileNum != null) {
    lines.push({ k: "FAVORI FRAGILE", v: String(profile.favoriFragileNum) });
  }
  if (profile.valueBetNum != null) {
    lines.push({ k: "VALUE BET", v: String(profile.valueBetNum) });
  }
  lines.push({ k: "TICKET", v: ticketStr });

  const neon = scoreRounded >= 8.5 ? "#00FF88" : interpreted.color;

  return (
    <section className="w-full overflow-hidden rounded-[2rem] border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-6 shadow-[var(--pmu-shadow)] md:p-10">
      <p className="app-kicker text-[var(--pmu-text-muted)]">SIGNAL DU JOUR</p>

      <div className="mt-6 flex flex-col items-center text-center">
        <p
          className="font-black tabular-nums leading-none tracking-tight"
          style={{ color: neon, fontSize: "clamp(2.5rem, 8vw, 4rem)" }}
        >
          {interpreted.emoji} {scoreRounded}/10
        </p>
        <p className="mt-3 text-xl font-black uppercase tracking-wide" style={{ color: interpreted.color }}>
          {interpreted.label}
        </p>
      </div>

      <div className="mt-8 space-y-2 text-center">
        <h2 className="text-2xl font-black text-[var(--pmu-text)] md:text-3xl">{raceTitle}</h2>
        <p className="text-sm font-semibold text-[var(--pmu-text-soft)] md:text-base">
          {hippodrome} • {raceMeta}
        </p>
      </div>

      <ul className="mx-auto mt-6 max-w-md space-y-2 text-sm">
        {lines.map((row) => (
          <li key={row.k} className="flex justify-between gap-3 border-b border-[var(--pmu-border)] py-2 last:border-0">
            <span className="font-bold text-[var(--pmu-text-muted)]">{row.k}</span>
            <span className="font-black text-[var(--pmu-text)]">{row.v}</span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-sm font-bold text-[var(--pmu-text-soft)]">
        ⏱️ {msg}
      </p>

      <div className="mt-8 flex justify-center">
        <button type="button" onClick={onClick} className="app-button-primary px-8 py-4 text-base font-black">
          {ctaFromScore(displayScore, interpreted.action)}
        </button>
      </div>
    </section>
  );
}
