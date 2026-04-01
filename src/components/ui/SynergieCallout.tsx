"use client";

import type { SynergieResult } from "@/lib/synergie";
import { synergieTooltipExplication } from "@/lib/synergie";

type SynergieCalloutProps = {
  result: SynergieResult;
};

export function SynergieCallout({ result }: SynergieCalloutProps) {
  const tip = synergieTooltipExplication(result);
  return (
    <div
      className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-4"
      title={tip}
    >
      <p className="text-[11px] font-black uppercase tracking-wider text-[var(--pmu-text-muted)]">
        Synergie jockey × cheval
      </p>
      <p className="mt-2 text-lg font-black" style={{ color: result.color }}>
        {result.label}
      </p>
      <p className="mt-1 text-sm text-[var(--pmu-text-soft)]">
        Score {result.score}/100 · {result.courses} course{result.courses > 1 ? "s" : ""} duo ·{" "}
        {result.victoiresTogether} victoire{result.victoiresTogether > 1 ? "s" : ""}
      </p>
      <p className="mt-2 cursor-help text-xs text-[var(--pmu-text-muted)] underline decoration-dotted">
        {tip}
      </p>
    </div>
  );
}
