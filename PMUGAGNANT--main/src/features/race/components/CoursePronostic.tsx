"use client";

import { useState, type CSSProperties } from "react";
import { FavoriteFormChart } from "@/features/race/components/FavoriteFormChart";
import type { CourseParticipantRow } from "@/features/race/components/ParticipantsTable";
import type { PronosticCardData, RaceCourseInfo } from "@/features/race/lib/race-page-model";
import { getBrowserAuthorizationHeader } from "@/features/races/api/client";

interface CoursePronosticProps {
  pronostic: PronosticCardData;
  participants: CourseParticipantRow[] | null | undefined;
  courseInfo: RaceCourseInfo;
}

type ReasonTone = "positive" | "warning";

interface ReasonCard {
  icon: string;
  text: string;
  tone: ReasonTone;
}

type ConfidenceTone = "risk" | "correct" | "excellent" | "safe";

interface ConfidenceProfile {
  label: string;
  color: string;
  tone: ConfidenceTone;
}

const ICONS = {
  target: "\u{1F3AF}",
  chart: "\u{1F4C8}",
  human: "\u{1F464}",
  warning: "\u26A0\uFE0F",
  lock: "\u{1F512}",
  check: "\u2713",
} as const;

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
  if (typeof explicitStake === "number" && Number.isFinite(explicitStake)) {
    // Algo computed a stake: use it whether positive (bet) or 0 (REJET – don't override).
    if (explicitStake >= 0) return explicitStake;
  }

  // Fallback when the algo hasn't provided a stake (null / undefined).
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

  if (normalized.includes("forme recente")) return "Il reste sur une forme solide";
  if (normalized.includes("musique recente")) return "Ses dernières sorties sont régulières";
  if (normalized.includes("poids fraicheur")) return "Le poids et la fraîcheur sont bons";
  if (normalized.includes("distance piste")) return "La distance correspond à son profil";
  if (normalized.includes("marche pmu")) return "Le marché confirme sa chance";
  if (normalized.includes("jockey")) return "Son jockey renforce le ticket";
  if (normalized.includes("driver")) return "Son driver est un vrai plus";
  if (normalized.includes("entraineur")) return "Son entraîneur est fiable";
  if (normalized.includes("terrain")) return "Le terrain joue pour lui";
  if (normalized.includes("corde")) return "Son numéro de corde est correct";

  const cleaned = raw.trim().replace(/\.$/, "");
  if (!cleaned) return "";

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function getConfidenceProfile(confidence: number): ConfidenceProfile {
  if (confidence >= 8.5) {
    return {
      label: "Sûr",
      color: "var(--pmu-primary)",
      tone: "safe",
    };
  }

  if (confidence >= 7) {
    return {
      label: "Excellent",
      color: "var(--pmu-primary-bright)",
      tone: "excellent",
    };
  }

  if (confidence >= 5) {
    return {
      label: "Correct",
      color: "var(--pmu-orange)",
      tone: "correct",
    };
  }

  return {
    label: "Risqué",
    color: "var(--pmu-red)",
    tone: "risk",
  };
}

function buildReasons(
  pronostic: PronosticCardData,
  selectedHorse: CourseParticipantRow,
  odds: number | null,
  confidence: number
) {
  const positives: ReasonCard[] = [];
  const addPositive = (text: string, icon: string) => {
    if (!text || positives.some((reason) => reason.text === text)) return;
    positives.push({ icon, text, tone: "positive" });
  };

  for (const reason of pronostic.pourquoi ?? []) {
    addPositive(factorToSentence(reason), ICONS.target);
  }

  for (const factor of selectedHorse.topFacteurs ?? []) {
    addPositive(factorToSentence(factor), ICONS.chart);
  }

  if (selectedHorse.musique && selectedHorse.musique !== "--") {
    addPositive("Sa forme récente soutient le choix", ICONS.chart);
  }

  const human = selectedHorse.jockey || selectedHorse.driver;
  if (human) {
    addPositive(`${human} est associé au cheval`, ICONS.human);
  }

  const warnings: ReasonCard[] = [];
  if (odds !== null && odds >= 12) {
    warnings.push({
      icon: ICONS.warning,
      text: "Cote élevée, risque plus fort",
      tone: "warning",
    });
  } else if (!selectedHorse.musique || selectedHorse.musique === "--") {
    warnings.push({
      icon: ICONS.warning,
      text: "Historique récent incomplet",
      tone: "warning",
    });
  } else if (confidence < 7) {
    warnings.push({
      icon: ICONS.warning,
      text: "Mise prudente, pas de surjeu",
      tone: "warning",
    });
  }

  if (positives.length === 0) {
    addPositive("Le moteur IA le place devant le lot", ICONS.target);
  }

  const selected = positives.slice(0, warnings.length > 0 ? 2 : 3);
  return [...selected, ...warnings.slice(0, 1)].slice(0, 3);
}

