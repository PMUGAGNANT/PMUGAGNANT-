import { getMinutesUntilStart } from "@/lib/date-utils";
import { DEFAULT_ALGO_PARAMETERS } from "@/lib/config";
import type {
  AlgoParameters,
  Lisibilite,
  Participant,
  RaceAnalysis,
  RaceStatus,
  RaceSummary,
  ScoredParticipant,
} from "@/lib/types";
import { parseMusic } from "@/lib/predictions/music";
import {
  buildSignals,
  computeBaseHorseScore,
  determineRaceReadabilityScore,
} from "@/lib/predictions/signals";
import {
  buildBettingPlan,
  buildConfidenceScore,
  buildDaySignal,
  buildFavoriteSolidity,
  buildPredictedOdds,
  buildProfiles,
  buildRaceAlerts,
  buildRecommendation,
  buildRecommendationRefined,
  buildTopFactors,
  buildValue,
  computeConfidence,
  computeKellyMetrics,
  computeTop3Potential,
  computeTop5Potential,
  determineHorseDecision,
  determineObjective,
  getProbabilityCalibrationMultiplier,
} from "@/lib/predictions/strategy";
import {
  VALUE_CONFIRMATION_MULTIPLIER,
  clamp,
  marketProbabilityFromOdds,
  round1,
  round2,
} from "@/lib/predictions/shared";

export { parseMusic } from "@/lib/predictions/music";

export function determinerLisibilite(
  race: RaceSummary,
  ranked: ScoredParticipant[],
  parameters: AlgoParameters = DEFAULT_ALGO_PARAMETERS
): Lisibilite {
  const score = determineRaceReadabilityScore(race, ranked);
  if (score >= parameters.lisibilite.thresholds.readableMin) return "LISIBLE";
  if (score >= parameters.lisibilite.thresholds.complexMin) return "COMPLEXE";
  return "LOTERIE";
}

