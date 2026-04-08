"use client";

export interface PepiteCardProps {
  horseName: string;
  horseNum: number;
  confidence: number;
  cote: number | null;
  hippodrome: string;
  heureDepart: string;
  reunion: number;
  course: number;
  topFacteurs: string[];
  onClick: () => void;
}

export function PepiteCard({
  horseName,
  horseNum,
  confidence,
  cote,
  hippodrome,
  heureDepart,
  reunion,
  course,
  topFacteurs,
  onClick,
}: PepiteCardProps) {
  const gainPotentiel =
    cote && cote > 0 ? Math.round(cote * 5 * 100) / 100 : null;
  const barPct = Math.min(100, Math.max(0, (confidence / 10) * 100));

  return (
    <section
      className="app-card overflow-hidden"
      style={{ borderColor: "rgba(245, 178, 75, 0.34)" }}
    >
      <div className="px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em]"
            style={{
              background: "rgba(245, 178, 75, 0.12)",
              color: "#F5B24B",
              border: "1px solid rgba(245, 178, 75, 0.28)",
            }}
          >
            Pepite du jour
          </span>
          <span className="text-xs font-semibold text-[var(--pmu-text-muted)]">
            Plus speculative
          </span>
        </div>

        <div className="mt-4">
          <h3 className="text-2xl font-black text-[var(--pmu-text)]">
            #{horseNum} <span style={{ color: "#F5B24B" }}>{horseName}</span>
          </h3>
          <p className="mt-2 text-sm text-[var(--pmu-text-soft)]">
            {hippodrome} - R{reunion}C{course} - {heureDepart}
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] px-4 py-3">
            <p className="app-label">Confiance</p>
            <p className="mt-2 text-xl font-black" style={{ color: "#F5B24B" }}>
              {confidence.toFixed(1)}/10
            </p>
          </div>
          <div className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] px-4 py-3">
            <p className="app-label">Cote</p>
            <p className="mt-2 text-xl font-black text-[var(--pmu-text)]">
              {cote ?? "-"}
            </p>
          </div>
          <div className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] px-4 py-3">
            <p className="app-label">Potentiel 5 EUR</p>
            <p className="mt-2 text-xl font-black" style={{ color: "#F5B24B" }}>
              {gainPotentiel ? `${gainPotentiel} EUR` : "-"}
            </p>
          </div>
        </div>

        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[var(--pmu-surface-2)]">
          <div
            className="h-full rounded-full"
            style={{ width: `${barPct}%`, background: "#F5B24B" }}
          />
        </div>

        {topFacteurs.length > 0 ? (
          <div className="mt-4 grid gap-2">
            {topFacteurs.slice(0, 3).map((factor, index) => (
              <div
                key={`${factor}-${index}`}
                className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] px-4 py-3 text-sm leading-6 text-[var(--pmu-text-soft)]"
              >
                <span className="mr-2 font-black" style={{ color: "#F5B24B" }}>
                  0{index + 1}
                </span>
                {factor}
              </div>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClick}
          className="mt-5 w-full rounded-[1rem] border px-4 py-3 text-sm font-black transition hover:-translate-y-px"
          style={{
            background: "#F5B24B",
            color: "#1a1200",
            borderColor: "rgba(245, 178, 75, 0.34)",
          }}
        >
          Voir l&apos;analyse complete
        </button>
      </div>

      <div className="border-t border-[var(--pmu-border)] px-5 py-3 text-center text-[11px] font-semibold text-[var(--pmu-text-muted)]">
        Profil plus risque - a garder dans une gestion de mise disciplinee
      </div>
    </section>
  );
}
