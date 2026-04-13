"use client";

import type { CourseParticipantRow } from "@/features/race/components/ParticipantsTable";
import type { PronosticCardData } from "@/features/race/lib/race-page-model";

interface CoursePronosticProps {
  pronostic: PronosticCardData;
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
  if (normalized.includes("place")) return "Simple place";
  if (normalized.includes("surveill")) return "Simple place";
  if (normalized.includes("couple")) return "Couple";
  return "Simple gagnant";
}

function getSelectedHorse(
  pronostic: PronosticCardData,
  participants: CourseParticipantRow[] | null | undefined
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

function buildReasons(
  pronostic: PronosticCardData,
  selectedHorse: CourseParticipantRow
) {
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
      reasons.add("Cote intéressante avec un vrai rapport risque rendement.");
    }
  }

  const human = selectedHorse.jockey || selectedHorse.driver;
  if (human) {
    reasons.add(`Pilotage confié à ${human}.`);
  }

  if (selectedHorse.entraineur) {
    reasons.add(`Entraînement ${selectedHorse.entraineur}.`);
  }

  if (
    selectedHorse.corde !== null &&
    selectedHorse.corde !== undefined &&
    `${selectedHorse.corde}` !== ""
  ) {
    reasons.add("Profil poids corde cohérent.");
  }

  if (reasons.size === 0) {
    reasons.add("Le moteur retient ce cheval sur la synthèse globale de la course.");
  }

  return [...reasons].slice(0, 4);
}

function getVerdictLabel(pronostic: PronosticCardData) {
  const recommendation = normalizeKey(pronostic.recommandation ?? "");

  if (pronostic.valueBet) {
    return {
      label: "Bonne opportunité",
      tone: "var(--pmu-orange)",
      background: "color-mix(in srgb, var(--pmu-orange) 12%, transparent)",
    };
  }

  if (recommendation.includes("surveill")) {
    return {
      label: "À surveiller",
      tone: "var(--pmu-orange)",
      background: "color-mix(in srgb, var(--pmu-orange) 12%, transparent)",
    };
  }

  if (recommendation.includes("pass") || recommendation.includes("eviter")) {
    return {
      label: "À éviter",
      tone: "var(--pmu-red)",
      background: "color-mix(in srgb, var(--pmu-red) 12%, transparent)",
    };
  }

  return {
    label: "Signal principal",
    tone: "var(--pmu-primary)",
    background: "var(--pmu-primary-soft)",
  };
}

export function CoursePronostic({
  pronostic,
  participants,
}: CoursePronosticProps) {
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
  const progress = Math.min(100, Math.max(0, confidence * 10));
  const pepite =
    pronostic.valueBet !== null && pronostic.valueBet !== undefined
      ? safeParticipants.find(
          (item) => String(item.numero) === String(pronostic.valueBet)
        ) ?? null
      : null;

  return (
    <section className="app-card p-5 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[1.12fr,0.88fr] xl:items-start">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em]"
              style={{ color: verdict.tone, background: verdict.background }}
            >
              {verdict.label}
            </span>
            <span className="app-pill text-xs">
              Ticket {betType}
            </span>
            <span className="app-pill text-xs">
              Confiance {confidence.toFixed(1)}/10
            </span>
          </div>

          <div>
            <p className="app-kicker">Décision moteur</p>
            <h2 className="mt-2 text-[2.1rem] font-black leading-[0.94] text-[var(--pmu-text)] md:text-[3.2rem]">
              N°{selectedHorse.numero}{" "}
              <span style={{ color: verdict.tone }}>{selectedHorse.nom}</span>
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
              {human ? `${human} · ` : ""}
              {selectedHorse.entraineur
                ? `Entraînement ${selectedHorse.entraineur}. `
                : ""}
              Le moteur garde ce cheval comme point d&apos;entrée principal sur la
              course.
            </p>
          </div>

          <div className="rounded-[1.3rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="app-label">Baromètre de confiance</p>
              <span className="text-lg font-black" style={{ color: verdict.tone }}>
                {confidence.toFixed(1)}/10
              </span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--pmu-bg)]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${verdict.tone}, color-mix(in srgb, ${verdict.tone} 60%, white))`,
                }}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {reasons.map((reason, index) => (
                <div
                  key={`${reason}-${index}`}
                  className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_90%,transparent)] px-4 py-3 text-sm leading-6 text-[var(--pmu-text-soft)]"
                >
                  <span
                    className="mr-2 text-xs font-black uppercase tracking-[0.14em]"
                    style={{ color: verdict.tone }}
                  >
                    0{index + 1}
                  </span>
                  {reason}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Pari</p>
              <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                {betType}
              </p>
            </div>
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Mise</p>
              <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                {pronostic.miseConseil ?? 0} EUR
              </p>
            </div>
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Cote</p>
              <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                {typeof selectedHorse.cote === "number" &&
                Number.isFinite(selectedHorse.cote)
                  ? selectedHorse.cote.toFixed(1)
                  : "--"}
              </p>
            </div>
          </div>

          <div className="rounded-[1.3rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-4">
            <p className="app-kicker text-[10px]">Synthèse ticket</p>
            <div className="mt-3 space-y-3 text-sm text-[var(--pmu-text-soft)]">
              <div className="flex items-center justify-between gap-3">
                <span>Cheval retenu</span>
                <span className="font-black text-[var(--pmu-text)]">
                  N°{selectedHorse.numero}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Lecture</span>
                <span className="font-black text-[var(--pmu-text)]">
                  {verdict.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Profil</span>
                <span className="font-black text-[var(--pmu-text)]">
                  {selectedHorse.musique || "À confirmer"}
                </span>
              </div>
            </div>
          </div>

          {pepite && String(pepite.numero) !== String(selectedHorse.numero) ? (
            <div className="rounded-[1.3rem] border px-4 py-4" style={{
              borderColor: "color-mix(in srgb, var(--pmu-orange) 28%, transparent)",
              background: "color-mix(in srgb, var(--pmu-orange) 10%, var(--pmu-surface))",
            }}>
              <p className="app-kicker text-[10px]" style={{ color: "var(--pmu-orange)" }}>
                Option secondaire
              </p>
              <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                N°{pepite.numero} {pepite.nom}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
                Profil plus spéculatif à garder en observation, surtout si la
                cote reste bien orientée.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
