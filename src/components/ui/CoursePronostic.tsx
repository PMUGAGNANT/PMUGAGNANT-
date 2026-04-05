"use client";

import type { CourseParticipantRow } from "@/components/ui/ParticipantsTable";

type CoursePronosticData = {
  favoris?: Array<number | string>;
  top5?: Array<number | string>;
  scoreConfiance?: number | null;
  valueBet?: number | string | null;
  miseConseil?: number | null;
  recommandation?: string | null;
  betType?: string | null;
  pourquoi?: string[];
};

interface CoursePronosticProps {
  pronostic: CoursePronosticData;
  participants: CourseParticipantRow[] | null | undefined;
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function formatBetType(value?: string | null) {
  if (!value) return "Simple gagnant";

  const normalized = normalizeKey(value);
  if (normalized.includes("place")) return "Simple placé";
  if (normalized.includes("surveill")) return "Simple placé";
  return "Simple gagnant";
}

function getSelectedHorse(
  pronostic: CoursePronosticData,
  participants: CourseParticipantRow[] | null | undefined,
) {
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const targetNumber = pronostic.favoris?.[0] ?? pronostic.top5?.[0] ?? null;
  if (targetNumber === null) return safeParticipants[0] ?? null;

  return (
    safeParticipants.find((item) => String(item.numero) === String(targetNumber)) ??
    safeParticipants[0] ??
    null
  );
}

function factorToSentence(raw: string) {
  const normalized = normalizeKey(raw);

  if (normalized.includes("forme recente")) return "Forme récente solide.";
  if (normalized.includes("musique recente")) return "Musique récente régulière.";
  if (normalized.includes("poids fraicheur")) return "Poids et fraîcheur cohérents.";
  if (normalized.includes("distance piste")) return "Distance et piste dans son profil.";
  if (normalized.includes("marche pmu")) return "Le marché PMU confirme sa chance.";
  if (normalized.includes("jockey")) return "Pilotage intéressant pour cette course.";
  if (normalized.includes("driver")) return "Driver bien placé dans ce lot.";
  if (normalized.includes("entraineur")) return "Entraînement fiable sur ce profil.";
  if (normalized.includes("terrain")) return "Terrain favorable à son profil.";
  if (normalized.includes("corde")) return "Numéro de corde cohérent.";

  const cleaned = raw.trim();
  if (!cleaned) return "";

  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}.`;
}

function buildReasons(pronostic: CoursePronosticData, selectedHorse: CourseParticipantRow) {
  const reasons = new Set<string>();

  for (const reason of pronostic.pourquoi ?? []) {
    const normalized = factorToSentence(reason);
    if (normalized) reasons.add(normalized);
  }

  for (const factor of selectedHorse.topFacteurs ?? []) {
    const normalized = factorToSentence(factor);
    if (normalized) reasons.add(normalized);
  }

  if (selectedHorse.musique && selectedHorse.musique !== "--") {
    reasons.add("Musique récente à surveiller de près.");
  }

  if (typeof selectedHorse.cote === "number" && Number.isFinite(selectedHorse.cote)) {
    if (selectedHorse.cote <= 5) {
      reasons.add("Le marché PMU le tient haut dans les jeux.");
    } else if (selectedHorse.cote <= 10) {
      reasons.add("Cote intéressante avec un vrai rapport risque / rendement.");
    }
  }

  const human = selectedHorse.jockey || selectedHorse.driver;
  if (human) {
    reasons.add(`Pilotage confié à ${human}.`);
  }

  if (selectedHorse.entraineur) {
    reasons.add(`Entraînement ${selectedHorse.entraineur}.`);
  }

  if (selectedHorse.corde !== null && selectedHorse.corde !== undefined && `${selectedHorse.corde}` !== "") {
    reasons.add("Profil poids / corde cohérent.");
  }

  if (reasons.size === 0) {
    reasons.add("Le moteur retient ce cheval sur la synthèse globale de la course.");
  }

  return [...reasons].slice(0, 4);
}

function getVerdictLabel(pronostic: CoursePronosticData) {
  const recommendation = normalizeKey(pronostic.recommandation ?? "");

  if (pronostic.valueBet) {
    return {
      label: "Bonne opportunité",
      tone: "rgb(251 191 36)",
      background: "rgba(251, 191, 36, 0.12)",
    };
  }

  if (recommendation.includes("surveill")) {
    return {
      label: "À surveiller",
      tone: "rgb(245 158 11)",
      background: "rgba(245, 158, 11, 0.12)",
    };
  }

  if (recommendation.includes("pass") || recommendation.includes("eviter")) {
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
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const selectedHorse = getSelectedHorse(pronostic, safeParticipants);

  if (!selectedHorse) {
    return null;
  }

  const confidence = Math.max(0, Math.min(pronostic.scoreConfiance ?? 0, 10));
  const verdict = getVerdictLabel(pronostic);
  const betType = formatBetType(pronostic.betType ?? pronostic.recommandation);
  const reasons = buildReasons(pronostic, selectedHorse);
  const human = selectedHorse.jockey || selectedHorse.driver;

  const pepite =
    pronostic.valueBet !== null && pronostic.valueBet !== undefined
      ? safeParticipants.find((item) => String(item.numero) === String(pronostic.valueBet)) ?? null
      : null;

  return (
    <section className="app-card px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="app-kicker">Pronostic IA</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)] md:text-3xl">
            N°{selectedHorse.numero} {selectedHorse.nom}
          </h2>
          <p className="mt-1 text-sm text-[var(--pmu-text-soft)]">
            {human ? `${human} · ` : ""}
            {selectedHorse.entraineur ? `Entraînement ${selectedHorse.entraineur}` : "Lecture globale du moteur"}
          </p>
        </div>

        <span
          className="rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em]"
          style={{ color: verdict.tone, background: verdict.background }}
        >
          {verdict.label}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
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
              <p className="mt-2 text-xl font-black text-[var(--pmu-text)]">{betType}</p>
            </div>

            <div className="rounded-2xl bg-[var(--pmu-bg)] px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">
                Mise conseillée
              </p>
              <p className="mt-2 text-xl font-black text-[var(--pmu-text)]">{pronostic.miseConseil ?? 0}€</p>
            </div>
          </div>

          {pepite && String(pepite.numero) !== String(selectedHorse.numero) ? (
            <div className="mt-4 rounded-2xl border border-[rgba(251,191,36,0.16)] bg-[rgba(251,191,36,0.06)] px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[rgb(251,191,36)]">Pépite à suivre</p>
              <p className="mt-1 text-base font-bold text-[var(--pmu-text)]">
                N°{pepite.numero} {pepite.nom}
              </p>
              <p className="mt-1 text-sm text-[var(--pmu-text-soft)]">
                Option plus risquée, mais intéressante à la cote.
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--pmu-text-soft)]">
            Pourquoi lui ?
          </p>
          <div className="mt-3 space-y-2">
            {reasons.map((factor) => (
              <div key={factor} className="flex items-start gap-2 text-sm text-[var(--pmu-text)]">
                <span className="mt-[2px] text-[var(--pmu-primary)]">•</span>
                <span>{factor}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
