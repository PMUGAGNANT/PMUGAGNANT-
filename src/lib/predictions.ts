import { getMinutesUntilStart } from "@/lib/date-utils";
import { DEFAULT_ALGO_PARAMETERS } from "@/lib/config";
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
  RaceAnalysis,
  RaceStatus,
  RaceSummary,
  Recommendation,
  RunnerSignals,
  ScoredParticipant,
  StrategicProfiles,
  ValueAnalysis,
} from "@/lib/types";

const BANKROLL_BASE_EUROS = 100;
const MAX_KELLY_BANKROLL_PCT = 0.05;
const VALUE_CONFIRMATION_MULTIPLIER = 1.15;

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeKey(value?: string | null) {
  return (value ?? "").toLowerCase().trim();
}

function safeRate(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  if (value > 1) {
    return clamp(value / 100, 0, 1);
  }

  return clamp(value, 0, 1);
}

function marketProbabilityFromOdds(odds: number | null | undefined) {
  if (!odds || !Number.isFinite(odds) || odds <= 1) {
    return 0;
  }

  return 1 / odds;
}

function kellyFraction(probability: number, odds: number | null | undefined) {
  if (!odds || !Number.isFinite(odds) || odds <= 1 || probability <= 0) {
    return 0;
  }

  const raw = (probability * odds - 1) / (odds - 1);
  return clamp(raw, 0, MAX_KELLY_BANKROLL_PCT);
}

function getProbabilityCalibrationMultiplier(
  probability: number,
  parameters: AlgoParameters
) {
  const bins = parameters.probabilityCalibration?.bins ?? [];
  const match = bins.find(
    (bin) => probability >= bin.min && (probability < bin.max || bin.max >= 1)
  );

  return match ? clamp(match.multiplier, 0.5, 1.8) : 1;
}

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

function countEncodedRuns(music: string) {
  return Array.from(music ?? "").filter((char) => /\d|D|a/.test(char)).length;
}

export function parseMusic(music: string): MusicStats {
  if (!music || music.trim() === "") {
    return {
      recentPositions: [],
      nbVictoires: 0,
      nbPodiums: 0,
      nbDQ: 0,
      nbAbandons: 0,
      fiabilite: 0,
      averagePosition: 99,
      serie: 0,
      trend: 0,
      ratioForme: 0,
    };
  }

  const raw = music.slice(-12);
  const positions: number[] = [];
  let nbDQ = 0;
  let nbAbandons = 0;
  let totalRaces = 0;

  for (const character of raw) {
    if (character >= "1" && character <= "9") {
      positions.push(Number.parseInt(character, 10));
      totalRaces += 1;
    } else if (character === "0") {
      positions.push(10);
      totalRaces += 1;
    } else if (character === "D") {
      nbDQ += 1;
      totalRaces += 1;
    } else if (character === "a") {
      nbAbandons += 1;
      totalRaces += 1;
    }
  }

  const recentPositions = positions.slice(-5);
  const nbVictoires = positions.filter((position) => position === 1).length;
  const nbPodiums = positions.filter((position) => position <= 3).length;
  const fiabilite =
    totalRaces > 0 ? (totalRaces - nbDQ - nbAbandons) / totalRaces : 0;
  const averagePosition =
    recentPositions.length > 0
      ? recentPositions.reduce((sum, position) => sum + position, 0) /
        recentPositions.length
      : 99;

  let serie = 0;
  for (let index = recentPositions.length - 1; index >= 0; index -= 1) {
    if (recentPositions[index] <= 3) {
      serie += 1;
    } else {
      break;
    }
  }

  let trend = 0;
  if (recentPositions.length >= 5) {
    const oldAverage = (recentPositions[0] + recentPositions[1]) / 2;
    const newAverage =
      (recentPositions[2] + recentPositions[3] + recentPositions[4]) / 3;
    trend = oldAverage - newAverage;
  } else if (recentPositions.length >= 3) {
    const middle = Math.floor(recentPositions.length / 2);
    const older = recentPositions.slice(0, middle);
    const newer = recentPositions.slice(middle);
    const olderAverage =
      older.reduce((sum, position) => sum + position, 0) / older.length;
    const newerAverage =
      newer.reduce((sum, position) => sum + position, 0) / newer.length;
    trend = olderAverage - newerAverage;
  }

  let ratioForme = 0;
  if (recentPositions.length > 0) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (let index = 0; index < recentPositions.length; index += 1) {
      const weight = index + 1;
      const position = recentPositions[index];
      let positionScore = 0.2;

      if (position === 1) positionScore = 1;
      else if (position === 2) positionScore = 0.8;
      else if (position === 3) positionScore = 0.6;
      else if (position === 4) positionScore = 0.4;

      weightedSum += positionScore * weight;
      totalWeight += weight;
    }

    ratioForme = totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  return {
    recentPositions,
    nbVictoires,
    nbPodiums,
    nbDQ,
    nbAbandons,
    fiabilite,
    averagePosition: round2(averagePosition),
    serie,
    trend: round2(trend),
    ratioForme: round2(ratioForme),
  };
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

function computeTop3Potential(signaux: RunnerSignals, stats: MusicStats, scoreCheval: number) {
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

function computeTop5Potential(signaux: RunnerSignals, stats: MusicStats, scoreCheval: number) {
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

function determineObjective(
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

function buildSignals(
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

function computeBaseHorseScore(signaux: RunnerSignals) {
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

function determineRaceReadabilityScore(
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

function buildPredictedOdds(
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

function determineHorseDecision(
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

  return { decision, typePariConseille, miseConseillee };
}

function buildValue(
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

function buildTopFactors(runner: ScoredParticipant) {
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

function buildBettingPlan(
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

function top4OrTop5(top5: ScoredParticipant[], lisibilite: Lisibilite) {
  return lisibilite === "LISIBLE" ? top5.slice(0, 4) : top5;
}

function buildRaceAlerts(
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

function buildDaySignal(
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

function buildFavoriteSolidity(
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

function buildRecommendation(
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

function buildConfidenceScore(
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
    score >= 7.5
      ? { label: "Haute", emoji: "HAUT" }
      : score >= 6
        ? { label: "Jouable", emoji: "OK" }
        : { label: "Fragile", emoji: "RISQUE" };

  return { score, niveau, facteurs };
}

function buildProfiles(
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

function buildRecommendationRefined(
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
    const confiance = round1(
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
    const kelly = kellyFraction(probaEstimee, runner.cote ?? runner.coteDepart ?? runner.coteMatin);
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

  const predictionsCotes: Record<number, PredictedOdds> = {};
  const valueTop5: Record<number, ValueAnalysis> = {};

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

