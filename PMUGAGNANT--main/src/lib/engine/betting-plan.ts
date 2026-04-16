import type {
  BettingPlan,
  CompositeBetPlan,
  Lisibilite,
  ScoredParticipant,
} from "@/lib/types";
import { BANKROLL_BASE_EUROS, round1 } from "@/lib/engine/shared";

export function buildCompositeBetPlan(
  type: CompositeBetPlan["type"],
  chevaux: ScoredParticipant[],
  eligible: boolean,
  raison: string
): CompositeBetPlan | null {
  if (chevaux.length === 0) {
    return null;
  }

  const averageConfidence =
    chevaux.reduce((sum, runner) => sum + runner.prediction.confiance, 0) /
    chevaux.length;

  return {
    type,
    chevaux: chevaux.map((runner) => runner.numPmu),
    confiance: round1(averageConfidence),
    eligible,
    raison,
  };
}

function top4OrTop5(top5: ScoredParticipant[], lisibilite: Lisibilite) {
  return lisibilite === "LISIBLE" ? top5.slice(0, 4) : top5;
}

export function buildBettingPlan(
  ranked: ScoredParticipant[],
  lisibilite: Lisibilite
): BettingPlan {
  const valueBets = ranked.filter(
    (runner) => runner.prediction.action === "MISER" && runner.prediction.valueBet
  );
  const top2 = ranked.slice(0, 2);
  const top3 = ranked.slice(0, 3);
  const top5 = ranked.slice(0, 5);
  const strongest = ranked[0] ?? null;

  const simpleGagnant =
    strongest !== null
      ? buildCompositeBetPlan(
          "SIMPLE_GAGNANT",
          [strongest],
          strongest.prediction.action === "MISER" &&
            strongest.prediction.confiance > 7 &&
            strongest.prediction.typePariConseille === "GAGNANT",
          strongest.prediction.action === "MISER" &&
            strongest.prediction.confiance > 7
            ? "Simple gagnant retenu : confiance > 7/10 et opportunite value confirmee."
            : "Simple gagnant refuse : confiance insuffisante ou opportunite value non confirmee."
        )
      : null;

  const couple = buildCompositeBetPlan(
    "COUPLE",
    top2,
    top2.length === 2 &&
      top2.every((runner) => runner.prediction.confiance >= 6) &&
      lisibilite !== "LOTERIE",
    top2.length === 2
      ? "Couple construit sur les 2 meilleurs scores de confiance."
      : "Couple indisponible faute de deux profils solides."
  );

  const trio = buildCompositeBetPlan(
    "TRIO",
    top3,
    top3.length === 3 &&
      top3.filter((runner) => runner.prediction.confiance >= 6).length === 3 &&
      lisibilite !== "LOTERIE",
    top3.length === 3
      ? "Trio base sur le top 3 du moteur."
      : "Trio indisponible faute de trois profils fiables."
  );

  const quinte = buildCompositeBetPlan(
    "QUINTE",
    top5,
    top5.length === 5 &&
      valueBets.filter((runner) =>
        top5.some((topRunner) => topRunner.numPmu === runner.numPmu)
      ).length >= 3,
    top5.length === 5
      ? "Quinte propose uniquement si le top 5 contient au moins 3 opportunites value confirmees."
      : "Quinte indisponible faute de top 5 complet."
  );

  const multi = buildCompositeBetPlan(
    "MULTI",
    top4OrTop5(top5, lisibilite),
    false,
    "Multi desactive tant que le ROI historique par type n'est pas confirme au-dessus de 15%."
  );

  return {
    bankrollBase: BANKROLL_BASE_EUROS,
    simpleGagnant,
    couple,
    trio,
    quinte,
    multi,
  };
}
