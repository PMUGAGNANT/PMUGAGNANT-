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

function formatOdds(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(1)
    : "--";
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

  const human = selectedHorse.jockey || selectedHorse.driver;
  if (human) {
    reasons.add(`Pilotage confié à ${human}.`);
  }

  if (selectedHorse.entraineur) {
    reasons.add(`Entraînement ${selectedHorse.entraineur}.`);
  }

  if (reasons.size === 0) {
    reasons.add("Le moteur retient ce cheval sur la synthèse globale de la course.");
  }

  return [...reasons].slice(0, 4);
}

export function CoursePronostic({ pronostic, participants }: CoursePronosticProps) {
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const selectedHorse = getSelectedHorse(pronostic, safeParticipants);

  if (!selectedHorse) {
    return null;
  }

  const confidence = Math.max(0, Math.min(pronostic.scoreConfiance ?? 0, 10));
  const betType = formatBetType(pronostic.betType ?? pronostic.recommandation);
  const reasons = buildReasons(pronostic, selectedHorse);
  const progress = Math.min(100, Math.max(0, confidence * 10));
  const human = selectedHorse.jockey || selectedHorse.driver || "Jockey / driver à confirmer";
  const trainer = selectedHorse.entraineur || "Entraîneur à confirmer";

  return (
    <section
      className="overflow-hidden"
      style={{
        background: "var(--pmu-surface)",
        border: "1px solid var(--pmu-border)",
        borderRadius: "8px",
      }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2"
        style={{
          background: "var(--pmu-primary)",
          color: "var(--pmu-on-primary)",
          padding: "0.65rem 1rem",
        }}
      >
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em]">
          Décision moteur
        </span>
        <span className="text-[0.72rem] font-semibold opacity-85">
          Signal validé · {betType}
        </span>
      </div>

      <div className="p-5">
        <div className="flex gap-4">
          <div
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center"
            style={{
              background: "#EAF3DE",
              borderRadius: "8px",
              color: "#2A4D12",
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "1.5rem",
              fontWeight: 700,
            }}
          >
            {selectedHorse.numero ?? "--"}
          </div>
          <div className="min-w-0 flex-1">
            <h2
              className="truncate"
              style={{
                color: "var(--pmu-text)",
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: "1.5rem",
                fontStyle: "italic",
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              {selectedHorse.nom || "Cheval à confirmer"}
            </h2>
            <p className="mt-1 text-sm text-[var(--pmu-text-soft)]">
              {human} · {trainer} · Cote {formatOdds(selectedHorse.cote)}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="app-label">Confiance</p>
            <span className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--pmu-primary)]">
              {confidence.toFixed(1)}/10
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--pmu-surface-2)]">
            <div
              className="h-full rounded-full bg-[var(--pmu-primary)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            { label: "Type pari", value: betType },
            { label: "Mise conseillée", value: `${pronostic.miseConseil ?? 0} EUR` },
            { label: "Cote", value: formatOdds(selectedHorse.cote) },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "#F5F2EB",
                borderRadius: "6px",
                padding: "0.7rem 0.8rem",
              }}
            >
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[var(--pmu-text-muted)]">
                {stat.label}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--pmu-text)]">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {reasons.map((reason, index) => (
            <div
              key={`${reason}-${index}`}
              style={{
                background: "#F5F2EB",
                borderRadius: "6px",
                padding: "0.75rem 0.85rem",
              }}
            >
              <span className="mr-2 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-[var(--pmu-primary)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-sm leading-6 text-[var(--pmu-text-soft)]">
                {reason}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
