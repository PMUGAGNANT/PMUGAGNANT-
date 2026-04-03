"use client";

import type { EloProfile } from "@/lib/elo-scoring";
import { normalizeEloBar } from "@/lib/elo-scoring";

function Bar({ label, elo }: { label: string; elo: number }) {
  const pct = normalizeEloBar(elo);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-bold text-[var(--pmu-text-muted)]">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--pmu-text)]">{Math.round(elo)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--pmu-surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--pmu-primary)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

type EloBarsProps = {
  profile: EloProfile;
  title?: string;
};

export function EloBars({ profile, title = "Fiabilité du ticket principal" }: EloBarsProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
      <p className="text-xs font-black uppercase tracking-wider text-[var(--pmu-primary)]">{title}</p>
      <p className="text-[11px] leading-relaxed text-[var(--pmu-text-soft)]">
        Lecture cheval / jockey ou driver / entraîneur. Pondération globale : 50 % / 30 % / 20 %.
      </p>
      <Bar label="Cheval" elo={profile.eloCheval} />
      <Bar label="Jockey / driver" elo={profile.eloJockey} />
      <Bar label="Entraîneur" elo={profile.eloEntraineur} />
    </div>
  );
}
