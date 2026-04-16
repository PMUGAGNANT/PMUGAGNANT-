/**
 * Synergie jockey/driver × cheval (historique couple sur la période fournie).
 */

export type SynergieResult = {
  score: number;
  label: string;
  color: string;
  courses: number;
  victoiresTogether: number;
};

export type SynergieHistoriqueLigne = {
  jockeyId: string;
  chevalId: string;
  position: number | null;
};

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * @param jockeyId - ex. nom jockey normalisé
 * @param chevalId - ex. "12|NOM_CHEVAL"
 * @param historique - arrivées du duo sur 45j (à alimenter depuis votre base plus tard)
 */
export function getSynergie(
  jockeyId: string,
  chevalId: string,
  historique: SynergieHistoriqueLigne[]
): SynergieResult {
  const jk = normKey(jockeyId);
  const ck = normKey(chevalId);
  const rows = historique.filter(
    (h) => normKey(h.jockeyId) === jk && normKey(h.chevalId) === ck
  );
  const courses = rows.length;
  const victoiresTogether = rows.filter((h) => h.position === 1).length;

  if (courses === 0) {
    return {
      score: 50,
      label: "😐 Neutre",
      color: "#94a3b8",
      courses: 0,
      victoiresTogether: 0,
    };
  }

  const winRate = victoiresTogether / courses;
  const placeRate =
    rows.filter((h) => h.position != null && h.position >= 1 && h.position <= 3).length / courses;
  const raw = winRate * 100 + placeRate * 35 + Math.min(15, courses);
  const score = Math.min(100, Math.max(0, Math.round(raw)));

  if (score > 75) {
    return {
      score,
      label: "🚀 COMBO GAGNANT",
      color: "#00c853",
      courses,
      victoiresTogether,
    };
  }
  if (score >= 50) {
    return {
      score,
      label: "✅ Bonne synergie",
      color: "#7cb342",
      courses,
      victoiresTogether,
    };
  }
  if (score >= 25) {
    return {
      score,
      label: "😐 Neutre",
      color: "#94a3b8",
      courses,
      victoiresTogether,
    };
  }
  return {
    score,
    label: "⚠️ Mauvaise synergie",
    color: "#ff9800",
    courses,
    victoiresTogether,
  };
}

export function synergieTooltipExplication(result: SynergieResult): string {
  if (result.courses === 0) {
    return "Pas encore d’historique couple enregistré sur 45 jours. Le score reste neutre : branche une table d’arrivées duo pour affiner.";
  }
  return `${result.courses} course(s) ensemble, ${result.victoiresTogether} victoire(s). Score ${result.score}/100 — ${result.label}`;
}
