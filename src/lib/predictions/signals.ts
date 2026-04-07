import type {
  AlgoParameters,
  MusicStats,
  Participant,
  RaceSummary,
  RunnerSignals,
  ScoredParticipant,
} from "@/lib/types";
import { countEncodedRuns } from "@/lib/predictions/music";
import { clamp, normalizeKey, safeRate } from "@/lib/predictions/shared";

const ELITE_DRIVERS_TROT: Record<string, number> = {
  bazire: 10,
  duvaldestin: 10,
  abrivard: 9,
  nivard: 9,
  raffin: 9,
  lagadeuc: 8,
  thomain: 8,
};

const ELITE_JOCKEYS_FLAT: Record<string, number> = {
  lemaire: 10,
  soumillon: 10,
  demuro: 9,
  guyon: 9,
  barzalona: 9,
  pasquier: 8,
  perrault: 7,
  purton: 9,
  moreira: 10,
};

const ELITE_TRAINERS: Record<string, number> = {
  fabre: 10,
  graffard: 9,
  rohaut: 8,
  head: 8,
  brandt: 8,
  abrivard: 8,
  bazire: 8,
  duvaldestin: 8,
  bigeon: 7,
};

function getEliteScore(target: string, eliteMap: Record<string, number>) {
  const normalized = normalizeKey(target);
  if (!normalized) return 0;

  let best = 0;
  for (const [name, score] of Object.entries(eliteMap)) {
    if (normalized.includes(name)) {
      best = Math.max(best, score);
    }
  }

  return best;
}

function getHumanReference(participant: Participant, estPlat: boolean) {
  return estPlat
    ? participant.jockey || participant.driver || participant.entraineur
    : participant.driver || participant.jockey || participant.entraineur;
}

function getMarketSignal(cote: number | null, variationCote: number | null) {
  if (cote === null || Number.isNaN(cote)) return 0;

  let signal = 0;
  if (cote <= 2.8) signal += 10;
  else if (cote <= 4.5) signal += 8;
  else if (cote <= 7) signal += 5;
  else if (cote <= 10) signal += 2;
  else if (cote <= 15) signal -= 1;
  else if (cote <= 25) signal -= 4;
  else signal -= 8;

  if (variationCote !== null) {
    if (variationCote <= -20) signal += 4;
    else if (variationCote <= -10) signal += 2;
    else if (variationCote >= 30) signal -= 6;
    else if (variationCote >= 15) signal -= 3;
  }

  return clamp(signal, -10, 12);
}

