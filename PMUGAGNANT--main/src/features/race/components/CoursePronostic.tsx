"use client";

import { useState } from "react";
import { FavoriteFormChart } from "@/features/race/components/FavoriteFormChart";
import type { CourseParticipantRow } from "@/features/race/components/ParticipantsTable";
import type { PronosticCardData, RaceCourseInfo } from "@/features/race/lib/race-page-model";
import { getBrowserAuthorizationHeader } from "@/features/races/api/client";

interface CoursePronosticProps {
  pronostic: PronosticCardData;
  participants: CourseParticipantRow[] | null | undefined;
  courseInfo: RaceCourseInfo;
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

function normalizeBetCode(value?: string | null): "GAGNANT" | "PLACE" {
  const normalized = normalizeKey(value ?? "");
  return normalized.includes("place") || normalized.includes("surveill")
    ? "PLACE"
    : "GAGNANT";
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

  if (normalized.includes("forme recente")) return "Forme recente solide.";
  if (normalized.includes("musique recente")) return "Musique recente reguliere.";
  if (normalized.includes("poids fraicheur")) return "Poids et fraicheur coherents.";
  if (normalized.includes("distance piste")) return "Distance et piste dans son profil.";
  if (normalized.includes("marche pmu")) return "Le marche PMU confirme sa chance.";
  if (normalized.includes("jockey")) return "Pilotage interessant pour cette course.";
  if (normalized.includes("driver")) return "Driver bien place dans ce lot.";
  if (normalized.includes("entraineur")) return "Entrainement fiable sur ce profil.";
  if (normalized.includes("terrain")) return "Terrain favorable a son profil.";
  if (normalized.includes("corde")) return "Numero de corde coherent.";

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
    reasons.add("Musique recente a surveiller de pres.");
  }

  const human = selectedHorse.jockey || selectedHorse.driver;
  if (human) {
    reasons.add(`Pilotage confie a ${human}.`);
  }

  if (selectedHorse.entraineur) {
    reasons.add(`Entrainement ${selectedHorse.entraineur}.`);
  }

  if (reasons.size === 0) {
    reasons.add("Le moteur retient ce cheval sur la synthese globale de la course.");
  }

  return [...reasons].slice(0, 4);
}

