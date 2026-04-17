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

function formatEuros(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getVisibleStake(pronostic: PronosticCardData, betType: string, confidence: number) {
  const explicitStake = pronostic.miseConseil;
  if (typeof explicitStake === "number" && Number.isFinite(explicitStake) && explicitStake > 0) {
    return explicitStake;
  }

  const normalizedBetType = normalizeKey(betType);
  if (normalizedBetType.includes("gagnant") && confidence >= 7) {
    return 10;
  }

  if (normalizedBetType.includes("place") || confidence >= 6) {
    return 8;
  }

  return 6;
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
  const stake = getVisibleStake(pronostic, betType, confidence);
  const odds = typeof selectedHorse.cote === "number" && Number.isFinite(selectedHorse.cote)
    ? selectedHorse.cote
    : null;
  const grossReturn = odds ? stake * odds : null;
  const netReturn = grossReturn !== null ? grossReturn - stake : null;
  const netReturnLabel =
    netReturn !== null
      ? `${netReturn >= 0 ? "+" : ""}${formatEuros(netReturn)} net potentiel`
      : "À suivre";

  return (
    <section className="premium-ticket-shell">
      <div className="premium-ticket-bar">
        <span className="text-[0.72rem] font-bold uppercase">
          Pronostic validé
        </span>
        <span className="rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-[0.72rem] font-semibold">
          {betType}
        </span>
      </div>

      <div className="p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr,18rem] lg:items-start">
          <div className="flex gap-4">
            <div
              className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--pmu-primary)_22%,transparent)] bg-[var(--pmu-primary-soft)] text-2xl font-black text-[var(--pmu-primary)] shadow-[var(--pmu-shadow-sm)]"
            >
              {selectedHorse.numero ?? "--"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="app-kicker">Course → pronostic</p>
              <h2 className="mt-1 truncate text-[1.75rem] font-black leading-tight text-[var(--pmu-text)] md:text-[2.15rem]">
                {selectedHorse.nom || "Cheval à confirmer"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
                {human} · {trainer} · Cote {formatOdds(selectedHorse.cote)}
              </p>
            </div>
          </div>

          <div
            className="stake-chip px-4 py-4"
            aria-label={`Mise conseillée ${formatEuros(stake)}`}
          >
            <p className="text-[0.72rem] font-bold uppercase text-[var(--pmu-gold)]">
              Mise conseillée
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-4xl font-bold leading-none text-[var(--pmu-text)]">
              {formatEuros(stake)}
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[var(--pmu-text-soft)]">
              {odds
                ? `${formatEuros(stake)} × cote ${formatOdds(odds)} = ${formatEuros(grossReturn ?? 0)} brut`
                : "Calcul du retour potentiel en attente de cote."}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[1.2fr,0.8fr]">
          <div className="result-chip px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="app-label">Confiance moteur</p>
              <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--pmu-primary)]">
                {confidence.toFixed(1)}/10
              </span>
            </div>
            <div className="confidence-meter mt-3" aria-hidden>
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="app-pill text-xs">Pronostic</span>
              <span className="app-pill text-xs">{betType}</span>
              <span className="app-pill text-xs">Lecture premium</span>
            </div>
          </div>

          <div className="result-chip px-4 py-4">
            <p className="app-label">Résultat attendu</p>
            <p className="mt-2 text-xl font-black text-[var(--pmu-text)]">
              {netReturnLabel}
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--pmu-text-soft)]">
              Le résultat réel sera rapproché de l&apos;arrivée officielle dès validation.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            { label: "Type pari", value: betType },
            { label: "Mise", value: formatEuros(stake) },
            { label: "Cote", value: formatOdds(selectedHorse.cote) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="result-chip px-4 py-3"
            >
              <p className="text-[0.72rem] font-bold uppercase text-[var(--pmu-text-muted)]">
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
              className="result-chip px-4 py-3"
            >
              <span className="mr-2 text-[0.72rem] font-bold uppercase text-[var(--pmu-primary)]">
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
