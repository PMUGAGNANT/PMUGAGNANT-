"use client";

import type { CourseParticipantRow } from "@/components/ui/ParticipantsTable";

type CoursePronosticData = {
  favoris?: Array<number | string>;
  top5?: Array<number | string>;
  scoreConfiance?: number | null;
  valueBet?: number | string | null;
  miseConseil?: number | null;
  recommandation?: string | null;
  pourquoi?: string[];
};

interface CoursePronosticProps {
  pronostic: CoursePronosticData;
  participants: CourseParticipantRow[];
}

function formatBetType(value?: string | null) {
  if (!value) return "Gagnant";
  if (value.toUpperCase() === "PLACE") return "Placé";
  return "Gagnant";
}

function getSelectedHorse(pronostic: CoursePronosticData, participants: CourseParticipantRow[]) {
  const targetNumber = pronostic.favoris?.[0] ?? pronostic.top5?.[0] ?? null;
  if (targetNumber === null) return participants[0] ?? null;

  return (
    participants.find((item) => String(item.numero) === String(targetNumber)) ??
    participants[0] ??
    null
  );
}

function getVerdictLabel(pronostic: CoursePronosticData) {
  const recommendation = pronostic.recommandation?.toUpperCase() ?? "";

  if (pronostic.valueBet) {
    return {
      label: "Bonne opportunité",
      tone: "rgb(251 191 36)",
      background: "rgba(251, 191, 36, 0.12)",
    };
  }

  if (recommendation.includes("SURVEILL")) {
    return {
      label: "À surveiller",
      tone: "rgb(245 158 11)",
      background: "rgba(245, 158, 11, 0.12)",
    };
  }

  if (recommendation.includes("PASS")) {
    return {
      label: "À éviter",
      tone: "var(--pmu-red)",
      background: "color-mix(in srgb, var(--pmu-red) 14%, transparent)",
    };
  }

  return {
    label: "Coup sûr du jour",
    tone: "var(--pmu-primary)",
    background: "var(--pmu-primary-soft)",
  };
}

export function CoursePronostic({ pronostic, participants }: CoursePronosticProps) {
  const selectedHorse = getSelectedHorse(pronostic, participants);

  if (!selectedHorse) {
    return null;
  }

  const confidence = Math.max(0, Math.min(pronostic.scoreConfiance ?? 0, 10));
  const verdict = getVerdictLabel(pronostic);

  return (
    <section className="app-card px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="app-kicker">Pronostic IA</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)] md:text-3xl">
            N°{selectedHorse.numero} {selectedHorse.nom}
          </h2>
        </div>
        <span
          className="rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em]"
          style={{ color: verdict.tone, background: verdict.background }}
        >
          {verdict.label}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
        <div className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--pmu-text-soft)]">Confiance du moteur</p>
            <span className="font-mono text-lg font-black text-[var(--pmu-primary)]">
              {confidence.toFixed(1)}/10
            </span>
          </div>

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--pmu-bg)]">
            <div
              className="h-full rounded-full bg-[var(--pmu-primary)] transition-[width] duration-500"
              style={{ width: `${confidence * 10}%` }}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[var(--pmu-bg)] px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">
                Pari conseillé
              </p>
              <p className="mt-2 text-xl font-black text-[var(--pmu-text)]">
                {formatBetType(pronostic.recommandation)}
              </p>
            </div>

            <div className="rounded-2xl bg-[var(--pmu-bg)] px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">
                Mise conseillée
              </p>
              <p className="mt-2 text-xl font-black text-[var(--pmu-text)]">
                {pronostic.miseConseil ?? 0}€
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">
            Pourquoi lui ?
          </p>
          <div className="mt-3 space-y-2">
            {(pronostic.pourquoi ?? []).slice(0, 4).map((factor) => (
              <div key={factor} className="flex items-start gap-2 text-sm text-[var(--pmu-text)]">
                <span className="mt-[2px] text-[var(--pmu-primary)]">•</span>
                <span>{factor}</span>
              </div>
            ))}
            {(pronostic.pourquoi ?? []).length === 0 ? (
              <p className="text-sm text-[var(--pmu-text-soft)]">
                Le moteur retient ce cheval sur la synthèse globale de la course.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
