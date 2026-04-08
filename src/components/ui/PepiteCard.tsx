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
  const gainPotentiel = cote && cote > 0 ? Math.round(cote * 5 * 100) / 100 : null;
  const barPct = Math.min(100, Math.max(0, (confidence / 10) * 100));

  return (
    <section
      className="app-card overflow-hidden"
      style={{ borderColor: "rgba(251, 191, 36, 0.3)" }}
    >
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider"
            style={{
              background: "rgba(251, 191, 36, 0.12)",
              color: "#FBB724",
              border: "1px solid rgba(251, 191, 36, 0.3)",
            }}
          >
            💎 Pépite du jour
          </span>
          <span className="text-xs font-bold text-[var(--pmu-text-muted)]">
            Plus risqué, meilleur rapport
          </span>
        </div>

        <div className="mt-3 text-center">
          <h3 className="text-2xl font-black text-[var(--pmu-text)]">
            N°{horseNum} <span style={{ color: "#FBB724" }}>{horseName}</span>
          </h3>
          <p className="mt-1 text-sm text-[var(--pmu-text-muted)]">
            {hippodrome} • R{reunion}C{course} • {heureDepart}
          </p>
        </div>

        <div className="mx-auto mt-3 max-w-xs">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-[var(--pmu-text-muted)]">Confiance</span>
            <span className="font-black" style={{ color: "#FBB724" }}>
              {Math.round(confidence * 10) / 10}/10
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--pmu-surface-2)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${barPct}%`, background: "#FBB724" }}
            />
          </div>
        </div>

        {cote && (
          <div className="mx-auto mt-3 flex max-w-xs justify-center gap-4">
            <div className="rounded-lg bg-[var(--pmu-surface-2)] px-4 py-2 text-center">
              <p className="text-[10px] font-bold uppercase text-[var(--pmu-text-muted)]">
                Cote
              </p>
              <p className="text-lg font-black text-[var(--pmu-text)]">{cote}</p>
            </div>
            {gainPotentiel && (
              <div className="rounded-lg bg-[var(--pmu-surface-2)] px-4 py-2 text-center">
                <p className="text-[10px] font-bold uppercase text-[var(--pmu-text-muted)]">
                  Gain potentiel (5€)
                </p>
                <p className="text-lg font-black" style={{ color: "#FBB724" }}>
                  {gainPotentiel}€
                </p>
              </div>
            )}
          </div>
        )}

        {topFacteurs.length > 0 && (
          <div className="mx-auto mt-3 max-w-xs">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--pmu-text-muted)]">
              Pourquoi cette pépite ?
            </p>
            <ul className="mt-1 space-y-1">
              {topFacteurs.slice(0, 3).map((factor, index) => (
                <li key={index} className="text-sm text-[var(--pmu-text-soft)]">
                  <span style={{ color: "#FBB724" }}>→</span> {factor}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={onClick}
            className="w-full max-w-xs rounded-lg py-3 text-center text-sm font-black uppercase"
            style={{ background: "#FBB724", color: "#1a1200" }}
          >
            Voir l&apos;analyse complète →
          </button>
        </div>
      </div>

      <div className="border-t border-[var(--pmu-border)] px-5 py-2 text-center text-[10px] text-[var(--pmu-text-muted)]">
        ⚠️ Pari plus risqué — ne misez que ce que vous pouvez perdre
      </div>
    </section>
  );
}
