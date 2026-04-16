import { SERVER_SCORE_NIVEAU_HAUTE, SERVER_SCORE_NIVEAU_JOUABLE } from "@/lib/scoring-policy";
import type {
  AlgoParameters,
  BettingPlan,
  CompositeBetPlan,
  ConfidenceScore,
  DaySignal,
  FavoriteSolidity,
  Lisibilite,
  MusicStats,
  Participant,
  PredictedOdds,
  Recommendation,
  RunnerSignals,
  ScoredParticipant,
  StrategicProfiles,
  ValueAnalysis,
} from "@/lib/types";
import {
  BANKROLL_BASE_EUROS,
  clamp,
  kellyFraction,
  marketProbabilityFromOdds,
  round1,
  round2,
} from "@/lib/predictions/shared";

export function getProbabilityCalibrationMultiplier(
  probability: number,
  parameters: AlgoParameters
) {
  const bins = parameters.probabilityCalibration?.bins ?? [];
  const match = bins.find(
    (bin) => probability >= bin.min && (probability < bin.max || bin.max >= 1)
  );

  return match ? clamp(match.multiplier, 0.5, 1.8) : 1;
}

export function computeTop3Potential(signaux: RunnerSignals, stats: MusicStats, scoreCheval: number) {
  const raw =
    26 +
    scoreCheval * 0.38 +
    signaux.podium * 1.8 +
    signaux.regularite * 1.6 +
    signaux.forme * 1.2 +
    signaux.humain * 0.9 +
    signaux.entraineur * 0.5 +
    signaux.jockeyForme * 0.8 +
    signaux.trainerTrack * 0.7 +
    signaux.stalle * 0.5 +
    signaux.poids * 0.3 +
    signaux.distance * 0.9 +
    signaux.terrain * 0.6 +
    signaux.hippodrome * 0.6 +
    signaux.repos * 0.6 +
    stats.serie * 1.8 -
    signaux.risque * 1.2 -
    signaux.faute * 0.8;

  return round1(clamp(raw, 0, 100));
}

export function computeTop5Potential(signaux: RunnerSignals, stats: MusicStats, scoreCheval: number) {
  const raw =
    34 +
    scoreCheval * 0.28 +
    signaux.regularite * 1.9 +
    signaux.forme * 0.9 +
    signaux.podium * 1.1 +
    signaux.gains * 0.5 +
    signaux.humain * 0.5 +
    signaux.entraineur * 0.4 +
    signaux.jockeyForme * 0.5 +
    signaux.trainerTrack * 0.5 +
    signaux.distance * 0.7 +
    signaux.terrain * 0.5 +
    signaux.hippodrome * 0.7 +
    signaux.repos * 0.4 +
    Math.max(stats.serie - 1, 0) * 1.2 -
    signaux.risque * 0.8 -
    signaux.faute * 0.6;

  return round1(clamp(raw, 0, 100));
}

export function determineObjective(
  scoreCheval: number,
  top3Potential: number,
  top5Potential: number,
  cote: number | null,
  risk: number
): "GAGNE" | "PODIUM" | "TOP5" | "SPECULATIF" {
  if (scoreCheval >= 76 && top3Potential >= 72 && risk <= 8 && (cote ?? 0) <= 12) {
    return "GAGNE";
  }
  if (top3Potential >= 66 && risk <= 11) {
    return "PODIUM";
  }
  if (top5Potential >= 62 && risk <= 13) {
    return "TOP5";
  }
  return "SPECULATIF";
}

export function buildPredictedOdds(
  participant: Participant,
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
  candidate: Omit<ScoredParticipant, "prediction" | "score" | "scoreAlgo"> & {
    scoreCheval: number;
    qualite: number;
    confiance: number;
    scoreFinalPari: number;
    top3Potential: number;
    top5Potential: number;
    objective: "GAGNE" | "PODIUM" | "TOP5" | "SPECULATIF";
    outsider: boolean;
  },
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
    const hasFormSignal = Boolean(candidate.formeRecenteAmelioree) || (candidate.musicStats?.trend ?? 0) > 0.5;

    if (lisibilite !== "LISIBLE" || (!hasMarketSignal && !hasFormSignal)) {
      decision = "REJET";
    } else {
      typePariConseille = "PLACE";
      miseConseillee = Math.max(1, Math.round(10 * parameters.outsiders.miseReductionFactor));
      if (decision === "VALIDE") {
        decision = "SURVEILLANCE";
      }
    }
  }

  if (candidate.confiance < 5.5 && decision === "VALIDE") { // v9.3
    decision = "SURVEILLANCE"; // v9.3
  } // v9.3

  return { decision, typePariConseille, miseConseillee };
}

