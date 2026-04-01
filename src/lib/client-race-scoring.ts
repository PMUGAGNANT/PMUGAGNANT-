import { asArray } from "@/lib/array-utils";
import type { Lisibilite, PredictionDecision, RaceSummary } from "@/lib/types";
import {
  CONFIDENCE_BUCKET_HIGH,
  CONFIDENCE_BUCKET_MEDIUM,
  COTE_PROXY_MID_THRESHOLD,
  DECISION_REJET_DELTA_FULL,
  DECISION_REJET_DELTA_SOFT,
  getRadarQuinteWeight,
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
  /** True quand l’API masque le détail (abonnement) : REJET peut être artificiel */
  scoreDetailsLocked?: boolean;
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

/** NIVEAU 2 — Quinté : pénalité légère score consolidé (variance naturelle) */
function quinteAdjustment(race: RaceSummary): { delta: number; label: string } {
  if (!race.estQuinte) {
    return { delta: 0, label: "" };
  }
  return { delta: -0.14, label: "Quinté : variance plus haute sur la combinaison" };
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
  if (conf != null && conf >= COTE_PROXY_MID_THRESHOLD) {
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
    const softPaywall =
      api.scoreDetailsLocked === true &&
      api.score == null &&
      (api.lisibilite === "LISIBLE" || api.lisibilite === "COMPLEXE");
    if (softPaywall) {
      return {
        delta: DECISION_REJET_DELTA_SOFT,
        label: "Accès score limité — rejet affiché conservateur",
      };
    }
    return { delta: DECISION_REJET_DELTA_FULL, label: "Rejet moteur" };
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
    quinteAdjustment(race),
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
    getRadarQuinteWeight(race.estQuinte) *
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

/** Partant minimal pour le profil psychologique (course / ticket). */
export interface RaceProfileRunnerLite {
  numPmu: number;
  cote?: number | null;
  horseScore?: number | null;
  /** Si défini, prime sur l’heuristique cote ≥ 8 */
  outsider?: boolean;
}

export type RacePsychologicalStatus =
  | "FAVORI_DANGEREUX"
  | "OPPORTUNITE_CACHEE"
  | "COURSE_PIEGE"
  | "A_EVITER"
  | "SIGNAL_FORT"
  | "NEUTRE";

export interface RaceProfile {
  status: RacePsychologicalStatus;
  label: string;
  color: string;
  emoji: string;
  /** Numéro du favori si cote basse mais score cheval faible */
  favoriFragileNum: number | null;
  /** Numéro au meilleur rapport score/cote */
  valueBetNum: number | null;
  /** Top 3 par score cheval décroissant (sinon pick seul si dispo) */
  ticketNums: number[];
}

function normalizeRunners(
  runners: RaceProfileRunnerLite[] | undefined,
  pick?: {
    numPmu?: number | null;
    cote?: number | null;
    confidence?: number | null;
  } | null
): RaceProfileRunnerLite[] {
  const fromRunners = asArray<RaceProfileRunnerLite>(runners).filter(
    (r) => r != null && Number.isFinite(r.numPmu)
  );
  if (fromRunners.length > 0) {
    return fromRunners;
  }
  const n = pick?.numPmu;
  if (n == null || !Number.isFinite(Number(n))) {
    return [];
  }
  const cote = pick?.cote;
  const horseScore = pick?.confidence;
  const outsider = cote != null && Number.isFinite(cote) && cote >= 8;
  return [{ numPmu: Number(n), cote, horseScore, outsider }];
}

type FavoriteResolved = { runner: RaceProfileRunnerLite; cote: number };

function pickFavorite(runners: RaceProfileRunnerLite[]): FavoriteResolved | null {
  type R = RaceProfileRunnerLite & { coteNum: number };
  const withCote: R[] = [];
  for (const r of runners) {
    const c = r.cote;
    if (c != null && Number.isFinite(c) && c > 0) {
      withCote.push({ ...r, coteNum: c });
    }
  }
  if (withCote.length === 0) {
    return null;
  }
  withCote.sort((a, b) => a.coteNum - b.coteNum);
  const fav = withCote[0];
  return { runner: fav, cote: fav.coteNum };
}

function isOutsiderRunner(r: RaceProfileRunnerLite): boolean {
  if (r.outsider === true) return true;
  const c = r.cote;
  return c != null && Number.isFinite(c) && c >= 8;
}

function computeValueBetNum(runners: RaceProfileRunnerLite[]): number | null {
  let bestNum: number | null = null;
  let bestRatio = -1;
  for (const r of runners) {
    const score = r.horseScore;
    const cote = r.cote;
    if (score == null || !Number.isFinite(score) || cote == null || !Number.isFinite(cote) || cote <= 0) {
      continue;
    }
    const ratio = score / cote;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestNum = r.numPmu;
    }
  }
  return bestNum;
}

function computeTicketNums(runners: RaceProfileRunnerLite[], pickNum: number | null): number[] {
  const scored = runners.filter(
    (r) => r.horseScore != null && Number.isFinite(Number(r.horseScore))
  );
  if (scored.length > 0) {
    return [...scored]
      .sort((a, b) => Number(b.horseScore) - Number(a.horseScore))
      .slice(0, 3)
      .map((r) => r.numPmu);
  }
  if (pickNum != null && Number.isFinite(pickNum)) {
    return [pickNum];
  }
  return [];
}

function computeFavoriFragileNum(fav: FavoriteResolved | null): number | null {
  if (!fav) return null;
  const hs = fav.runner.horseScore;
  const lowScore = hs == null || !Number.isFinite(hs) ? false : hs < 6;
  if (fav.cote < 2.5 && lowScore) {
    return fav.runner.numPmu;
  }
  return null;
}

/**
 * Profil psychologique d’une course (badges carte, radar, CTA).
 * Utilise le score consolidé client + partants + partants légers (ou pick seul).
 */
export function getRaceProfile(input: {
  race: RaceSummary;
  displayScore: number;
  runners?: RaceProfileRunnerLite[];
  pick?: {
    numPmu?: number | null;
    cote?: number | null;
    confidence?: number | null;
  } | null;
}): RaceProfile {
  const { race, displayScore, pick } = input;
  const runners = normalizeRunners(input.runners, pick);
  const partants = Math.max(0, race.nombrePartants || 0);
  const pickNum =
    pick?.numPmu != null && Number.isFinite(Number(pick.numPmu)) ? Number(pick.numPmu) : null;

  const fav = pickFavorite(runners);
  const favoriCote = fav?.cote ?? null;
  const favoriDanger =
    favoriCote != null && favoriCote < 2.5 && displayScore < 6;

  const hasOutsiderUpside = runners.some(
    (r) => isOutsiderRunner(r) && r.horseScore != null && Number(r.horseScore) > 7.5
  );

  const coursePiege =
    partants > 15 && displayScore >= 5 && displayScore < 7.5;

  let status: RacePsychologicalStatus = "NEUTRE";
  let label = "SIGNAL";
  let color = "var(--pmu-text-muted)";
  let emoji = "•";

  if (displayScore < 4.5) {
    status = "A_EVITER";
    label = "À ÉVITER";
    color = "#9CA3AF";
    emoji = "❌";
  } else if (displayScore > 8.5 && partants > 0 && partants < 10) {
    status = "SIGNAL_FORT";
    label = "SIGNAL FORT";
    color = "#00FF88";
    emoji = "🔥";
  } else if (favoriDanger) {
    status = "FAVORI_DANGEREUX";
    label = "FAVORI DANGEREUX";
    color = "#FF4444";
    emoji = "🚨";
  } else if (coursePiege) {
    status = "COURSE_PIEGE";
    label = "COURSE PIÈGE";
    color = "#FFB800";
    emoji = "⚠️";
  } else if (hasOutsiderUpside) {
    status = "OPPORTUNITE_CACHEE";
    label = "OPPORTUNITÉ CACHÉE";
    color = "#00CC66";
    emoji = "💎";
  } else {
    label = "SUIVI";
    color = "#94A3B8";
    emoji = "◇";
  }

  const favoriFragileNum = computeFavoriFragileNum(fav);
  const valueBetNum = computeValueBetNum(runners);
  const ticketNums = computeTicketNums(runners, pickNum);

  return {
    status,
    label,
    color,
    emoji,
    favoriFragileNum,
    valueBetNum,
    ticketNums,
  };
}
