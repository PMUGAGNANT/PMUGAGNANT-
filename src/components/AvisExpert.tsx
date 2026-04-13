import type { AvisExpertPrediction, AvisPariType, AvisVerdict } from "@/lib/avis-generator";

const VERDICT_STYLES: Record<
  AvisVerdict,
  {
    background: string;
    color: string;
    label: string;
  }
> = {
  MISER: {
    background: "#EAF3DE",
    color: "#2A4D12",
    label: "Miser",
  },
  SURVEILLER: {
    background: "#FEF3C7",
    color: "#8C6D2F",
    label: "Surveiller",
  },
  EVITER: {
    background: "#FFF1EE",
    color: "#B85030",
    label: "Eviter",
  },
};

const PARI_LABEL: Record<AvisPariType, string> = {
  GAGNANT: "Gagnant",
  PLACE: "Place",
};

function formatCote(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "--";
}

function formatScore(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

export function AvisExpert({
  predictions,
  isPremium,
}: {
  predictions: AvisExpertPrediction[];
  isPremium: boolean;
}) {
  const top5 = predictions.slice(0, 5);
  if (top5.length === 0) return null;

  return (
    <section
      style={{
        background: "var(--pmu-surface)",
        border: "1px solid var(--pmu-border)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--pmu-border)] px-4 py-3">
        <div>
          <p className="app-kicker">Avis expert IA</p>
          <h2 className="mt-1 text-xl font-black text-[var(--pmu-text)]">
            Top 5 algo
          </h2>
        </div>
        <span className="rounded-lg border border-[var(--pmu-border)] px-3 py-1 text-xs font-semibold uppercase text-[var(--pmu-text-soft)]">
          Top 3 gratuit
        </span>
      </div>

      <div>
        {top5.map((pred, index) => {
          const rang = index + 1;
          const isPremiumLocked = rang >= 4 && !isPremium;
          const note = pred.avis_note ?? 0;
          const verdict = pred.avis_verdict;
          const verdictStyle = verdict ? VERDICT_STYLES[verdict] : null;

          if (isPremiumLocked) {
            return (
              <div
                key={pred.cheval_num}
                className="flex items-center gap-3 border-t border-[rgba(24,22,15,0.06)] px-4 py-3"
                style={{ background: "#F5F2EB" }}
              >
                <span aria-hidden className="text-base">
                  🔒
                </span>
                <span className="flex-1 text-sm text-[var(--pmu-text-muted)]">
                  N°{pred.cheval_num} - avis réservé aux membres premium
                </span>
                <a
                  href="/premium"
                  className="rounded-md bg-[var(--pmu-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--pmu-on-primary)]"
                >
                  Débloquer
                </a>
              </div>
            );
          }

          return (
            <article
              key={pred.cheval_num}
              className="grid gap-3 border-t border-[var(--pmu-border)] px-4 py-3 md:grid-cols-[44px,1fr,92px,110px] md:items-center"
            >
              <div
                style={{
                  color: "#8C6D2F",
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontSize: "1.1rem",
                  fontStyle: "italic",
                  fontWeight: 700,
                }}
              >
                {rang}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="truncate text-sm font-semibold text-[var(--pmu-text)]">
                    {pred.cheval_nom}
                  </p>
                  <span className="text-xs text-[var(--pmu-text-muted)]">
                    N°{pred.cheval_num} · Cote {formatCote(pred.cote_matin)}
                  </span>
                </div>
                <p className="mt-1 text-xs italic leading-5 text-[var(--pmu-text-soft)]">
                  {pred.avis_texte || "Avis en cours de génération."}
                </p>
                <p className="mt-1 text-[0.68rem] text-[var(--pmu-text-muted)]">
                  Score {formatScore(pred.score_cheval)}/100 · Confiance{" "}
                  {pred.confiance.toFixed(1)}/10
                  {pred.avis_pari_type ? ` · ${PARI_LABEL[pred.avis_pari_type]}` : ""}
                </p>
              </div>

              <div className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--pmu-primary)]">
                {note > 0 ? note.toFixed(1) : "--"}
                <span className="ml-1 text-xs font-normal text-[var(--pmu-text-muted)]">
                  /10
                </span>
              </div>

              <div>
                {verdictStyle ? (
                  <span
                    className="inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.06em]"
                    style={{
                      background: verdictStyle.background,
                      color: verdictStyle.color,
                    }}
                  >
                    {verdictStyle.label}
                  </span>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
