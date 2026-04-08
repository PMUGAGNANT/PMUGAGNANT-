import type {
  AlgoParameters,
  Lisibilite,
  PredictedOdds,
  ScoredParticipant,
  ValueAnalysis,
} from "@/lib/types";
import {
  clamp,
  marketProbabilityFromOdds,
  round1,
  round2,
  VALUE_CONFIRMATION_MULTIPLIER,
} from "@/lib/engine/shared";

export type HorseDecisionCandidate = Omit<
  ScoredParticipant,
  "prediction" | "score" | "scoreAlgo"
> & {
  scoreCheval: number;
  qualite: number;
  confiance: number;
  scoreFinalPari: number;
  top3Potential: number;
  top5Potential: number;
  objective: "GAGNE" | "PODIUM" | "TOP5" | "SPECULATIF";
  outsider: boolean;
};

export function buildPredictedOdds(
  participant: ScoredParticipant,
  probaEstimee: number
): PredictedOdds {
  const coteEstimee = probaEstimee > 0 ? round2(1 / probaEstimee) : null;
  const coteMatin = participant.coteMatin ?? participant.cote ?? null;
  const current = participant.cote ?? participant.coteDepart ?? coteMatin;
  const variationPercent =
    coteMatin && current ? ((current - coteMatin) / coteMatin) * 100 : null;

  let tendance: PredictedOdds["tendance"] = "STABLE";
  if (variationPercent !== null) {
    if (variationPercent <= -15) tendance = "BAISSE_FORTE";
    else if (variationPercent < -5) tendance = "BAISSE";
    else if (variationPercent >= 15) tendance = "HAUSSE";
  }

  return {
    coteMatin,
    coteEstimee,
    variation:
      variationPercent === null
        ? "stable"
        : `${variationPercent > 0 ? "+" : ""}${round1(variationPercent)}%`,
    variationPercent: variationPercent === null ? null : round1(variationPercent),
    tendance,
  };
}

export function determineHorseDecision(
  candidate: HorseDecisionCandidate,
  lisibilite: Lisibilite,
  parameters: AlgoParameters
) {
  if (lisibilite === "LOTERIE") {
    return {
      decision: "REJET" as const,
      typePariConseille: "PLACE" as const,
      miseConseillee: 0,
    };
  }

  let decision: "VALIDE" | "SURVEILLANCE" | "REJET" = "REJET";
  if (
    candidate.confiance >= parameters.validation.confianceMin &&
    candidate.qualite >= parameters.validation.qualiteMin &&
    parameters.validation.lisibilitesAcceptees.includes(lisibilite)
  ) {
    decision = "VALIDE";
  } else if (
    candidate.confiance >= parameters.validation.confianceMin - 0.8 ||
    candidate.qualite >= parameters.validation.qualiteMin - 8
  ) {
    decision = "SURVEILLANCE";
  }

  let typePariConseille: "GAGNANT" | "PLACE" =
    candidate.outsider ||
    candidate.confiance < 6.6 ||
    candidate.objective !== "GAGNE" ||
    candidate.top3Potential < 68
      ? "PLACE"
      : "GAGNANT";
  let miseConseillee =
    typePariConseille === "GAGNANT"
      ? 10
      : candidate.objective === "TOP5"
        ? 6
        : 8;

  if (candidate.objective === "SPECULATIF" && decision === "VALIDE") {
    decision = "SURVEILLANCE";
  }

  if (candidate.objective === "TOP5" && decision === "VALIDE") {
    decision = "SURVEILLANCE";
  }

  if (candidate.outsider) {
    const hasMarketSignal =
      (candidate.variationCote ?? 0) <= parameters.outsiders.variationMinPct;
    const hasFormSignal =
      Boolean(candidate.formeRecenteAmelioree) ||
      (candidate.musicStats?.trend ?? 0) > 0.5;

    if (lisibilite !== "LISIBLE" || (!hasMarketSignal && !hasFormSignal)) {
      decision = "REJET";
    } else {
      typePariConseille = "PLACE";
      miseConseillee = Math.max(
        1,
        Math.round(10 * parameters.outsiders.miseReductionFactor)
      );
      if (decision === "VALIDE") {
        decision = "SURVEILLANCE";
      }
    }
  }

  return { decision, typePariConseille, miseConseillee };
}

export function buildValue(
  runner: ScoredParticipant,
  lisibilite: Lisibilite,
  parameters: AlgoParameters
): ValueAnalysis {
  const cotePMU = runner.cote ?? runner.coteDepart ?? runner.coteMatin ?? 0;
  const probabiliteImplicite = marketProbabilityFromOdds(cotePMU);
  const probabiliteValueSeuil = clamp(
    probabiliteImplicite * VALUE_CONFIRMATION_MULTIPLIER,
    0,
    1
  );
  const confirmedValueBet =
    runner.prediction.probaEstimee > 0 &&
    runner.prediction.probaEstimee >= probabiliteValueSeuil &&
    runner.prediction.confiance >= parameters.value.confidenceMin &&
    lisibilite !== "LOTERIE";
  const valueCalculee =
    cotePMU > 0 ? runner.prediction.probaEstimee * cotePMU - 1 : 0;
  const valueAllowed =
    confirmedValueBet ||
    (runner.prediction.confiance >= parameters.value.confidenceMin &&
      lisibilite !== "LOTERIE");
  const valueEffective = valueAllowed
    ? round2(
        Math.min(parameters.value.maxCap, valueCalculee) *
          parameters.lisibilite.valueCoefficients[lisibilite]
      )
    : 0;

  let label = "Neutre";
  let emoji = "NEUTRE";
  if (confirmedValueBet && valueEffective >= 2.5) {
    label = "Value premium";
    emoji = "PREMIUM";
  } else if (confirmedValueBet && valueEffective >= 1) {
    label = "Value jouable";
    emoji = "JOUABLE";
  } else if (valueEffective <= -0.25) {
    label = "Sous-value";
    emoji = "PRUDENCE";
  }

  return {
    probabilite: round2(runner.prediction.probaEstimee),
    probabiliteImplicite: round2(probabiliteImplicite),
    probabiliteValueSeuil: round2(probabiliteValueSeuil),
    coteJuste:
      runner.prediction.probaEstimee > 0
        ? round2(1 / runner.prediction.probaEstimee)
        : 0,
    cotePMU,
    valueIndex: valueEffective,
    valueBrute: round2(valueCalculee),
    valueEffective,
    valueBet: confirmedValueBet,
    bankrollPct: round2(runner.prediction.bankrollPct),
    kellyFraction: round2(runner.prediction.kellyFraction),
    label,
    emoji,
    miseConseillee: runner.prediction.miseConseillee,
  };
}
