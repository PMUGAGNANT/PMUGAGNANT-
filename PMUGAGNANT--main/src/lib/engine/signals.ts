import type {
  AlgoParameters,
  MusicStats,
  Participant,
  RaceSummary,
  RunnerSignals,
} from "@/lib/types";
import {
  clamp,
  ELITE_DRIVERS_TROT,
  ELITE_JOCKEYS_FLAT,
  ELITE_TRAINERS,
  getEliteScore,
  getHumanReference,
  normalizeKey,
  round1,
  safeRate,
} from "@/lib/engine/shared";
import { countEncodedRuns } from "@/lib/engine/music";

function getMarketSignal(cote: number | null, variationCote: number | null) {
  if (cote === null || Number.isNaN(cote)) return 0;

  let signal = 0;
  if (cote <= 2.0) signal += 2;
  else if (cote <= 3.5) signal += 1;
  else if (cote <= 6.0) signal += 0;
  else if (cote <= 10) signal += 0;
  else if (cote <= 18) signal -= 1;
  else if (cote <= 30) signal -= 2;
  else signal -= 3;

  if (variationCote !== null) {
    if (variationCote <= -20) signal += 4;
    else if (variationCote <= -10) signal += 2;
    else if (variationCote >= 30) signal -= 5;
    else if (variationCote >= 15) signal -= 2;
  }

  return clamp(signal, -8, 6);
}

function getWeightSignal(participant: Participant, race: RaceSummary) {
  if (
    !race.estPlat ||
    participant.poids === null ||
    participant.poids === undefined
  ) {
    return 0;
  }

  if (participant.poids <= 54) return 5;
  if (participant.poids <= 56.5) return 3;
  if (participant.poids <= 59) return 1;
  if (participant.poids <= 61) return -1;
  return -4;
}

function getStallSignal(participant: Participant, race: RaceSummary) {
  const stall = participant.stalle ?? participant.placeCorde ?? null;
  if (!race.estPlat || stall === null || stall <= 0) {
    return 0;
  }

  if (race.distance <= 1600) {
    if (stall <= 4) return 5;
    if (stall <= 7) return 3;
    if (stall >= race.nombrePartants - 2) return -4;
  }

  if (stall <= Math.ceil(race.nombrePartants / 3)) return 2;
  if (stall >= Math.max(race.nombrePartants - 3, 8)) return -2;
  return 0;
}

function getHumanSignal(participant: Participant, race: RaceSummary) {
  const human = getHumanReference(participant, race.estPlat);
  const raw = race.estPlat
    ? getEliteScore(human, ELITE_JOCKEYS_FLAT)
    : getEliteScore(human, ELITE_DRIVERS_TROT);
  return clamp(Math.round(raw * 0.8), 0, 8);
}

function getTrainerSignal(participant: Participant) {
  const raw = getEliteScore(participant.entraineur, ELITE_TRAINERS);
  return clamp(Math.round(raw * 0.7), 0, 7);
}

function getJockeyFormSignal(participant: Participant, race: RaceSummary) {
  const humanBase = race.estPlat
    ? getEliteScore(
        participant.jockey || participant.driver,
        ELITE_JOCKEYS_FLAT
      )
    : getEliteScore(
        participant.driver || participant.jockey,
        ELITE_DRIVERS_TROT
      );
  const winRate = safeRate(participant.jockeyWinRate) ?? 0;
  const recentForm = safeRate(participant.jockeyRecentForm) ?? 0;
  const signal = humanBase * 0.35 + winRate * 22 + recentForm * 14;
  return clamp(Math.round(signal), 0, 16);
}

function getTrainerTrackSignal(participant: Participant) {
  const trackWinRate = safeRate(participant.trainerTrackWinRate) ?? 0;
  const eliteBonus = getTrainerSignal(participant) * 0.3;
  return clamp(Math.round(trackWinRate * 22 + eliteBonus), 0, 15);
}

