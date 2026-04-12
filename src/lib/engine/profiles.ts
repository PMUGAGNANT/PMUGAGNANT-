import {
  SERVER_SCORE_NIVEAU_HAUTE,
  SERVER_SCORE_NIVEAU_JOUABLE,
} from "@/lib/scoring-policy";
import type {
  AlgoParameters,
  ConfidenceScore,
  DaySignal,
  FavoriteSolidity,
  Lisibilite,
  Recommendation,
  ScoredParticipant,
  StrategicProfiles,
} from "@/lib/types";
import { clamp, round1, round2 } from "@/lib/engine/shared";

export function buildTopFactors(runner: ScoredParticipant) {
  const factors = [
    {
      label: "Forme recente",
      score:
        runner.signaux.forme +
        runner.signaux.regularite +
        runner.signaux.victoire,
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
        runner.signaux.distance +
        runner.signaux.hippodrome +
        runner.signaux.stalle,
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

export function buildRaceAlerts(
  ranked: ScoredParticipant[],
  lisibilite: Lisibilite
) {
  const alerts: string[] = [];
  const valueBets = ranked.filter((runner) => runner.prediction.valueBet);
  const overRested = ranked.filter(
    (runner) => (runner.daysSinceLastRun ?? 0) >= 75
  ).length;
  const overloaded = ranked.filter((runner) => runner.nombreCourses >= 45).length;

  if (valueBets.length >= 3) {
    alerts.push(
      "Opportunite forte : au moins 3 opportunites value confirmees dans cette course."
    );
  }
  if (lisibilite === "LOTERIE") {
    alerts.push("Course a eviter : lisibilite trop faible.");
  }
  if (overRested >= 3) {
    alerts.push("Plusieurs chevaux reviennent apres une longue absence.");
  }
  if (overloaded >= 3) {
    alerts.push(
      "Peloton use : plusieurs chevaux tres sollicites ces derniers mois."
    );
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
        `${valueCount} opportunite(s) value confirmee(s) sur la course.`,
        `Confiance moyenne du top 5 : ${round1(averageConfidence)}/10.`,
      ],
    };
  }

  if (score <= 42) {
    return {
      label: "JOURNEE_DEFAVORABLE",
      score,
      raisons:
        alerts.length > 0
          ? alerts.slice(0, 2)
          : ["Course trop ouverte pour engager proprement."],
    };
  }

  return {
    label: "JOURNEE_NEUTRE",
    score,
    raisons: [
      `${valueCount} opportunite(s) value confirmee(s).`,
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
    second
      ? favori.prediction.scoreCheval - second.prediction.scoreCheval
      : favori.prediction.scoreCheval
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
    pointsPositifs.push(
      `Profil fiable (${round1((favori.musicStats?.fiabilite ?? 0) * 10)}/10)`
    );
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

  const score = clamp(
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
  const lisibiliteBoost =
    lisibilite === "LISIBLE" ? 0.6 : lisibilite === "COMPLEXE" ? -0.4 : -2;
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
        ? { label: "Jouable", emoji: "OK" }
        : { label: "Fragile", emoji: "RISQUE" };

  return { score, niveau, facteurs };
}

export function buildProfiles(
  ranked: ScoredParticipant[],
  lisibilite: Lisibilite,
  parameters: AlgoParameters
): StrategicProfiles {
  const playable = ranked.filter(
    (runner) => runner.prediction.decision !== "REJET"
  );
  const beton =
    playable.find(
      (runner) =>
        runner.prediction.typePariConseille === "GAGNANT" &&
        runner.signaux.regularite >= 6 &&
        (runner.musicStats?.fiabilite ?? 0) >= 0.75
    ) ??
    playable[0] ??
    null;

  const pepite =
    playable
      .filter((runner) => {
        const cote = runner.cote ?? runner.coteMatin ?? 0;
        return cote >= 4 && cote <= parameters.outsiders.coteMin;
      })
      .sort(
        (left, right) =>
          right.prediction.valueEffective - left.prediction.valueEffective
      )[0] ?? null;

  const sniper =
    playable
      .filter((runner) => runner.prediction.outsider)
      .sort(
        (left, right) =>
          right.prediction.scoreFinalPari - left.prediction.scoreFinalPari
      )[0] ?? null;

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
  const resilientFavoriteProfile =
    solidite.score >= 70 && solidite.alertes.length <= 1;

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
