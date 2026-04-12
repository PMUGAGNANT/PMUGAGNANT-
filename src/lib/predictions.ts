import { DEFAULT_ALGO_PARAMETERS } from "@/lib/config";
import { getMinutesUntilStart } from "@/lib/date-utils";
import { buildBettingPlan } from "@/lib/engine/betting-plan";
import {
  buildConfidenceScore,
  buildDaySignal,
  buildFavoriteSolidity,
  buildProfiles,
  buildRaceAlerts,
  buildRecommendation,
  buildRecommendationRefined,
  buildTopFactors,
} from "@/lib/engine/profiles";
import { determineRaceReadabilityScore, determinerLisibilite } from "@/lib/engine/readability";
import { parseMusic } from "@/lib/engine/music";
import {
  buildSignals,
  computeBaseHorseScore,
  computeTop3Potential,
  computeTop5Potential,
  determineObjective,
} from "@/lib/engine/signals";
import {
  BANKROLL_BASE_EUROS,
  clamp,
  getProbabilityCalibrationMultiplier,
  kellyFraction,
  marketProbabilityFromOdds,
  round1,
  round2,
  VALUE_CONFIRMATION_MULTIPLIER,
} from "@/lib/engine/shared";
import { buildPredictedOdds, buildValue, determineHorseDecision } from "@/lib/engine/value";
import { getRaceSegmentKey } from "@/lib/engine-v6";
import type {
  AlgoParameters,
  PredictedOdds,
  RaceAnalysis,
  RaceStatus,
  RaceSummary,
  ScoredParticipant,
  ValueAnalysis,
  Participant,
} from "@/lib/types";

export { parseMusic };
export { determinerLisibilite };

export function analyzeRaceWithParameters(
  course: RaceSummary,
  participants: Participant[],
  parameters: AlgoParameters = DEFAULT_ALGO_PARAMETERS
): RaceAnalysis {
  const segmentKey = getRaceSegmentKey(course);
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
          objective: "SPECULATIF",
          outsider: Boolean((participant.cote ?? 0) > parameters.outsiders.coteMin),
          valueBet: false,
          marketEdge: 0,
          kellyFraction: 0,
          bankrollPct: 0,
          miseBase100: 0,
          action: "NE PAS MISER",
          topFacteurs: [],
          decision: "REJET",
          typePariConseille: "PLACE",
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
    return (
      rawProbability *
      getProbabilityCalibrationMultiplier(rawProbability, parameters, segmentKey)
    );
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
    const confianceActuelle = round1( // v9.3
      clamp(
        scoreFinalPari / 10 +
          runner.signaux.marche / 10 -
          runner.signaux.risque / 20 +
          (runner.signaux.regularite +
            runner.signaux.forme +
            runner.signaux.distance +
            runner.signaux.hippodrome +
            runner.signaux.repos) /
            55 +
          marketEdge * 12,
        0,
        10
      )
    );
    const signauxForts = [ // v9.3
      runner.signaux.forme, // v9.3
      runner.signaux.regularite, // v9.3
      runner.signaux.victoire, // v9.3
      runner.signaux.podium, // v9.3
      runner.signaux.humain, // v9.3
      runner.signaux.marche, // v9.3
    ].filter((signal) => signal > 6).length; // v9.3
    const confiance = signauxForts < 2 ? Math.min(confianceActuelle, 5.8) : confianceActuelle; // v9.3
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
    const kelly = kellyFraction(
      probaEstimee,
      runner.cote ?? runner.coteDepart ?? runner.coteMatin
    );
    const bankrollPct = confirmedValueBet ? kelly : 0;
    const miseBase100 = round2(BANKROLL_BASE_EUROS * bankrollPct);

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
      confirmedValueBet && miseConseillee > 0 && decision !== "REJET"
        ? "MISER"
        : "NE PAS MISER";

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
        valueCalculee: round2(
          (runner.cote ?? 0) > 0 ? probaEstimee * (runner.cote ?? 0) - 1 : 0
        ),
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

  const predictionsCotes: Record<number, PredictedOdds> = {};
  const valueTop5: Record<number, ValueAnalysis> = {};

  for (const runner of ranked.slice(0, 5)) {
    predictionsCotes[runner.numPmu] = buildPredictedOdds(
      runner,
      runner.prediction.probaEstimee
    );
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
  const pepiteDuJour =
    ranked
      .filter(
        (runner) =>
          (runner.cote ?? 0) >= 5.0 &&
          runner.prediction.scoreCheval >= 58 && // v9.3
          runner.prediction.confiance >= 6.0 && // v9.3
          runner.signaux.valueIntrinseque >= 2 &&
          runner.prediction.decision !== "REJET" &&
          runner.numPmu !== (favori?.numPmu ?? -1)
      )
      .sort((a, b) => {
        const ratioA = a.prediction.scoreCheval / Math.max(a.cote ?? 1, 1);
        const ratioB = b.prediction.scoreCheval / Math.max(b.cote ?? 1, 1);
        return ratioB - ratioA;
      })[0] ?? null;
  const soliditeFavori = buildFavoriteSolidity(favori, ranked.slice(0, 5));
  const recommandation = buildRecommendationRefined(
    buildRecommendation(lisibilite, favori, soliditeFavori),
    lisibilite,
    favori,
    soliditeFavori
  );
  const scoreConfiance = buildConfidenceScore(
    favori,
    soliditeFavori,
    lisibilite
  );
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
    pepiteDuJour,
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

export function getRaceStatus(
  heureDepart: string,
  dateStr?: string
): RaceStatus {
  const minutesUntil = getMinutesUntilStart(heureDepart, dateStr);
  if (minutesUntil < -10) return "finished";
  if (minutesUntil <= 30) return "prono_available";
  return "upcoming";
}