function getDistanceSignal(participant: Participant, race: RaceSummary) {
  const winRate = safeRate(participant.distanceWinRate) ?? 0;
  const placeRate = safeRate(participant.distancePlaceRate) ?? 0;
  let signal = winRate * 20 + placeRate * 12;

  if (race.distance >= 2600 && participant.age >= 5 && participant.age <= 7) {
    signal += 3;
  }

  if (race.distance <= 1600 && participant.age >= 3 && participant.age <= 5) {
    signal += 3;
  }

  return clamp(Math.round(signal), -2, 18);
}

function getTerrainSignal(participant: Participant, race: RaceSummary) {
  const terrain = normalizeKey(race.terrain);
  const preference = normalizeKey(participant.terrainPreference);
  const winRate = safeRate(participant.terrainWinRate) ?? 0;
  const placeRate = safeRate(participant.terrainPlaceRate) ?? 0;

  let signal = winRate * 12 + placeRate * 8;
  if (terrain && preference) {
    if (terrain.includes(preference) || preference.includes(terrain)) {
      signal += 4;
    } else if (
      (terrain.includes("lourd") && preference.includes("bon")) ||
      (terrain.includes("bon") && preference.includes("lourd"))
    ) {
      signal -= 3;
    }
  }

  return clamp(Math.round(signal), -4, 14);
}

function getWeatherSignal(participant: Participant, race: RaceSummary) {
  const meteo = normalizeKey(race.meteo);
  const preference = normalizeKey(participant.meteoPreference);
  if (!meteo || !preference) {
    return 0;
  }

  if (meteo.includes(preference) || preference.includes(meteo)) {
    return 3;
  }

  if (
    (meteo.includes("pluie") && preference.includes("sec")) ||
    (meteo.includes("orage") && preference.includes("soleil"))
  ) {
    return -3;
  }

  return 0;
}

function getTrackHistorySignal(participant: Participant) {
  const winRate = safeRate(participant.trackWinRate) ?? 0;
  const placeRate = safeRate(participant.trackPlaceRate) ?? 0;
  return clamp(Math.round(winRate * 22 + placeRate * 12), -2, 18);
}

function getAgeSexSignal(participant: Participant, race: RaceSummary) {
  let signal = 0;
  if (race.estPlat) {
    if (participant.age >= 3 && participant.age <= 5) signal += 4;
    else if (participant.age >= 6) signal -= 2;
  } else {
    if (participant.age >= 4 && participant.age <= 7) signal += 4;
    else if (participant.age >= 9) signal -= 3;
  }

  const sexe = normalizeKey(participant.sexe);
  if (sexe.includes("f") || sexe.includes("mare")) {
    signal += 1;
  }

  return clamp(signal, -4, 6);
}

function getRestSignal(participant: Participant) {
  const restDays = participant.daysSinceLastRun;
  if (
    restDays === null ||
    restDays === undefined ||
    !Number.isFinite(restDays)
  ) {
    return 0;
  }

  if (restDays <= 4) return -5;
  if (restDays <= 10) return 2;
  if (restDays <= 21) return 5;
  if (restDays <= 35) return 3;
  if (restDays <= 50) return 0;
  if (restDays <= 80) return -4;
  if (restDays <= 120) return -6;
  return -8;
}

function getGainsSignal(participant: Participant) {
  if (!participant.gainCarriere) return 0;
  const signal = Math.log10(participant.gainCarriere + 1) * 1 - 3;
  return clamp(Math.round(signal), 0, 3);
}

function getPopularitySignal(participant: Participant) {
  if (!participant.nombreSuiveurs) return 0;
  if (participant.nombreSuiveurs >= 2000) return 1;
  return 0;
}