export function buildValue(
  runner: ScoredParticipant,
  lisibilite: Lisibilite,
  parameters: AlgoParameters
): ValueAnalysis {
  const cotePMU = runner.cote ?? runner.coteDepart ?? runner.coteMatin ?? 0;
  const probabiliteImplicite = marketProbabilityFromOdds(cotePMU);
  const valueConfirmationMultiplier = lisibilite === "LISIBLE" ? 1.1 : 1.25; // v9.3
  const probabiliteValueSeuil = clamp(
    probabiliteImplicite * valueConfirmationMultiplier, // v9.3
    0,
    1
  );
  const confirmedValueBet =
    runner.prediction.probaEstimee > 0 &&
    runner.prediction.probaEstimee >= probabiliteValueSeuil &&
    runner.prediction.confiance >= parameters.value.confidenceMin &&
    lisibilite !== "LOTERIE";
  const valueCalculee = cotePMU > 0 ? runner.prediction.probaEstimee * cotePMU - 1 : 0;
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
      runner.prediction.probaEstimee > 0 ? round2(1 / runner.prediction.probaEstimee) : 0,
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

export function buildTopFactors(runner: ScoredParticipant) {
  const factors = [
    {
      label: "Forme recente",
      score: runner.signaux.forme + runner.signaux.regularite + runner.signaux.victoire,
    },
    {
      label: "Humains en forme",
      score:
        runner.signaux.humain +
        runner.signaux.entraineur +
        runner.signaux.jockeyForme +
        runner.signaux.trainerTrack,
    },
    {
      label: "Distance / piste",
      score:
        runner.signaux.distance + runner.signaux.hippodrome + runner.signaux.stalle,
    },
    {
      label: "Terrain / meteo",
      score: runner.signaux.terrain + runner.signaux.meteo,
    },
    {
      label: "Marche PMU",
      score: runner.signaux.marche + Math.max(-(runner.variationCote ?? 0) / 8, 0),
    },
    {
      label: "Poids / fraicheur",
      score: runner.signaux.poids + runner.signaux.repos + runner.signaux.ageSexe,
    },
  ];

  return factors
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .filter((factor) => factor.score > 0)
    .map((factor) => factor.label);
}

function buildCompositeBetPlan(
  type: CompositeBetPlan["type"],
  chevaux: ScoredParticipant[],
  eligible: boolean,
  raison: string
): CompositeBetPlan | null {
  if (chevaux.length === 0) {
    return null;
  }

  const averageConfidence =
    chevaux.reduce((sum, runner) => sum + runner.prediction.confiance, 0) / chevaux.length;

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
          strongest.prediction.action === "MISER" && strongest.prediction.confiance > 7
            ? "Simple gagnant retenu: confiance > 7/10 et value bet confirme."
            : "Simple gagnant refuse: confiance insuffisante ou value bet non confirme."
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
      valueBets.filter((runner) => top5.some((topRunner) => topRunner.numPmu === runner.numPmu))
        .length >= 3,
    top5.length === 5
      ? "Quinte propose uniquement si le top 5 contient au moins 3 value bets confirmes."
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

export function buildRaceAlerts(
  ranked: ScoredParticipant[],
  lisibilite: Lisibilite
) {
  const alerts: string[] = [];
  const valueBets = ranked.filter((runner) => runner.prediction.valueBet);
  const overRested = ranked.filter((runner) => (runner.daysSinceLastRun ?? 0) >= 75).length;
  const overloaded = ranked.filter((runner) => runner.nombreCourses >= 45).length;

  if (valueBets.length >= 3) {
    alerts.push("Opportunite forte: au moins 3 value bets confirmes dans cette course.");
  }
  if (lisibilite === "LOTERIE") {
    alerts.push("Course a eviter: lisibilite trop faible.");
  }
  if (overRested >= 3) {
    alerts.push("Plusieurs chevaux reviennent apres une longue absence.");
  }
  if (overloaded >= 3) {
    alerts.push("Peloton use: plusieurs chevaux tres sollicites ces derniers mois.");
  }

  return alerts;
}

export function buildDaySignal(
  ranked: ScoredParticipant[],
  lisibilite: Lisibilite,
  alerts: string[]
): DaySignal {
  const valueCount = ranked.filter((runner) => runner.prediction.valueBet).length;
  const averageConfidence =
    ranked.slice(0, 5).reduce((sum, runner) => sum + runner.prediction.confiance, 0) /
    Math.max(Math.min(ranked.length, 5), 1);
  const score = round1(
    clamp(
      45 +
        valueCount * 8 +
        averageConfidence * 4 +
        (lisibilite === "LISIBLE" ? 12 : lisibilite === "COMPLEXE" ? 2 : -14) -
        alerts.length * 5,
      0,
      100
    )
  );

  if (score >= 68) {
    return {
      label: "JOURNEE_FAVORABLE",
      score,
      raisons: [
        `${valueCount} value bet(s) confirme(s) sur la course.`,
        `Confiance moyenne top 5: ${round1(averageConfidence)}/10.`,
      ],
    };
  }

  if (score <= 42) {
    return {
      label: "JOURNEE_DEFAVORABLE",
      score,
      raisons: alerts.length > 0 ? alerts.slice(0, 2) : ["Course trop ouverte pour engager proprement."],
    };
  }

  return {
    label: "JOURNEE_NEUTRE",
    score,
    raisons: [
      `${valueCount} value bet(s) confirme(s).`,
      lisibilite === "COMPLEXE"
        ? "La course reste jouable mais demande de la discipline."
        : "Signaux corrects sans avantage massif.",
    ],
  };
}

export function buildFavoriteSolidity(
  favori: ScoredParticipant | null,
  top5: ScoredParticipant[]
): FavoriteSolidity | null {
  if (!favori) return null;

  const second = top5[1];
  const ecartScore = round2(
    second ? favori.prediction.scoreCheval - second.prediction.scoreCheval : favori.prediction.scoreCheval
  );
  const pointsPositifs: string[] = [];
  const alertes: string[] = [];

  if (favori.musicStats?.nbVictoires) {
    pointsPositifs.push("Victoire recente dans la musique");
  }
  if ((favori.musicStats?.trend ?? 0) > 0.5) {
    pointsPositifs.push("Forme en progression");
  }
  if ((favori.musicStats?.fiabilite ?? 0) >= 0.75) {
    pointsPositifs.push(`Profil fiable (${round1((favori.musicStats?.fiabilite ?? 0) * 10)}/10)`);
  }
  if (favori.prediction.typePariConseille === "PLACE") {
    pointsPositifs.push("Base place solide");
  }

  if (ecartScore <= 2.5) {
    alertes.push(`Ecart tres faible avec le 2eme (${round2(ecartScore)} pts)`);
  }
  if (favori.signaux.risque >= 8) {
    alertes.push("Risque technique eleve");
  }
  if ((favori.cote ?? 0) >= 12) {
    alertes.push("Favori tres speculatif cote marche");
  }

  const score =
    clamp(
      42 +
        favori.signaux.forme +
        favori.signaux.regularite +
        favori.signaux.victoire +
        favori.signaux.podium / 2 +
        ecartScore * 2 -
        favori.signaux.risque -
        alertes.length * 6,
      0,
      100
    );

  return {
    score: round1(score),
    estFragile: score < 64 || alertes.length >= 2,
    alertes,
    pointsPositifs,
    ecartScore,
  };
}

export function buildRecommendation(
  lisibilite: Lisibilite,
  favori: ScoredParticipant | null,
  solidite: FavoriteSolidity | null
): Recommendation | null {
  if (!favori) return null;

  if (lisibilite === "LOTERIE") {
    return {
      decision: "COURSE A LAISSER",
      emoji: "STOP",
      vautLeCoup: false,
      raisonnement: [
        "Course trop diffuse pour sortir un ticket assez propre.",
        "Le moteur prefere ne pas forcer de pari ici.",
      ],
    };
  }

  if (
    favori.prediction.decision === "VALIDE" &&
    favori.prediction.typePariConseille === "GAGNANT" &&
    (solidite?.score ?? 0) >= 72 &&
    !(solidite?.estFragile ?? true)
  ) {
    return {
      decision: "PARI OFFENSIF",
      emoji: "FORT",
      vautLeCoup: true,
      raisonnement: [
        "Le ticket coche les seuils de qualite et de confiance.",
        "Le profil est assez propre pour viser la gagne sans surjouer le risque.",
      ],
    };
  }

  if (
    favori.prediction.typePariConseille === "PLACE" &&
    (solidite?.score ?? 0) >= 66
  ) {
    return {
      decision: "BASE PLACE",
      emoji: "PLACE",
      vautLeCoup: true,
      raisonnement: [
        "Le moteur voit surtout une base pour les places plutot qu'un vrai coup de gagne.",
        "La lecture reste exploitable tant que la course ne se tend pas davantage.",
      ],
    };
  }

  if (favori.prediction.decision === "SURVEILLANCE") {
    return {
      decision: "SURVEILLANCE ACTIVE",
      emoji: "WATCH",
      vautLeCoup: true,
      raisonnement: [
        "Le profil principal ressort encore, mais la course demande une confirmation supplementaire.",
        "Le ticket est jouable si le marche ne se degrade pas avant le depart.",
      ],
    };
  }

  return {
    decision: "COURSE A LAISSER",
    emoji: "STOP",
    vautLeCoup: false,
    raisonnement: [
      "Le couple confiance / lisibilite reste trop juste pour un ticket sain.",
      "Mieux vaut laisser passer cette course que surinterpreter un signal faible.",
    ],
  };
}

export function buildConfidenceScore(
  favori: ScoredParticipant | null,
  solidite: FavoriteSolidity | null,
  lisibilite: Lisibilite
): ConfidenceScore | null {
  if (!favori) return null;

  const rawConfiance = favori.prediction.confiance;
  const base = Number.isFinite(rawConfiance) ? rawConfiance : 0;
  const solidityBoost =
    solidite && Number.isFinite(solidite.score)
      ? clamp((solidite.score - 60) / 25, -1.2, 1.2)
      : 0;
  const lisibiliteBoost = lisibilite === "LISIBLE" ? 0.6 : lisibilite === "COMPLEXE" ? -0.4 : -2;
  const score = round1(clamp(base + solidityBoost + lisibiliteBoost, 0, 10));

  const facteurs = [
    `Qualite ${favori.prediction.qualite}/100`,
    `Score final ${round1(favori.prediction.scoreFinalPari)}/100`,
    `Lisibilite ${lisibilite}`,
  ];
  if ((favori.variationCote ?? 0) <= -10) {
    facteurs.push("Marche en soutien");
  }
  if (solidite?.alertes.length) {
    facteurs.push(`${solidite.alertes.length} alerte(s) a surveiller`);
  }

  const niveau =
    score >= SERVER_SCORE_NIVEAU_HAUTE
      ? { label: "Haute", emoji: "HAUT" }
      : score >= SERVER_SCORE_NIVEAU_JOUABLE
        ? { label: "✅ Jouable", emoji: "OK" }
        : { label: "Fragile", emoji: "RISQUE" };

  return { score, niveau, facteurs };
}

export function buildProfiles(
  ranked: ScoredParticipant[],
  lisibilite: Lisibilite,
  parameters: AlgoParameters
): StrategicProfiles {
  const playable = ranked.filter((runner) => runner.prediction.decision !== "REJET");
  const beton =
    playable.find(
      (runner) =>
        runner.prediction.typePariConseille === "GAGNANT" &&
        runner.signaux.regularite >= 6 &&
        (runner.musicStats?.fiabilite ?? 0) >= 0.75
    ) ?? playable[0] ?? null;

  const pepite =
    playable
      .filter((runner) => {
        const cote = runner.cote ?? runner.coteMatin ?? 0;
        return cote >= 4 && cote <= parameters.outsiders.coteMin;
      })
      .sort((left, right) => right.prediction.valueEffective - left.prediction.valueEffective)[0] ??
    null;

  const sniper =
    playable
      .filter((runner) => runner.prediction.outsider)
      .sort((left, right) => right.prediction.scoreFinalPari - left.prediction.scoreFinalPari)[0] ??
    null;

  return {
    beton,
    pepite,
    sniper,
    lisibilite,
  };
}

export function buildRecommendationRefined(
  current: Recommendation | null,
  lisibilite: Lisibilite,
  favori: ScoredParticipant | null,
  solidite: FavoriteSolidity | null
) {
  if (!current || !favori || lisibilite === "LOTERIE" || solidite === null) {
    return current;
  }

  if (current.decision !== "COURSE A LAISSER") {
    return current;
  }

  const resilientPlaceProfile =
    favori.prediction.typePariConseille === "PLACE" && solidite.score >= 68;
  const resilientFavoriteProfile = solidite.score >= 70 && solidite.alertes.length <= 1;

  if (resilientPlaceProfile || resilientFavoriteProfile) {
    return {
      decision: "SURVEILLANCE ACTIVE",
      emoji: "WATCH",
      vautLeCoup: true,
      raisonnement: [
        "Le profil principal reste exploitable malgre une marge de validation trop courte.",
        resilientPlaceProfile
          ? "La base place conserve assez de tenue pour rester sous surveillance active."
          : "Le favori garde une base saine, mais la course demande encore plus de prudence.",
      ],
    } satisfies Recommendation;
  }

  return current;
}

export function computeConfidence(
  runner: ScoredParticipant,
  scoreFinalPari: number,
  marketEdge: number
) {
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

  return signauxForts < 2 ? Math.min(confianceActuelle, 5.8) : confianceActuelle; // v9.3
}

export function computeKellyMetrics(
  probaEstimee: number,
  odds: number | null | undefined
) {
  const kelly = kellyFraction(probaEstimee, odds);
  return {
    kelly,
    bankrollPct: kelly,
    miseBase100: round2(BANKROLL_BASE_EUROS * kelly),
  };
}