export function CoursePronostic({ pronostic, participants, courseInfo }: CoursePronosticProps) {
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const selectedHorse = getSelectedHorse(pronostic, safeParticipants);
  const [betState, setBetState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [betMessage, setBetMessage] = useState("");

  if (!selectedHorse) {
    return null;
  }

  const confidence = Math.max(0, Math.min(pronostic.scoreConfiance ?? 0, 10));
  const betType = formatBetType(pronostic.betType ?? pronostic.recommandation);
  const reasons = buildReasons(pronostic, selectedHorse);
  const progress = Math.min(100, Math.max(0, confidence * 10));
  const human = selectedHorse.jockey || selectedHorse.driver || "Jockey / driver a confirmer";
  const trainer = selectedHorse.entraineur || "Entraineur a confirmer";
  const stake = getVisibleStake(pronostic, betType, confidence);
  const odds = typeof selectedHorse.cote === "number" && Number.isFinite(selectedHorse.cote)
    ? selectedHorse.cote
    : null;
  const grossReturn = odds ? stake * odds : null;
  const netReturn = grossReturn !== null ? grossReturn - stake : null;
  const netReturnLabel =
    netReturn !== null
      ? `${netReturn >= 0 ? "+" : ""}${formatEuros(netReturn)} net potentiel`
      : "A suivre";
  const shouldPlay = confidence >= 6 && stake > 0;
  const decision = shouldPlay
    ? { label: "JOUER", tone: "success" as const }
    : { label: "PASSER", tone: "neutral" as const };
  const positiveSignals = Math.min(7, Math.max(1, reasons.length + (confidence >= 7 ? 3 : 2)));
  const confidenceText = shouldPlay
    ? `L'algo est tres confiant sur cette course car ${positiveSignals} signaux positifs sur 7 vont dans le meme sens.`
    : "Le moteur ne conseille pas de mise forte sur cette course.";
  const betCode = normalizeBetCode(pronostic.betType ?? pronostic.recommandation);
  const canPlaceBet =
    shouldPlay &&
    Boolean(courseInfo.dateStr) &&
    typeof courseInfo.reunion === "number" &&
    typeof courseInfo.course === "number" &&
    typeof selectedHorse.numero !== "undefined" &&
    selectedHorse.numero !== null &&
    odds !== null;

  async function handlePlaceBet() {
    if (!canPlaceBet || odds === null) {
      setBetState("error");
      setBetMessage("Cote ou identifiant de course manquant pour enregistrer ce ticket.");
      return;
    }

    setBetState("loading");
    setBetMessage("");

    try {
      const headers = await getBrowserAuthorizationHeader();
      const response = await fetch("/api/bets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(headers ?? {}),
        },
        body: JSON.stringify({
          date_str: courseInfo.dateStr,
          reunion: courseInfo.reunion,
          course: courseInfo.course,
          hippodrome: courseInfo.hippodrome ?? "",
          heure_depart: courseInfo.heureDepart ?? "",
          cheval_num: Number(selectedHorse.numero),
          cheval_nom: selectedHorse.nom ?? "",
          type_pari: betCode,
          mise: Math.max(1, Math.round(stake)),
          cote: odds,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Impossible d'enregistrer ce ticket.");
      }

      setBetState("success");
      setBetMessage("Ticket enregistre dans Mes paris.");
    } catch (error) {
      setBetState("error");
      setBetMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer ce ticket."
      );
    }
  }

  return (
    <section className="premium-ticket-shell">
      <div className="premium-ticket-bar">
        <span className="text-[0.72rem] font-bold uppercase">
          Decision {decision.label}
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
              <p className="app-kicker">Course - decision</p>
              <h2 className="mt-1 truncate text-[1.75rem] font-black leading-tight text-[var(--pmu-text)] md:text-[2.15rem]">
                {selectedHorse.nom || "Cheval a confirmer"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
                {human} - {trainer} - Cote {formatOdds(selectedHorse.cote)}
              </p>
            </div>
          </div>

          <div
            className="stake-chip px-4 py-4"
            aria-label={`Mise conseillee ${formatEuros(stake)}`}
          >
            <p className="text-[0.72rem] font-bold uppercase text-[var(--pmu-gold)]">
              Mise conseillee
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-4xl font-bold leading-none text-[var(--pmu-text)]">
              {formatEuros(stake)}
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[var(--pmu-text-soft)]">
              {odds
                ? `Mise ${formatEuros(stake)} -> Gain potentiel ${formatEuros(grossReturn ?? 0)}`
                : "Calcul du retour potentiel en attente de cote."}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[1.2fr,0.8fr]">
          <div className="result-chip px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="app-label">Confiance expliquee</p>
              <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--pmu-primary)]">
                {confidence.toFixed(1)}/10
              </span>
            </div>
            <div className="confidence-meter mt-3" aria-hidden>
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="turf-decision-badge" data-tone={decision.tone}>
                {decision.label}
              </span>
              <span className="app-pill text-xs">{betType}</span>
              <span className="app-pill text-xs">{positiveSignals}/7 signaux positifs</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
              {confidenceText}
            </p>
          </div>

          <div className="result-chip px-4 py-4">
            <p className="app-label">Gain attendu</p>
            <p className="mt-2 text-xl font-black text-[var(--pmu-text)]">
              {netReturnLabel}
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--pmu-text-soft)]">
              Le resultat reel sera rapproche de l&apos;arrivee officielle apres validation.
            </p>
            <button
              type="button"
              className="app-button-primary mt-4 w-full justify-center"
              disabled={betState === "loading" || !canPlaceBet}
              onClick={() => void handlePlaceBet()}
              style={{
                opacity: betState === "loading" || !canPlaceBet ? 0.62 : 1,
              }}
            >
              {betState === "loading" ? "Enregistrement..." : "Je joue ce ticket"}
            </button>
            {betMessage ? (
              <p
                className={`mt-3 text-xs font-bold ${
                  betState === "success" ? "text-[var(--pmu-primary)]" : "text-[var(--pmu-red)]"
                }`}
              >
                {betMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <FavoriteFormChart musique={selectedHorse.musique} />
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-4">
          {[
            { label: "Decision", value: decision.label },
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