function getIntrinsicValueSignal(
  scoreIntrinseque: number,
  cote: number | null,
  nombrePartants: number
) {
  if (cote === null || !Number.isFinite(cote) || cote <= 1) return 0;
  void nombrePartants;

  const probaMarche = 1 / cote;
  const probaAlgo = clamp(scoreIntrinseque / 100, 0.03, 0.55);
  const edge = probaAlgo - probaMarche;

  if (edge >= 0.18) return 8;
  if (edge >= 0.12) return 6;
  if (edge >= 0.06) return 4;
  if (edge >= 0.02) return 2;
  if (edge <= -0.18) return -4;
  if (edge <= -0.1) return -2;

  return 0;
}

function getVictorySignal(participant: Participant, stats: MusicStats) {
  const total = Math.max(
    participant.nombreCourses,
    countEncodedRuns(participant.musique),
    1
  );
  const winRate = participant.nombreVictoires / total;

  let signal = 0;
  signal += stats.nbVictoires >= 2 ? 9 : stats.nbVictoires === 1 ? 5 : 0;
  signal += winRate >= 0.2 ? 7 : winRate >= 0.12 ? 4 : winRate >= 0.06 ? 2 : 0;
  signal += stats.recentPositions.includes(1) ? 3 : 0;

  return clamp(signal, 0, 16);
}

function getPodiumSignal(participant: Participant, stats: MusicStats) {
  const total = Math.max(
    participant.nombreCourses,
    countEncodedRuns(participant.musique),
    1
  );
  const placeRate = participant.nombrePlaces / total;

  let signal = 0;
  signal +=
    stats.nbPodiums >= 3 ? 9 : stats.nbPodiums >= 2 ? 6 : stats.nbPodiums >= 1 ? 3 : 0;
  signal += placeRate >= 0.5 ? 7 : placeRate >= 0.35 ? 4 : placeRate >= 0.2 ? 2 : 0;
  signal += stats.serie >= 3 ? 4 : stats.serie >= 2 ? 2 : 0;

  return clamp(signal, 0, 15);
}

function getFormSignal(stats: MusicStats) {
  let signal = 0;
  signal += stats.ratioForme * 14;
  signal +=
    stats.trend > 1.2
      ? 7
      : stats.trend > 0.6
        ? 4
        : stats.trend > 0.2
          ? 2
          : stats.trend < -1
            ? -6
            : stats.trend < -0.4
              ? -3
              : 0;

  if (stats.averagePosition <= 2.5) signal += 5;
  else if (stats.averagePosition <= 3.5) signal += 3;
  else if (stats.averagePosition <= 5) signal += 1;
  else if (stats.averagePosition >= 7) signal -= 3;
  else if (stats.averagePosition >= 9) signal -= 5;

  return clamp(Math.round(signal), -8, 18);
}

function getRegularitySignal(stats: MusicStats) {
  let signal = 0;
  if (stats.fiabilite >= 0.92) signal += 12;
  else if (stats.fiabilite >= 0.85) signal += 9;
  else if (stats.fiabilite >= 0.75) signal += 6;
  else if (stats.fiabilite >= 0.65) signal += 3;
  else if (stats.fiabilite < 0.5) signal -= 6;

  if (
    stats.nbDQ === 0 &&
    stats.nbAbandons === 0 &&
    stats.recentPositions.length >= 3
  ) {
    signal += 3;
  }

  return clamp(signal, -6, 16);
}

function getRiskPenalty(
  participant: Participant,
  stats: MusicStats,
  parameters: AlgoParameters
) {
  let penalty = 0;

  if (stats.nbDQ >= 2) penalty += 4;
  if (stats.nbAbandons >= 2) penalty += 2;
  if (stats.fiabilite < 0.5) penalty += 6;
  if ((participant.cote ?? 0) >= 25) penalty += 4;

  const faultRate =
    participant.tauxFaute ??
    stats.nbDQ / Math.max(countEncodedRuns(participant.musique), 1);
  if (faultRate > parameters.fautifs.rejectRate) {
    penalty += 12;
  } else if (faultRate > parameters.fautifs.warningRate) {
    penalty += parameters.fautifs.warningMalus * 2;
  }

  return clamp(Math.round(penalty), 0, 20);
}

