"use client";

import { translateFactors } from "@/lib/beginner-labels";

export interface WhyThisHorseProps {
  horseName: string;
  horseNum: number;
  topFacteurs: string[];
  confidence: number;
  betType?: string | null;
  /** Mode compact pour les cartes, mode full pour la page détail */
  mode?: "compact" | "full";
}

function confidenceBar(confidence: number) {
  const pct = Math.min(100, Math.max(0, (confidence / 10) * 100));
  return { pct };
}

function betTypeLabel(bt: string | null | undefined): string {
  const u = (bt ?? "").toUpperCase();
  if (u === "GAGNANT") return "Gagnant (1er)";
  if (u === "PLACE") return "Placé (top 3)";
  if (u === "COUPLE" || u === "COUPLE_GAGNANT") return "Couplé";
  if (u === "TRIO") return "Trio";
  return "Placé (top 3)";
}

export function WhyThisHorse({
  horseName,
  horseNum,
  topFacteurs,
  confidence,
  betType,
  mode = "compact",
}: WhyThisHorseProps) {
  const translated = translateFactors(topFacteurs).slice(0, mode === "compact" ? 3 : 5);
  const bar = confidenceBar(confidence);

  if (mode === "compact") {
    return (
      <div
        className="rounded-xl p-3"
        style={{
          background: "var(--pmu-primary-fade)",
          border: "1px solid var(--pmu-primary-soft)",
        }}
      >
        <p
          className="text-[11px] font-black uppercase tracking-wider"
          style={{ color: "var(--pmu-primary)" }}
        >
          Pourquoi N°{horseNum} ?
        </p>
        <ul className="mt-1.5 space-y-1">
          {translated.map((f, i) => (
            <li
              key={i}
              className="text-sm leading-snug text-[var(--pmu-text-soft)]"
            >
              → {f}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Full mode — page détail
  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--pmu-primary-soft)",
        background:
          "linear-gradient(168deg, var(--pmu-primary-fade) 0%, var(--pmu-surface) 100%)",
      }}
    >
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-black text-[var(--pmu-text)]">
            🐴 Pourquoi{" "}
            <span style={{ color: "var(--pmu-primary)" }}>
              N°{horseNum} {horseName}
            </span>{" "}
            ?
          </h3>
          <span
            className="rounded-full px-3 py-1 text-xs font-black"
            style={{
              background: "var(--pmu-primary-soft)",
              color: "var(--pmu-primary)",
            }}
          >
            {betTypeLabel(betType)}
          </span>
        </div>

        {/* Barre de confiance */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-[var(--pmu-text-muted)]">
              Notre confiance
            </span>
            <span className="font-black text-[var(--pmu-text)]">
              {Math.round(confidence * 10) / 10}/10
            </span>
          </div>
          <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-[var(--pmu-surface-2)]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${bar.pct}%`,
                background:
                  confidence >= 8
                    ? "#00FF88"
                    : confidence >= 6
                      ? "#00CC66"
                      : confidence >= 4
                        ? "#FFB800"
                        : "#FF4444",
              }}
            />
          </div>
        </div>

        {/* Raisons */}
        <div className="mt-4 space-y-2">
          {translated.map((f, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-xl px-3 py-2"
              style={{ background: "var(--pmu-surface)" }}
            >
              <span className="mt-0.5 text-sm" style={{ color: "var(--pmu-primary)" }}>
                ✓
              </span>
              <p className="text-sm leading-relaxed text-[var(--pmu-text)]">
                {f}
              </p>
            </div>
          ))}
          {translated.length === 0 && (
            <p className="text-sm text-[var(--pmu-text-muted)]">
              Analyse en cours — les détails seront disponibles au signal T-30min.
            </p>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div
        className="border-t px-5 py-3 text-xs text-[var(--pmu-text-muted)]"
        style={{ borderColor: "var(--pmu-border)" }}
      >
        💡 Rappel : les performances passées ne garantissent pas les résultats
        futurs. Ne misez que ce que vous pouvez perdre.
      </div>
    </section>
  );
}
