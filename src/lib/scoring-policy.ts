/**
 * Politique de scoring centralisée — PMU AI
 *
 * NIVEAU 2 : seuils décisionnels UI (paliers jouable / surveillance) et
 * buckets de confiance partagés (bilan, expert, proxy cote client, rapports).
 *
 * NIVEAU 3 : tokens d’animation / composition pour les composants « confiance »
 * (voir `--pmu-transition-scoring` dans globals.css).
 */

/** NIVEAU 2 — paliers carte programme / radar (client + badges) */
export const SEUIL_JOUABLE = 8.5;
export const SEUIL_SURVEILLANCE = 6.5;

/** NIVEAU 2 — buckets confiance (bilan API, teintes secondaires course, ajustements cote) */
export const CONFIDENCE_BUCKET_HIGH = 7.5;
export const CONFIDENCE_BUCKET_MEDIUM = 5.5;

/** NIVEAU 2 — libellés facteurs serveur `buildConfidenceScore` (Haute / Jouable / Fragile) */
export const SERVER_SCORE_NIVEAU_HAUTE = 7.5;
export const SERVER_SCORE_NIVEAU_JOUABLE = 6;

/** NIVEAU 2 — seuil intermédiaire proxy cote (client) */
export const COTE_PROXY_MID_THRESHOLD = 6.2;

/** NIVEAU 2 — ajustement décision REJET (client) */
export const DECISION_REJET_DELTA_FULL = -0.55;
/** Paywall + lisibilité correcte : ne pas traiter comme un rejet moteur complet */
export const DECISION_REJET_DELTA_SOFT = -0.28;

/** NIVEAU 2 — pondération radar : privilégier le vivant vs courses terminées */
export function getRadarStageWeight(stage: string): number {
  switch (stage) {
    case "final_30m":
      return 1.08;
    case "preview_1h":
      return 1;
    case "preview_2h":
      return 0.92;
    case "finished":
      return 0.82;
    default:
      return 1;
  }
}

/** NIVEAU 2 — Quinté : plus de variance ⇒ légère décote du ratio radar uniquement */
export function getRadarQuinteWeight(isQuinte: boolean): number {
  return isQuinte ? 0.9 : 1;
}