export function analyzeRaceWithParameters(
  course: RaceSummary,
  participants: Participant[],
  parameters: AlgoParameters = DEFAULT_ALGO_PARAMETERS
): RaceAnalysis {
  const preRanked = participants
    .filter((participant) => !participant.nonPartant)
    .map((participant) => {
      const musicStats = parseMusic(participant.musique);
      const signaux = buildSignals(participant, course, musicStats, parameters);
      const scoreCheval = computeBaseHorseScore(signaux);

      return {
        ...participant,
        score: round1(scoreCheval),
        scoreAlgo: round1(scoreCheval),
        estTocard: Boolean((participant.cote ?? 0) >= parameters.outsiders.coteMin),
        musicStats,
        signaux,
        prediction: {
          scoreCheval: round1(scoreCheval),
          qualite: Math.round(scoreCheval),
          confiance: 0,
          scoreFinalPari: 0,
          probaEstimee: 0,
          probabiliteImplicite: 0,
          probabiliteValueSeuil: 0,
          valueCalculee: 0,
          valueEffective: 0,
          top3Potential: 0,
          top5Potential: 0,
          objective: "SPECULATIF" as const,
          outsider: Boolean((participant.cote ?? 0) > parameters.outsiders.coteMin),
          valueBet: false,
          marketEdge: 0,
          kellyFraction: 0,
          bankrollPct: 0,
          miseBase100: 0,
          action: "NE PAS MISER" as const,
          topFacteurs: [],
          decision: "REJET" as const,
          typePariConseille: "PLACE" as const,
          miseConseillee: 0,
        },
      } satisfies ScoredParticipant;
    })
    .sort((left, right) => right.prediction.scoreCheval - left.prediction.scoreCheval);

  const lisibilite = determinerLisibilite(course, preRanked, parameters);
  const coefficientLisibilite = parameters.lisibilite.coefficients[lisibilite];
  const rawStrengths = preRanked.map((runner) =>
    Math.pow(Math.max(runner.prediction.scoreCheval, 1), 1.18) *
    (1 + Math.max(runner.signaux.marche, 0) / 40) *
    (1 + Math.max(runner.signaux.distance + runner.signaux.hippodrome, 0) / 55)
  );
  const totalIntrinsicScore = Math.max(
    rawStrengths.reduce((sum, strength) => sum + strength, 0),
    1
  );
  const calibratedWeights = rawStrengths.map((strength) => {
    const rawProbability = strength / totalIntrinsicScore;
    return rawProbability * getProbabilityCalibrationMultiplier(rawProbability, parameters);
  });
  const totalCalibratedWeight = Math.max(
    calibratedWeights.reduce((sum, weight) => sum + weight, 0),
    1
  );

  let outsiderCount = 0;
  const ranked = preRanked.map((runner, index) => {
    const probaEstimee = clamp(calibratedWeights[index] / totalCalibratedWeight, 0.01, 0.55);
    const scoreFinalPari = round2(runner.prediction.scoreCheval * coefficientLisibilite);
    const top3Potential = computeTop3Potential(
      runner.signaux,
      runner.musicStats,
      runner.prediction.scoreCheval
    );
    const top5Potential = computeTop5Potential(
      runner.signaux,
      runner.musicStats,
      runner.prediction.scoreCheval
    );
    const probabiliteImplicite = marketProbabilityFromOdds(
      runner.cote ?? runner.coteDepart ?? runner.coteMatin
    );
    const probabiliteValueSeuil = clamp(
      probabiliteImplicite * VALUE_CONFIRMATION_MULTIPLIER,
      0,
      1
    );
    const marketEdge = round2(probaEstimee - probabiliteImplicite);
    const confiance = computeConfidence(runner, scoreFinalPari, marketEdge);
    const outsider = Boolean((runner.cote ?? 0) > parameters.outsiders.coteMin);
    const objective = determineObjective(
      runner.prediction.scoreCheval,
      top3Potential,
      top5Potential,
      runner.cote,
      runner.signaux.risque
    );
    const decisionState = determineHorseDecision(
      {
        ...runner,
        scoreCheval: runner.prediction.scoreCheval,
        qualite: Math.round(runner.prediction.scoreCheval),
        confiance,
        scoreFinalPari,
        top3Potential,
        top5Potential,
        objective,
        outsider,
      },
      lisibilite,
      parameters
    );
    const confirmedValueBet =
      probaEstimee >= probabiliteValueSeuil &&
      marketEdge > 0 &&
      lisibilite !== "LOTERIE" &&
      confiance >= parameters.value.confidenceMin;
    const { kelly, bankrollPct, miseBase100 } = computeKellyMetrics(
      probaEstimee,
      runner.cote ?? runner.coteDepart ?? runner.coteMatin
    );

    let decision = decisionState.decision;
    let miseConseillee = confirmedValueBet
      ? Math.max(0, Math.round(miseBase100))
      : decisionState.miseConseillee;
    if (outsider) {
      outsiderCount += 1;
      if (outsiderCount > parameters.outsiders.maxPerReunion) {
        decision = "REJET";
        miseConseillee = 0;
      }
    }

    if (!confirmedValueBet) {
      miseConseillee = 0;
    }

    const topFacteurs = buildTopFactors(runner);
    const action =
      confirmedValueBet && miseConseillee > 0 && decision !== "REJET" ? "MISER" : "NE PAS MISER";

    return {
      ...runner,
      score: round1(runner.prediction.scoreCheval),
      scoreAlgo: round1(scoreFinalPari),
      prediction: {
        scoreCheval: round1(runner.prediction.scoreCheval),
        qualite: Math.round(runner.prediction.scoreCheval),
        confiance,
        scoreFinalPari,
        probaEstimee: round2(probaEstimee),
        probabiliteImplicite: round2(probabiliteImplicite),
        probabiliteValueSeuil: round2(probabiliteValueSeuil),
        valueCalculee: round2(((runner.cote ?? 0) > 0 ? probaEstimee * (runner.cote ?? 0) - 1 : 0)),
        valueEffective: 0,
        top3Potential,
        top5Potential,
        objective,
        outsider,
        valueBet: confirmedValueBet,
        marketEdge,
        kellyFraction: round2(kelly),
        bankrollPct: round2(bankrollPct),
        miseBase100,
        action,
        topFacteurs,
        decision,
        typePariConseille: decisionState.typePariConseille,
        miseConseillee,
      },
    } satisfies ScoredParticipant;
  });

  ranked.sort((left, right) => right.prediction.scoreFinalPari - left.prediction.scoreFinalPari);

  const predictionsCotes: RaceAnalysis["predictionsCotes"] = {};
  const valueTop5: RaceAnalysis["valueTop5"] = {};

  for (const runner of ranked.slice(0, 5)) {
    predictionsCotes[runner.numPmu] = buildPredictedOdds(runner, runner.prediction.probaEstimee);
    const value = buildValue(runner, lisibilite, parameters);
    valueTop5[runner.numPmu] = value;
    runner.prediction.valueEffective = value.valueEffective;
    runner.prediction.valueCalculee = value.valueBrute;
    runner.prediction.valueBet = Boolean(value.valueBet);
    runner.prediction.action =
      runner.prediction.valueBet && runner.prediction.miseConseillee > 0
        ? "MISER"
        : "NE PAS MISER";
  }

  const favori =
    ranked.find((runner) => runner.prediction.decision === "VALIDE") ??
    ranked.find((runner) => runner.prediction.decision === "SURVEILLANCE") ??
    ranked[0] ??
    null;
  const soliditeFavori = buildFavoriteSolidity(favori, ranked.slice(0, 5));
  const recommandation = buildRecommendationRefined(
    buildRecommendation(lisibilite, favori, soliditeFavori),
    lisibilite,
    favori,
    soliditeFavori
  );
  const scoreConfiance = buildConfidenceScore(favori, soliditeFavori, lisibilite);
  const profils = buildProfiles(ranked.slice(0, 5), lisibilite, parameters);
  const alertes = buildRaceAlerts(ranked.slice(0, 5), lisibilite);
  const journeeSignal = buildDaySignal(ranked.slice(0, 5), lisibilite, alertes);
  const bettingPlan = buildBettingPlan(ranked.slice(0, 5), lisibilite);

  const scoreLisibilite = determineRaceReadabilityScore(course, ranked);
  const decisionCourse =
    recommandation?.decision === "PARI OFFENSIF"
      ? "VALIDE"
      : recommandation?.decision === "SURVEILLANCE ACTIVE" ||
          recommandation?.decision === "BASE PLACE"
        ? "SURVEILLANCE"
        : "REJET";

  return {
    courseInfo: course,
    participants: participants.length,
    ranking: ranked,
    top5: ranked.slice(0, 5),
    favori,
    soliditeFavori,
    recommandation,
    scoreConfiance,
    predictionsCotes,
    profils,
    valueTop5,
    prediction: {
      scoreLisibilite: round1(scoreLisibilite),
      coefficientLisibilite,
      lisibilite,
      decisionCourse,
      outsiderAutorise: lisibilite === "LISIBLE",
      journeeSignal,
    },
    bettingPlan,
    alertes,
  };
}

export function analyzeRace(
  course: RaceSummary,
  participants: Participant[]
): RaceAnalysis {
  return analyzeRaceWithParameters(course, participants, DEFAULT_ALGO_PARAMETERS);
}

export function getRaceStatus(heureDepart: string, dateStr?: string): RaceStatus {
  const minutesUntil = getMinutesUntilStart(heureDepart, dateStr);
  if (minutesUntil < -10) return "finished";
  if (minutesUntil <= 30) return "prono_available";
  return "upcoming";
}
