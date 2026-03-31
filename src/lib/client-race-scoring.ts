import type { Lisibilite, PredictionDecision, RaceSummary } from "@/lib/types";
import {
  CONFIDENCE_BUCKET_HIGH,
  CONFIDENCE_BUCKET_MEDIUM,
  getRadarStageWeight,
  SEUIL_JOUABLE,
  SEUIL_SURVEILLANCE,
} from "@/lib/scoring-policy";

export type HomeScoreStage = "preview_2h" | "preview_1h" | "final_30m" | "finished";

export { SEUIL_JOUABLE, SEUIL_SURVEILLANCE } from "@/lib/scoring-policy";

export type PlayTier = "jouable" | "surveillance" | "passer" | "resultat";

/** Données scores issues de /api/races/scores (champs utiles au client). */
export interface ApiRaceScoreLite {
  score: number | null | undefined;
  stage: HomeScoreStage;
  lisibilite: Lisibilite;
  decision: PredictionDecision;
  playable: boolean;
  pick?: {
    numPmu?: number | null;
    nom?: string | null;
    confidence?: number | null;
    betType?: string | null;
  } | null;
}

export interface ClientRaceScoreResult {
  /** Score consolidé 0–10 affiché dans l’UI */
  displayScore: number;
  playTier: PlayTier;
  /** Synthèse courte pour le radar */
  radarSentence: string;
  /** Ratio confiance / enjeu / taille de champ pour classer le radar du jour */
  radarRatio: number;
  factors: string[];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function inferStageFromMinutes(minutesUntilStart: number): HomeScoreStage {
  if (minutesUntilStart < -10) return "finished";
  if (minutesUntilStart <= 30) return "final_30m";
  if (minutesUntilStart <= 60) return "preview_1h";
  if (minutesUntilStart <= 120) return "preview_2h";
  return "preview_2h";
}

function baseScoreFromContext(
  api: ApiRaceScoreLite | undefined,
  minutesUntilStart: number
): number {
  if (api != null && api.score != null && Number.isFinite(api.score)) {
    return clamp(Number(api.score), 0, 10);
  }
  if (api?.lisibilite === "LISIBLE") return 5.8;
  if (api?.lisibilite === "COMPLEXE") return 5.2;
  if (api?.lisibilite === "LOTERIE") return 4.2;
  const st = api?.stage ?? inferStageFromMinutes(minutesUntilStart);
  if (st === "finished") return 5;
  return 4.8;
}

function partantsAdjustment(n: number): { delta: number; label: string } {
  if (!Number.isFinite(n) || n <= 0) return { delta: 0, label: "" };
  if (n <= 8) return { delta: 0.45, label: "Peu de partants (signal plus lisible)" };
  if (n <= 10) return { delta: 0.35, label: "Peloton serré, lecture fiable" };
  if (n <= 14) return { delta: 0.12, label: "Taille de champ standard" };
  if (n <= 16) return { delta: -0.12, label: "Peloton large" };
  return { delta: -0.32, label: "Grande field : variance accrue" };
}

function allocationAdjustment(allocation: number | null | undefined): { delta: number; label: string } {
  if (allocation == null || !Number.isFinite(allocation) || allocation <= 0) {
    return { delta: -0.06, label: "Enjeu non communiqué" };
  }
  if (allocation >= 120_000) return { delta: 0.35, label: "Très gros enjeu (signal souvent plus propre)" };
  if (allocation >= 65_000) return { delta: 0.22, label: "Bel enjeu" };
  if (allocation >= 30_000) return { delta: 0.12, label: "Enjeu correct" };
  if (allocation >= 15_000) return { delta: 0, label: "" };
  return { delta: -0.1, label: "Enjeu modeste" };
}

function stageAdjustment(stage: HomeScoreStage, minutesUntilStart: number): { delta: number; label: string } {
  if (stage === "finished") return { delta: 0, label: "" };
  if (stage === "final_30m" || (minutesUntilStart <= 30 && minutesUntilStart > -10)) {
    return { delta: 0.38, label: "Fenêtre 30 min : note la plus fiable" };
  }
  if (stage === "preview_1h" || (minutesUntilStart <= 60 && minutesUntilStart > 30)) {
    return { delta: 0.2, label: "Fenêtre 1 h : lecture en consolidation" };
  }
  if (stage === "preview_2h") {
    return { delta: 0.06, label: "Note 2 h : à confirmer au rapprochement" };
  }
  return { delta: 0, label: "" };
}

function lisibiliteAdjustment(lis: Lisibilite): { delta: number; label: string } {
  if (lis === "LISIBLE") return { delta: 0.28, label: "Course lisible" };
  if (lis === "COMPLEXE") return { delta: -0.32, label: "Lecture complexe" };
  return { delta: -1.1, label: "Profil loterie" };
}

function distanceAdjustment(distance: number): { delta: number; label: string } {
  if (!Number.isFinite(distance) || distance <= 0) return { delta: 0, label: "" };
  if (distance >= 1400 && distance <= 2400) {
    return { delta: 0.1, label: "Distance courante (historiques plus comparables)" };
  }
  if (distance < 1200) return { delta: -0.06, label: "Sprint : sensibilité à l’écheveau" };
  if (distance > 3200) return { delta: -0.08, label: "Longue distance : sélection différente" };
  return { delta: 0, label: "" };
}

/** Spécialité approximative vs type de course (sans fiche cheval complète). */
function disciplineCoherence(race: RaceSummary): { delta: number; label: string } {
  const d = (race.discipline || "").toLowerCase();
  if (race.estPlat) {
    if (d.includes("haies") || d.includes("steeple")) {
      return { delta: 0.05, label: "Obstacle : critères adaptés au parcours" };
    }
    return { delta: 0.06, label: "Plat : critères distance / régularité" };
  }
  if (race.estTrot) {
    return { delta: 0.06, label: "Trot attelé : critères pilotage / régularité" };
  }
  if (d.includes("mont") || d.includes("haie")) {
    return { delta: 0.04, label: "Discipline obstacle" };
  }
  return { delta: 0, label: "" };
}

function coteProxyAdjustment(api: ApiRaceScoreLite | undefined): { delta: number; label: string } {
  if (!api?.pick) return { delta: 0, label: "" };
  const conf = api.pick.confidence;
  if (conf != null && conf >= CONFIDENCE_BUCKET_HIGH) {
    return { delta: 0.18, label: "Repère PMU fort sur le ticket" };
  }
  if (conf != null && conf >= 6.2) {
    return { delta: 0.08, label: "Repère PMU correct" };
  }
  if (conf != null && conf < CONFIDENCE_BUCKET_MEDIUM) {
    return { delta: -0.15, label: "Confiance cheval faible vs marché" };
  }
  return { delta: 0, label: "" };
}

function decisionAdjustment(api: ApiRaceScoreLite | undefined): { delta: number; label: string } {
  if (!api) return { delta: 0, label: "" };
  if (api.decision === "VALIDE" && api.playable) {
    return { delta: 0.22, label: "Décision moteur : ticket validé" };
  }
  if (api.decision === "SURVEILLANCE") {
    return { delta: -0.05, label: "Surveillance moteur" };
  }
  if (api.decision === "REJET") {
    return { delta: -0.55, label: "Rejet moteur" };
  }
  return { delta: 0, label: "" };
}

function resolvePlayTier(displayScore: number, stage: HomeScoreStage): PlayTier {
  if (stage === "finished") return "resultat";
  if (displayScore >= SEUIL_JOUABLE) return "jouable";
  if (displayScore >= SEUIL_SURVEILLANCE) return "surveillance";
  return "passer";
}

function buildRadarSentence(
  race: RaceSummary,
  displayScore: number,
  factors: string[],
  allocation: number | null | undefined
): string {
  const top = factors.filter(Boolean).slice(0, 2);
  const enjeu =
    allocation != null && allocation >= 50_000
      ? "fort enjeu"
      : allocation != null && allocation >= 25_000
        ? "bel enjeu"
        : "enjeu standard";
  const head = top.length > 0 ? `${top[0]}${top[1] ? `, ${top[1]}` : ""}` : "Profil équilibré";
  return `Score consolidé ${round1(displayScore)}/10 : ${head} — ${race.hippodrome}, ${enjeu}.`;
}

/**
 * Score de confiance client : combine la note API (quand disponible) et le contexte course
 * (partants, enjeu, fenêtre temps, lisibilité, discipline, proxies cote / décision).
 */
export function computeClientRaceScore(
  race: RaceSummary,
  api: ApiRaceScoreLite | undefined,
  minutesUntilStart: number
): ClientRaceScoreResult {
  const stage = api?.stage ?? inferStageFromMinutes(minutesUntilStart);

  const adjustments: Array<{ delta: number; label: string }> = [
    partantsAdjustment(race.nombrePartants),
    allocationAdjustment(race.allocation),
    stageAdjustment(stage, minutesUntilStart),
    lisibiliteAdjustment(api?.lisibilite ?? "COMPLEXE"),
    distanceAdjustment(race.distance),
    disciplineCoherence(race),
    coteProxyAdjustment(api),
    decisionAdjustment(api),
  ];

  const rawBase = baseScoreFromContext(api, minutesUntilStart);
  const deltaSum = adjustments.reduce((s, a) => s + a.delta, 0);
  const displayScore = round1(clamp(rawBase + deltaSum, 0, 10));

  const factors = adjustments
    .map((a) => a.label)
    .filter((label) => label.length > 0);

  const playTier = resolvePlayTier(displayScore, stage);

  const alloc = race.allocation ?? 0;
  const partants = Math.max(1, race.nombrePartants || 1);
  const radarRatio =
    displayScore *
    getRadarStageWeight(stage) *
    Math.log10(1 + alloc / 15_000) *
    (12 / Math.sqrt(partants));

  const radarSentence = buildRadarSentence(race, displayScore, factors, race.allocation);

  return {
    displayScore,
    playTier,
    radarSentence,
    radarRatio,
    factors,
  };
}

export function formatBetTypeLabelFr(betType: string | null | undefined): string {
  if (!betType) return "Lecture premium";
  const u = betType.toUpperCase();
  if (u === "GAGNANT") return "Simple gagnant";
  if (u === "PLACE") return "Simple placé";
  if (u === "COUPLE" || u === "COUPLED") return "Couplé";
  if (u === "TRIO") return "Trio";
  return betType.replaceAll("_", " ");
}
