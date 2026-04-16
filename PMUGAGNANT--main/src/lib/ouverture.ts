/**
 * Indice d’ouverture / lisibilité de la course (0–10).
 */

export type IndiceOuverture = {
  score: number;
  label: string;
  color: string;
  emoji: string;
  conseil: string;
};

function bucket(score: number): IndiceOuverture {
  if (score > 8) {
    return {
      score,
      label: "COURSE FACILE",
      color: "#2196f3",
      emoji: "☀️",
      conseil: "Hiérarchie claire. Bases solides identifiées.",
    };
  }
  if (score >= 6) {
    return {
      score,
      label: "COURSE NORMALE",
      color: "#00c853",
      emoji: "⛅",
      conseil: "Quelques bases fiables. Prudence sur les outsiders.",
    };
  }
  if (score >= 4) {
    return {
      score,
      label: "COURSE DIFFICILE",
      color: "#ff9800",
      emoji: "🌧️",
      conseil: "IA hésite. Réduire la mise ou passer.",
    };
  }
  return {
    score,
    label: "LOTERIE",
    color: "#f44336",
    emoji: "⚡",
    conseil: "Aucun favori clair. Ne pas jouer.",
  };
}

/**
 * Fiche course : écart 1er / 2e score algo, partants, sigma moyen (0–100).
 */
export function computeIndiceOuverture(params: {
  scoreFirst: number;
  scoreSecond: number;
  partants: number;
  sigmaMoyenPct: number;
}): IndiceOuverture {
  const gap = Math.max(0, params.scoreFirst - params.scoreSecond);
  const field = Math.max(4, params.partants);
  const densityPenalty = Math.min(3.5, (field - 8) * 0.12);
  const sigmaNorm = (params.sigmaMoyenPct ?? 50) / 100;
  const sigmaBoost = (sigmaNorm - 0.5) * 1.8;
  const raw = 5.2 + gap * 0.85 - densityPenalty + sigmaBoost;
  const score = Math.min(10, Math.max(0, Math.round(raw * 10) / 10));
  return bucket(score);
}

/** Liste programme : proxy sans 2e score (partants + sigma carte + note consolidée). */
export function estimateIndiceOuvertureListe(params: {
  displayScore: number;
  partants: number;
  sigmaPct: number;
}): IndiceOuverture {
  const field = Math.max(4, params.partants);
  const spread = Math.max(0, params.displayScore - 5);
  const densityPenalty = Math.min(2.8, (field - 10) * 0.1);
  const sigmaFactor = (params.sigmaPct / 100 - 0.35) * 2;
  const raw = 4 + spread * 0.55 - densityPenalty + sigmaFactor;
  const score = Math.min(10, Math.max(0, Math.round(raw * 10) / 10));
  return bucket(score);
}