export function buildSignals(
  participant: Participant,
  race: RaceSummary,
  stats: MusicStats,
  parameters: AlgoParameters
): RunnerSignals {
  const forme = getFormSignal(stats);
  const regularite = getRegularitySignal(stats);
  const victoire = getVictorySignal(participant, stats);
  const podium = getPodiumSignal(participant, stats);
  const humain = getHumanSignal(participant, race);
  const entraineur = getTrainerSignal(participant);
  const jockeyForme = getJockeyFormSignal(participant, race);
  const trainerTrack = getTrainerTrackSignal(participant);
  const marche = getMarketSignal(
    participant.cote,
    participant.variationCote ?? null
  );
  const gains = getGainsSignal(participant);
  const popularite = getPopularitySignal(participant);
  const stalle = getStallSignal(participant, race);
  const poids = getWeightSignal(participant, race);
  const distance = getDistanceSignal(participant, race);
  const terrain = getTerrainSignal(participant, race);
  const meteo = getWeatherSignal(participant, race);
  const hippodrome = getTrackHistorySignal(participant);
  const ageSexe = getAgeSexSignal(participant, race);
  const repos = getRestSignal(participant);
  const faute =
    (participant.tauxFaute ?? 0) > parameters.fautifs.rejectRate
      ? 10
      : (participant.tauxFaute ?? 0) > parameters.fautifs.warningRate
        ? 6
        : 0;
  const risque = getRiskPenalty(participant, stats, parameters);
  const scoreIntrinseque =
    32 +
    forme +
    regularite +
    victoire +
    podium +
    humain +
    entraineur +
    jockeyForme +
    trainerTrack +
    gains +
    popularite +
    stalle +
    poids +
    distance +
    terrain +
    meteo +
    hippodrome +
    ageSexe +
    repos -
    risque -
    faute;
  const valueIntrinseque = getIntrinsicValueSignal(
    clamp(scoreIntrinseque, 0, 100),
    participant.cote,
    race.nombrePartants
  );

  return {
    forme,
    regularite,
    victoire,
    podium,
    humain,
    entraineur,
    jockeyForme,
    trainerTrack,
    marche,
    gains,
    popularite,
    stalle,
    poids,
    distance,
    terrain,
    meteo,
    hippodrome,
    ageSexe,
    repos,
    valueIntrinseque,
    faute,
    risque,
  };
}

export function computeBaseHorseScore(signaux: RunnerSignals) {
  const positives =
    signaux.forme +
    signaux.regularite +
    signaux.victoire +
    signaux.podium +
    signaux.humain +
    signaux.entraineur +
    signaux.jockeyForme +
    signaux.trainerTrack +
    signaux.marche +
    signaux.gains +
    signaux.popularite +
    signaux.stalle +
    signaux.poids +
    signaux.distance +
    signaux.terrain +
    signaux.meteo +
    signaux.hippodrome +
    signaux.ageSexe +
    signaux.repos +
    signaux.valueIntrinseque;

  const negatives = signaux.risque + signaux.faute;
  const riskMultiplier = signaux.risque > 12 ? 0.7 : signaux.risque > 8 ? 0.85 : 1.0; // v9.3
  return clamp((32 + positives) * riskMultiplier - negatives, 0, 100); // v9.3
}

export function computeTop3Potential(
  signaux: RunnerSignals,
  stats: MusicStats,
  scoreCheval: number
) {
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

export function computeTop5Potential(
  signaux: RunnerSignals,
  stats: MusicStats,
  scoreCheval: number
) {
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
  if (
    scoreCheval >= 76 &&
    top3Potential >= 72 &&
    risk <= 8 &&
    (cote ?? 0) <= 12
  ) {
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