function getWeightSignal(participant: Participant, race: RaceSummary) {
  if (!race.estPlat || participant.poids === null || participant.poids === undefined) {
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
  return race.estPlat
    ? getEliteScore(human, ELITE_JOCKEYS_FLAT)
    : getEliteScore(human, ELITE_DRIVERS_TROT);
}

function getTrainerSignal(participant: Participant) {
  return getEliteScore(participant.entraineur, ELITE_TRAINERS);
}

function getJockeyFormSignal(participant: Participant, race: RaceSummary) {
  const humanBase = race.estPlat
    ? getEliteScore(participant.jockey || participant.driver, ELITE_JOCKEYS_FLAT)
    : getEliteScore(participant.driver || participant.jockey, ELITE_DRIVERS_TROT);
  const winRate = safeRate(participant.jockeyWinRate) ?? 0;
  const recentForm = safeRate(participant.jockeyRecentForm) ?? 0;
  const signal = humanBase * 0.45 + winRate * 18 + recentForm * 12;
  return clamp(Math.round(signal), 0, 15);
}

function getTrainerTrackSignal(participant: Participant) {
  const trackWinRate = safeRate(participant.trainerTrackWinRate) ?? 0;
  const eliteBonus = getTrainerSignal(participant) * 0.4;
  return clamp(Math.round(trackWinRate * 18 + eliteBonus), 0, 14);
}

function getDistanceSignal(participant: Participant, race: RaceSummary) {
  const winRate = safeRate(participant.distanceWinRate) ?? 0;
  const placeRate = safeRate(participant.distancePlaceRate) ?? 0;
  let signal = winRate * 16 + placeRate * 10;

  if (race.distance >= 2600 && participant.age >= 5 && participant.age <= 7) {
    signal += 2;
  }

  if (race.distance <= 1600 && participant.age >= 3 && participant.age <= 5) {
    signal += 2;
  }

  return clamp(Math.round(signal), -2, 16);
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
  return clamp(Math.round(winRate * 16 + placeRate * 10), -2, 15);
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
  if (restDays === null || restDays === undefined || !Number.isFinite(restDays)) {
    return 0;
  }

  if (restDays <= 4) return -4;
  if (restDays <= 14) return 3;
  if (restDays <= 28) return 2;
  if (restDays <= 45) return 0;
  if (restDays <= 75) return -3;
  if (restDays <= 120) return -6;
  return -8;
}

function getGainsSignal(participant: Participant) {
  if (!participant.gainCarriere) return 0;
  const signal = Math.log10(participant.gainCarriere + 1) * 2 - 6;
  return clamp(Math.round(signal), 0, 8);
}

function getPopularitySignal(participant: Participant) {
  if (!participant.nombreSuiveurs) return 0;
  if (participant.nombreSuiveurs >= 1500) return 4;
  if (participant.nombreSuiveurs >= 800) return 3;
  if (participant.nombreSuiveurs >= 300) return 2;
  if (participant.nombreSuiveurs >= 100) return 1;
  return 0;
}

function getVictorySignal(participant: Participant, stats: MusicStats) {
  const total = Math.max(participant.nombreCourses, countEncodedRuns(participant.musique), 1);
  const winRate = participant.nombreVictoires / total;

  let signal = 0;
  signal += stats.nbVictoires >= 2 ? 8 : stats.nbVictoires === 1 ? 4 : 0;
  signal += winRate >= 0.18 ? 6 : winRate >= 0.1 ? 3 : 0;
  signal += stats.recentPositions.includes(1) ? 3 : 0;

  return clamp(signal, 0, 15);
}

function getPodiumSignal(participant: Participant, stats: MusicStats) {
  const total = Math.max(participant.nombreCourses, countEncodedRuns(participant.musique), 1);
  const placeRate = participant.nombrePlaces / total;

  let signal = 0;
  signal += stats.nbPodiums >= 3 ? 8 : stats.nbPodiums >= 2 ? 5 : stats.nbPodiums >= 1 ? 2 : 0;
  signal += placeRate >= 0.45 ? 6 : placeRate >= 0.3 ? 3 : 0;
  signal += stats.serie >= 2 ? 3 : 0;

  return clamp(signal, 0, 14);
}

function getFormSignal(stats: MusicStats) {
  let signal = 0;
  signal += stats.ratioForme * 12;
  signal += stats.trend > 1 ? 5 : stats.trend > 0.4 ? 2 : stats.trend < -1 ? -5 : stats.trend < -0.4 ? -2 : 0;
  if (stats.averagePosition <= 3) signal += 4;
  else if (stats.averagePosition <= 4.5) signal += 2;
  else if (stats.averagePosition >= 7) signal -= 3;
  return clamp(Math.round(signal), -6, 16);
}

function getRegularitySignal(stats: MusicStats) {
  let signal = 0;
  if (stats.fiabilite >= 0.9) signal += 10;
  else if (stats.fiabilite >= 0.8) signal += 7;
  else if (stats.fiabilite >= 0.7) signal += 4;
  else if (stats.fiabilite < 0.55) signal -= 5;

  if (stats.nbDQ === 0 && stats.nbAbandons === 0 && stats.recentPositions.length >= 3) {
    signal += 2;
  }

  return clamp(signal, -6, 14);
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

  const faultRate = participant.tauxFaute ?? (stats.nbDQ / Math.max(countEncodedRuns(participant.musique), 1));
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
  const marche = getMarketSignal(participant.cote, participant.variationCote ?? null);
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
    signaux.repos;

  const negatives = signaux.risque + signaux.faute;
  return clamp(32 + positives - negatives, 0, 100);
}

function getTerrainReadabilitySignal(race: RaceSummary) {
  const terrain = normalizeKey(race.terrain);
  if (!terrain) return 0;

  if (terrain.includes("bon") || terrain.includes("good") || terrain.includes("firm")) {
    return 2;
  }
  if (terrain.includes("souple") || terrain.includes("soft")) {
    return -1;
  }
  if (
    terrain.includes("lourd") ||
    terrain.includes("heavy") ||
    terrain.includes("collant")
  ) {
    return -3;
  }

  return 0;
}

function getWeatherReadabilitySignal(race: RaceSummary) {
  const meteo = normalizeKey(race.meteo);
  if (!meteo) return 0;

  if (meteo.includes("soleil") || meteo.includes("ensoleille") || meteo.includes("sun")) {
    return 1;
  }
  if (meteo.includes("pluie") || meteo.includes("rain")) {
    return -2;
  }
  if (
    meteo.includes("orage") ||
    meteo.includes("storm") ||
    meteo.includes("vent fort")
  ) {
    return -4;
  }

  return 0;
}

export function determineRaceReadabilityScore(
  race: RaceSummary,
  ranked: ScoredParticipant[]
) {
  let score = 58;

  if (race.nombrePartants <= 10) score += 10;
  else if (race.nombrePartants <= 14) score += 5;
  else if (race.nombrePartants >= 18) score -= 10;

  if (race.estQuinte) score -= 5;
  if (race.discipline.includes("OBSTACLE")) score -= 6;

  const top3 = ranked.slice(0, 3);
  if (top3.length > 0) {
    const gap12 =
      top3.length > 1 ? top3[0].prediction.scoreCheval - top3[1].prediction.scoreCheval : top3[0].prediction.scoreCheval;
    const gap13 =
      top3.length > 2 ? top3[0].prediction.scoreCheval - top3[2].prediction.scoreCheval : gap12;

    if (gap12 >= 8) score += 12;
    else if (gap12 >= 5) score += 8;
    else if (gap12 <= 2) score -= 10;

    if (gap13 <= 5) score -= 8;

    const averageRegularity =
      top3.reduce((sum, runner) => sum + runner.signaux.regularite, 0) / top3.length;
    score += clamp(Math.round(averageRegularity / 2), -6, 8);
  }

  const fragileTop3 = top3.filter((runner) => runner.signaux.risque >= 9).length;
  score -= fragileTop3 * 4;
  score += getTerrainReadabilitySignal(race);
  score += getWeatherReadabilitySignal(race);

  return clamp(score, 0, 100);
}