function getRaceCode(courseInfo: RaceCourseInfo) {
  return `R${courseInfo.reunion ?? "?"}C${courseInfo.course ?? "?"}`;
}

function playConfirmationSound() {
  try {
    const audioWindow = window as Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextConstructor =
      window.AudioContext ?? audioWindow.webkitAudioContext;

    if (!AudioContextConstructor) return;

    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(990, context.currentTime + 0.14);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
    oscillator.onended = () => {
      void context.close();
    };
  } catch {
    // Browser audio can be blocked by device settings; the visual confirmation remains.
  }
}

export function CoursePronostic({ pronostic, participants, courseInfo }: CoursePronosticProps) {
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const selectedHorse = getSelectedHorse(pronostic, safeParticipants);
  const [betState, setBetState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [betMessage, setBetMessage] = useState("");
  const [confirmationVisible, setConfirmationVisible] = useState(false);

  if (!selectedHorse) {
    return null;
  }

  const confidence = Math.max(0, Math.min(pronostic.scoreConfiance ?? 0, 10));
  const confidenceProfile = getConfidenceProfile(confidence);
  const betType = formatBetType(pronostic.betType ?? pronostic.recommandation);
  const human = selectedHorse.jockey || selectedHorse.driver || "Jockey / driver à confirmer";
  const trainer = selectedHorse.entraineur || "Entraîneur à confirmer";
  const stake = getVisibleStake(pronostic, betType, confidence);
  const odds =
    typeof selectedHorse.cote === "number" && Number.isFinite(selectedHorse.cote)
      ? selectedHorse.cote
      : null;
  const shouldPlay = confidence >= 6 && stake > 0;
  const displayStake = shouldPlay ? stake : 0;
  const grossReturn = shouldPlay && odds ? stake * odds : null;
  const netReturn = grossReturn !== null ? grossReturn - stake : null;
  const decision = shouldPlay ? "JOUER" : "PASSER";
  const betCode = normalizeBetCode(pronostic.betType ?? pronostic.recommandation);
  const positiveSignals = Math.min(7, Math.max(1, Math.round(confidence * 0.7)));
  const reasons = buildReasons(pronostic, selectedHorse, odds, confidence);
  const canPlaceBet =
    shouldPlay &&
    Boolean(courseInfo.dateStr) &&
    typeof courseInfo.reunion === "number" &&
    typeof courseInfo.course === "number" &&
    typeof selectedHorse.numero !== "undefined" &&
    selectedHorse.numero !== null &&
    odds !== null;
  const actionDisabled = betState === "loading" || !canPlaceBet;
  const actionLabel =
    betState === "loading"
      ? "Enregistrement..."
      : betState === "success"
        ? "Ticket enregistré"
        : shouldPlay
          ? "Je joue ce ticket"
          : "On passe cette course";
  const ringStyle = {
    "--ring-color": confidenceProfile.color,
    "--ring-progress": `${confidence * 10}%`,
  } as CSSProperties;

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
      setBetMessage("Ticket enregistré dans ton historique.");
      setConfirmationVisible(true);
      playConfirmationSound();
      window.setTimeout(() => setConfirmationVisible(false), 1800);
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
    <section className="turf-bet-slip" data-decision={shouldPlay ? "play" : "pass"}>
      {confirmationVisible ? (
        <div className="turf-confirmation-burst" role="status">
          <span>{ICONS.check}</span>
          Ticket ajouté
        </div>
      ) : null}

      <div className="turf-decision-hero" data-tone={confidenceProfile.tone}>
        <div>
          <p className="app-kicker">{getRaceCode(courseInfo)} - décision immédiate</p>
          <h2>{decision}</h2>
          <p>
            {shouldPlay
              ? `${formatEuros(stake)} sur ${selectedHorse.nom || "ce cheval"}`
              : "Le signal n'est pas assez fort pour engager une vraie mise."}
          </p>
        </div>
        <div className="turf-confidence-ring" style={ringStyle}>
          <div>
            <strong>{confidence.toFixed(1)}</strong>
            <span>/10</span>
          </div>
          <em>{confidenceProfile.label}</em>
        </div>
      </div>

      <div className="turf-star-horse">
        <div className="turf-horse-number">{selectedHorse.numero ?? "--"}</div>
        <div className="min-w-0 flex-1">
          <p className="app-label">Cheval star</p>
          <h3>{selectedHorse.nom || "Cheval à confirmer"}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <span>{human}</span>
            <span>{trainer}</span>
            <span>Cote {formatOdds(selectedHorse.cote)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-[1fr,0.78fr] md:p-5">
        <div className="turf-stake-panel">
          <p className="app-label">Mise conseillée</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <strong>{formatEuros(displayStake)}</strong>
            <span>{shouldPlay ? betType : "Bankroll protégée"}</span>
          </div>
          <p className="mt-3 text-sm font-bold text-[var(--pmu-text)]">
            {shouldPlay
              ? odds
                ? `Mise ${formatEuros(stake)} → gain potentiel ${formatEuros(grossReturn ?? 0)}`
                : "Gain potentiel calculé dès que la cote est disponible."
              : "Signal insuffisant · mise à 0 · bankroll préservée."}
          </p>
          {shouldPlay && netReturn !== null ? (
            <p className="mt-1 text-xs font-semibold text-[var(--pmu-primary)]">
              Net potentiel : {netReturn >= 0 ? "+" : ""}
              {formatEuros(netReturn)}
            </p>
          ) : null}
        </div>

        <div className="turf-reason-panel">
          <p className="app-label">Pourquoi ce choix</p>
          <div className="mt-3 grid gap-2">
            {reasons.map((reason) => (
              <div key={`${reason.icon}-${reason.text}`} data-tone={reason.tone}>
                <span aria-hidden>{reason.icon}</span>
                <p>{reason.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-[var(--pmu-text-soft)]">
            {positiveSignals}/7 signaux positifs · lecture simple, mise maîtrisée.
          </p>
        </div>
      </div>

      <div className="grid gap-3 px-4 pb-4 md:grid-cols-[0.9fr,1.1fr] md:px-5 md:pb-5">
        <FavoriteFormChart musique={selectedHorse.musique} />

        <div className="turf-play-panel">
          <p className="app-label">Action</p>
          <button
            type="button"
            className="turf-play-button"
            disabled={actionDisabled}
            onClick={() => void handlePlaceBet()}
          >
            {actionLabel}
          </button>
          <p className="mt-3 text-xs leading-5 text-[var(--pmu-text-soft)]">
            Le ticket est enregistré dans ton historique avec la mise, la cote et
            le cheval joué.
          </p>
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

      <div className="turf-sticky-play md:hidden">
        <div>
          <p>{selectedHorse.nom || "Cheval conseillé"}</p>
          <span>
            {shouldPlay
              ? `${formatEuros(stake)} · cote ${formatOdds(selectedHorse.cote)}`
              : "On passe · bankroll protégée"}
          </span>
        </div>
        <button
          type="button"
          disabled={actionDisabled}
          onClick={() => void handlePlaceBet()}
        >
          {actionLabel}
        </button>
      </div>
    </section>
  );
}
