import type { AvisExpertPrediction, AvisPariType, AvisVerdict } from "@/lib/avis-generator";

const VERDICT_STYLES: Record<AvisVerdict, string> = {
  MISER: "bg-[var(--pmu-primary-soft)] text-[var(--pmu-primary)]",
  SURVEILLER: "bg-[var(--pmu-gold-light)] text-[var(--pmu-gold)]",
  EVITER: "bg-[var(--pmu-earth-light)] text-[var(--pmu-red)]",
};

const PARI_LABEL: Record<AvisPariType, string> = {
  GAGNANT: "Gagnant conseillé",
  PLACE: "Place conseillé",
};

const BORDER_COLORS = [
  "border-l-[var(--pmu-gold)]",
  "border-l-[var(--pmu-sand)]",
  "border-l-[var(--pmu-gold)]",
  "border-l-[var(--pmu-border-strong)]",
  "border-l-[var(--pmu-border-strong)]",
];

function EtoilesNote({ note }: { note: number }) {
  const etoiles = Math.round(note / 2);

  return (
    <div className="flex gap-0.5" aria-label={`Note ${note.toFixed(1)} sur 10`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <div
          key={index}
          className={`h-2.5 w-2.5 rounded-sm ${
            index <= etoiles ? "bg-[var(--pmu-gold)]" : "bg-[var(--pmu-surface-2)]"
          }`}
        />
      ))}
    </div>
  );
}

function PerfDots({ perfs }: { perfs?: string | null }) {
  const tokens = (perfs ?? "").split(/\s+/).filter(Boolean).slice(0, 5);
  if (tokens.length === 0) return null;

  return (
    <div className="mt-1.5 flex gap-1">
      {tokens.map((token, index) => {
        const normalized = token.toLowerCase();
        const isYear = normalized.includes("(");
        const isWinner = normalized.includes("g") || normalized === "1";
        const isPlace = normalized.includes("p") || ["2", "3"].includes(normalized);
        const label = token.replace(/[^0-9]/g, "").slice(0, 2) || "?";

        return (
          <div
            key={`${token}-${index}`}
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-medium ${
              isYear
                ? "bg-[var(--pmu-surface-2)] text-[var(--pmu-text-soft)]"
                : isWinner
                  ? "bg-[var(--pmu-gold-light)] text-[var(--pmu-gold)]"
                  : isPlace
                    ? "bg-[var(--pmu-primary-soft)] text-[var(--pmu-primary)]"
                    : "bg-[var(--pmu-earth-light)] text-[var(--pmu-red)]"
            }`}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

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
    <section className="app-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      <div className="mt-4 space-y-3">
        {top5.map((pred, index) => {
          const rang = index + 1;
          const isPremiumLocked = rang >= 4 && !isPremium;
          const note = pred.avis_note ?? 0;
          const verdict = pred.avis_verdict;

          return (
            <article
              key={pred.cheval_num}
              className={`rounded-r-lg border border-l-4 border-[var(--pmu-border)] ${
                BORDER_COLORS[index] ?? "border-l-slate-300"
              } bg-[var(--pmu-surface-highlight)] p-4 ${
                isPremiumLocked ? "opacity-75" : ""
              }`}
            >
              <div className="mb-3 flex items-start gap-3">
                <div
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                    rang === 1
                      ? "bg-[var(--pmu-gold-light)] text-[var(--pmu-gold)]"
                      : rang === 2
                        ? "bg-[var(--pmu-surface-2)] text-[var(--pmu-text-soft)]"
                        : rang === 3
                          ? "bg-[var(--pmu-gold-light)] text-[var(--pmu-gold)]"
                          : "bg-[var(--pmu-surface-2)] text-[var(--pmu-text-muted)]"
                  }`}
                >
                  {rang}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium text-[var(--pmu-text)]">
                      {pred.cheval_nom}
                    </span>
                    <span className="text-xs text-[var(--pmu-text-muted)]">
                      N{pred.cheval_num}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--pmu-text-muted)]">
                    Cote {formatCote(pred.cote_matin)}x
                  </div>
                  <PerfDots perfs={pred.performances_recentes} />
                </div>

                {!isPremiumLocked && note > 0 ? (
                  <div className="flex-shrink-0 text-right">
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-xl font-medium ${
                          note >= 8
                            ? "text-[var(--pmu-gold)]"
                            : note >= 6.5
                              ? "text-[var(--pmu-text-soft)]"
                              : "text-[var(--pmu-red)]"
                        }`}
                      >
                        {note.toFixed(1)}
                      </span>
                      <span className="text-xs text-[var(--pmu-text-muted)]">/10</span>
                    </div>
                    <EtoilesNote note={note} />
                  </div>
                ) : null}

                {isPremiumLocked ? (
                  <div className="flex-shrink-0 text-right">
                    <span className="text-xl font-medium text-[var(--pmu-text-muted)]">--</span>
                    <div className="text-xs text-[var(--pmu-text-muted)]">/10</div>
                  </div>
                ) : null}
              </div>

              {isPremiumLocked ? (
                <div className="mt-2 flex items-center gap-3 rounded-lg bg-[var(--pmu-surface-2)] px-3 py-2.5">
                  <span className="text-xs text-[var(--pmu-text-soft)]">
                    Avis expert et note réservés aux membres premium
                  </span>
                  <a
                    href="/premium"
                    className="ml-auto rounded-full border border-[var(--pmu-border)] bg-[var(--pmu-surface)] px-3 py-1 text-xs font-medium text-[var(--pmu-text-soft)]"
                  >
                    Débloquer
                  </a>
                </div>
              ) : (
                <>
                  {verdict ? (
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${VERDICT_STYLES[verdict]}`}
                      >
                        {verdict}
                      </span>
                      <span className="text-xs text-[var(--pmu-text-muted)]">
                        {pred.avis_pari_type ? PARI_LABEL[pred.avis_pari_type] : ""}
                      </span>
                    </div>
                  ) : null}

                  {pred.avis_texte ? (
                    <p className="text-xs italic leading-relaxed text-[var(--pmu-text-soft)]">
                      {pred.avis_texte}
                    </p>
                  ) : (
                    <p className="text-xs italic text-[var(--pmu-text-muted)]">
                      Avis en cours de génération...
                    </p>
                  )}

                  <div className="mt-3 border-t border-[var(--pmu-border)] pt-2.5">
                    <div className="flex flex-wrap gap-4 text-xs text-[var(--pmu-text-muted)]">
                      <span>
                        Score{" "}
                        <strong className="text-[var(--pmu-text)]">
                          {formatScore(pred.score_cheval)}/100
                        </strong>
                      </span>
                      <span>
                        Confiance{" "}
                        <strong className="text-[var(--pmu-text)]">
                          {pred.confiance.toFixed(1)}/10
                        </strong>
                      </span>
                      {pred.value && pred.value > 0 ? (
                        <span>
                          Value{" "}
                          <strong className="text-[var(--pmu-primary)]">
                            {pred.value.toFixed(1)}x
                          </strong>
                        </span>
                      ) : null}
                      <span
                        className={`ml-auto rounded-full px-2 py-0.5 text-xs ${
                          rang <= 3
                            ? "bg-[var(--pmu-primary-soft)] text-[var(--pmu-primary)]"
                            : "bg-[var(--pmu-gold-light)] text-[var(--pmu-gold)]"
                        }`}
                      >
                        {rang <= 3 ? "Gratuit" : "Premium"}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
