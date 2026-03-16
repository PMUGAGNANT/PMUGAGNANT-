import type {
  RaceSummary,
  Participant,
  MusicStats,
  ScoredParticipant,
  PredictedOdds,
  ValueAnalysis,
  FavoriteSolidity,
  Recommendation,
  BetRecommendation,
  ConfidenceScore,
  StrategicProfiles,
  AlgorithmHealth,
  RaceAnalysis,
  RaceStatus,
} from './types';

// ---------------------------------------------------------------------------
// Elite personnel lists
// ---------------------------------------------------------------------------
const ELITE_DRIVERS_TROT: Record<string, number> = {
  bazire: 10,
  duvaldestin: 10,
  abrivard: 10,
  nivard: 9,
  raffin: 9,
};

const ELITE_JOCKEYS_FLAT: Record<string, number> = {
  demuro: 10,
  soumillon: 10,
  lemaire: 10,
  guyon: 9,
  barzalona: 9,
  pasquier: 9,
};

const ELITE_TRAINERS_TROT: Record<string, number> = {
  bazire: 8,
  abrivard: 7,
  duvaldestin: 8,
  allaire: 8,
  locqueneux: 7,
  guilloux: 6,
};

const ELITE_TRAINERS_FLAT: Record<string, number> = {
  fabre: 8,
  graffard: 8,
  rouget: 8,
  ferland: 7,
  head: 6,
  brandt: 6,
};

// ---------------------------------------------------------------------------
// 1. parseMusic
// ---------------------------------------------------------------------------
export function parseMusic(music: string): MusicStats {
  if (!music || music.trim() === '') {
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

  // Take last 10 characters max
  const raw = music.slice(-10);

  const positions: number[] = [];
  let nbDQ = 0;
  let nbAbandons = 0;
  let totalRaces = 0;

  for (const ch of raw) {
    if (ch >= '1' && ch <= '9') {
      positions.push(parseInt(ch, 10));
      totalRaces++;
    } else if (ch === '0') {
      positions.push(10); // 0 means 10th or worse
      totalRaces++;
    } else if (ch === 'D') {
      nbDQ++;
      totalRaces++;
    } else if (ch === 'a') {
      nbAbandons++;
      totalRaces++;
    }
    // letters like p, s, m, h are race type markers -> ignore
  }

  // Recent positions: last 5 numeric positions
  const recentPositions = positions.slice(-5);

  const nbVictoires = positions.filter((p) => p === 1).length;
  const nbPodiums = positions.filter((p) => p >= 1 && p <= 3).length;

  // Fiabilite: (total - DQ - abandons) / total
  const fiabilite = totalRaces > 0 ? (totalRaces - nbDQ - nbAbandons) / totalRaces : 0;

  // Average position
  const averagePosition =
    recentPositions.length > 0
      ? recentPositions.reduce((a, b) => a + b, 0) / recentPositions.length
      : 99;

  // Serie: count consecutive podiums from most recent backwards
  let serie = 0;
  for (let i = recentPositions.length - 1; i >= 0; i--) {
    if (recentPositions[i] <= 3) {
      serie++;
    } else {
      break;
    }
  }

  // Trend: avg of first 2 recent - avg of last 3 recent (negative = improving)
  let trend = 0;
  if (recentPositions.length >= 5) {
    const first2Avg = (recentPositions[0] + recentPositions[1]) / 2;
    const last3Avg =
      (recentPositions[2] + recentPositions[3] + recentPositions[4]) / 3;
    trend = first2Avg - last3Avg;
  } else if (recentPositions.length >= 3) {
    const halfLen = Math.floor(recentPositions.length / 2);
    const older = recentPositions.slice(0, halfLen);
    const newer = recentPositions.slice(halfLen);
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const newerAvg = newer.reduce((a, b) => a + b, 0) / newer.length;
    trend = olderAvg - newerAvg;
  }

  // RatioForme: weighted score 0-1
  // Position 1=1.0, 2=0.8, 3=0.6, 4=0.4, 5+=0.2
  // More recent positions get higher weight
  let ratioForme = 0;
  if (recentPositions.length > 0) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (let i = 0; i < recentPositions.length; i++) {
      const weight = i + 1; // more recent = higher index = higher weight
      const pos = recentPositions[i];
      let posScore: number;
      if (pos === 1) posScore = 1.0;
      else if (pos === 2) posScore = 0.8;
      else if (pos === 3) posScore = 0.6;
      else if (pos === 4) posScore = 0.4;
      else posScore = 0.2;
      weightedSum += posScore * weight;
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
    averagePosition: Math.round(averagePosition * 100) / 100,
    serie,
    trend: Math.round(trend * 100) / 100,
    ratioForme: Math.round(ratioForme * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// 2. scoreRunner
// ---------------------------------------------------------------------------
export function scoreRunner(
  participant: Participant,
  estPlat: boolean
): ScoredParticipant {
  const musicStats = parseMusic(participant.musique);
  const { averagePosition, serie, recentPositions, trend, fiabilite } =
    musicStats;

  // Form score (max 10)
  let formScore: number;
  if (averagePosition < 2) formScore = 10;
  else if (averagePosition < 3) formScore = 8;
  else if (averagePosition < 4) formScore = 6;
  else if (averagePosition < 5) formScore = 4;
  else formScore = 2;

  // Serie bonus (max 18)
  const serieBonus = Math.min(serie * 3, 18);

  // Recent victory (15): if won in last 3 races
  const last3 = recentPositions.slice(-3);
  const recentVictory = last3.includes(1) ? 15 : 0;

  // Form progression (max 12): negative trend = improving
  let formProgression = 0;
  if (trend < -3) formProgression = 12;
  else if (trend < -2) formProgression = 10;
  else if (trend < -1) formProgression = 8;
  else if (trend < 0) formProgression = 5;
  else if (trend === 0) formProgression = 2;
  else formProgression = 0;

  // Elite personnel (max 10)
  let eliteScore = 0;
  if (estPlat) {
    // Flat: check jockey
    const jockeyKey = (participant.jockey || '').toLowerCase().trim();
    for (const [name, score] of Object.entries(ELITE_JOCKEYS_FLAT)) {
      if (jockeyKey.includes(name)) {
        eliteScore = Math.max(eliteScore, score);
      }
    }
  } else {
    // Trot: check driver
    const driverKey = (participant.driver || '').toLowerCase().trim();
    for (const [name, score] of Object.entries(ELITE_DRIVERS_TROT)) {
      if (driverKey.includes(name)) {
        eliteScore = Math.max(eliteScore, score);
      }
    }
  }

  // Trainer quality (max 8)
  let trainerScore = 0;
  const trainerKey = (participant.entraineur || '').toLowerCase().trim();
  const trainerMap = estPlat ? ELITE_TRAINERS_FLAT : ELITE_TRAINERS_TROT;
  for (const [name, score] of Object.entries(trainerMap)) {
    if (trainerKey.includes(name)) {
      trainerScore = Math.max(trainerScore, score);
    }
  }

  // Win rate (max 2)
  const winRate =
    participant.nombreCourses > 0
      ? participant.nombreVictoires / participant.nombreCourses
      : 0;
  const winRateBonus = winRate > 0.2 ? 2 : 0;

  // Age bonus (max 5)
  let ageBonus = 0;
  if (estPlat) {
    if (participant.age >= 3 && participant.age <= 5) ageBonus = 5;
    else if (participant.age === 6) ageBonus = 3;
  } else {
    if (participant.age >= 5 && participant.age <= 8) ageBonus = 5;
    else if (participant.age === 4 || participant.age === 9) ageBonus = 3;
  }

  // Experience and earnings bonus (max 8)
  const placeRate =
    participant.nombreCourses > 0
      ? participant.nombrePlaces / participant.nombreCourses
      : 0;
  let experienceBonus = 0;
  if (participant.nombreCourses >= 18) experienceBonus += 2;
  else if (participant.nombreCourses >= 10) experienceBonus += 1;

  if (placeRate >= 0.55) experienceBonus += 3;
  else if (placeRate >= 0.4) experienceBonus += 2;
  else if (placeRate >= 0.28) experienceBonus += 1;

  if (participant.gainCarriere >= 300000) experienceBonus += 3;
  else if (participant.gainCarriere >= 150000) experienceBonus += 2;
  else if (participant.gainCarriere >= 60000) experienceBonus += 1;

  // Draw / stall bonus
  let drawBonus = 0;
  if (participant.placeCorde && participant.placeCorde > 0) {
    if (estPlat) {
      if (participant.placeCorde <= 3) drawBonus = 3;
      else if (participant.placeCorde <= 6) drawBonus = 2;
      else if (participant.placeCorde <= 10) drawBonus = 1;
      else if (participant.placeCorde >= 16) drawBonus = -2;
      else if (participant.placeCorde >= 13) drawBonus = -1;
    } else {
      if (participant.placeCorde <= 4) drawBonus = 2;
      else if (participant.placeCorde <= 8) drawBonus = 1;
      else if (participant.placeCorde >= 13) drawBonus = -1.5;
      else if (participant.placeCorde >= 10) drawBonus = -0.5;
    }
  }

  const totalScore =
    formScore +
    serieBonus +
    recentVictory +
    formProgression +
    eliteScore +
    trainerScore +
    winRateBonus +
    ageBonus +
    experienceBonus +
    drawBonus;

  // Tocard detection
  let estTocard = false;
  if (participant.nombreCourses >= 4) {
    if (fiabilite < 0.5) estTocard = true;
    if (averagePosition > 9) estTocard = true;
  }

  return {
    ...participant,
    score: totalScore,
    scoreAlgo: totalScore,
    estTocard,
    musicStats,
  };
}

// ---------------------------------------------------------------------------
// 3. analyzeFavoriteSolidity
// ---------------------------------------------------------------------------
export function analyzeFavoriteSolidity(
  favori: ScoredParticipant,
  all: ScoredParticipant[]
): FavoriteSolidity {
  const stats = favori.musicStats;
  const alertes: string[] = [];
  const pointsPositifs: string[] = [];

  let score = 50;

  // Serie >= 3
  if (stats && stats.serie >= 3) {
    score += 15;
    pointsPositifs.push(`Série en cours de ${stats.serie} podiums consécutifs`);
  }

  // Won in last 3 races
  if (stats && stats.recentPositions.length > 0) {
    const last3 = stats.recentPositions.slice(-3);
    if (last3.includes(1)) {
      score += 10;
      pointsPositifs.push('Victoire récente dans les 3 dernières courses');
    }
  }

  // Improving trend
  if (stats && stats.trend < 0) {
    score += 8;
    pointsPositifs.push('Forme en progression (tendance ascendante)');
  }

  // Ratio forme >= 0.7
  if (stats && stats.ratioForme >= 0.7) {
    score += 8;
    pointsPositifs.push(`Ratio de forme excellent (${stats.ratioForme})`);
  }

  // Ecart score: favori vs second
  const sorted = [...all].sort((a, b) => b.scoreAlgo - a.scoreAlgo);
  const secondScore =
    sorted.length > 1 ? sorted[1].scoreAlgo : favori.scoreAlgo;
  const ecartScore = favori.scoreAlgo - secondScore;

  if (ecartScore >= 30) {
    score += 15;
    pointsPositifs.push(`Écart important avec le 2ème (${ecartScore} pts)`);
  } else if (ecartScore >= 15) {
    score += 8;
    pointsPositifs.push(`Bon écart avec le 2ème (${ecartScore} pts)`);
  } else if (ecartScore <= 3) {
    score -= 8;
    alertes.push(
      `Écart très faible avec le 2ème (${ecartScore} pts) - course serrée`
    );
  }

  // DQ penalty
  if (stats && stats.nbDQ >= 2) {
    score -= 15;
    alertes.push(
      `${stats.nbDQ} disqualifications récentes - risque de récidive`
    );
  }

  // Abandon penalty
  if (stats && stats.nbAbandons >= 2) {
    score -= 10;
    alertes.push(`${stats.nbAbandons} abandons récents - fiabilité douteuse`);
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  const estFragile = score < 55;

  return {
    score,
    estFragile,
    alertes,
    pointsPositifs,
    ecartScore,
  };
}

// ---------------------------------------------------------------------------
// 4. buildRecommendation
// ---------------------------------------------------------------------------
export function buildRecommendation(
  solidite: FavoriteSolidity,
  favori: ScoredParticipant
): Recommendation {
  const raisonnement: string[] = [];
  let decision: string;
  let emoji: string;
  let vautLeCoup: boolean;

  if (solidite.score >= 75 && solidite.alertes.length === 0) {
    decision = 'JOUEZ LE FAVORI';
    emoji = '🟢';
    vautLeCoup = true;
    raisonnement.push(
      `Le favori ${favori.nom} affiche une solidité de ${solidite.score}/100`
    );
    raisonnement.push('Aucune alerte détectée');
  } else if (
    solidite.score >= 55 &&
    solidite.score < 75 &&
    solidite.alertes.length <= 1
  ) {
    decision = 'FAVORI JOUABLE AVEC PRUDENCE';
    emoji = '🟡';
    vautLeCoup = true;
    raisonnement.push(
      `Le favori ${favori.nom} a un profil correct (${solidite.score}/100)`
    );
    if (solidite.alertes.length === 1) {
      raisonnement.push(`Attention : ${solidite.alertes[0]}`);
    }
  } else if (solidite.score >= 35 && solidite.score < 55) {
    decision = 'COURSE COMPLEXE';
    emoji = '🟠';
    vautLeCoup = false;
    raisonnement.push(
      `Le favori ${favori.nom} présente des faiblesses (${solidite.score}/100)`
    );
    for (const alerte of solidite.alertes) {
      raisonnement.push(`Alerte : ${alerte}`);
    }
  } else {
    decision = 'COURSE À ÉVITER';
    emoji = '🔴';
    vautLeCoup = false;
    raisonnement.push(
      `Le favori ${favori.nom} est trop fragile (${solidite.score}/100)`
    );
    for (const alerte of solidite.alertes) {
      raisonnement.push(`Alerte : ${alerte}`);
    }
  }

  // Add positive factors to reasoning
  for (const point of solidite.pointsPositifs) {
    raisonnement.push(`✅ ${point}`);
  }

  return { decision, emoji, vautLeCoup, raisonnement };
}

// ---------------------------------------------------------------------------
// 5. computeConfidenceScore
// ---------------------------------------------------------------------------
export function computeConfidenceScore(
  solidite: FavoriteSolidity,
  top5: ScoredParticipant[]
): ConfidenceScore {
  const facteurs: string[] = [];
  let score = 5.0;

  // Solidity factor
  if (solidite.score >= 80) {
    score += 1.5;
    facteurs.push('Solidité du favori très élevée (+1.5)');
  } else if (solidite.score >= 65) {
    score += 0.8;
    facteurs.push('Solidité du favori correcte (+0.8)');
  } else if (solidite.score < 45) {
    score -= 1.0;
    facteurs.push('Solidité du favori faible (-1.0)');
  }

  // Alertes factor
  if (solidite.alertes.length === 0) {
    score += 0.5;
    facteurs.push('Aucune alerte (+0.5)');
  } else {
    score -= solidite.alertes.length * 0.4;
    facteurs.push(
      `${solidite.alertes.length} alerte(s) (-${(solidite.alertes.length * 0.4).toFixed(1)})`
    );
  }

  // Ecart score factor
  if (solidite.ecartScore >= 30) {
    score += 0.8;
    facteurs.push('Écart de score très important (+0.8)');
  } else if (solidite.ecartScore >= 15) {
    score += 0.5;
    facteurs.push('Bon écart de score (+0.5)');
  } else if (solidite.ecartScore < 5) {
    score -= 0.4;
    facteurs.push('Écart de score faible (-0.4)');
  }

  // Clamp 0-10
  score = Math.max(0, Math.min(10, score));
  score = Math.round(score * 10) / 10;

  // Level
  let niveau: { label: string; emoji: string };
  if (score >= 7.5) {
    niveau = { label: 'ÉLEVÉ', emoji: '🟢' };
  } else if (score >= 5.5) {
    niveau = { label: 'MOYEN', emoji: '🟡' };
  } else if (score >= 3.5) {
    niveau = { label: 'FAIBLE', emoji: '🟠' };
  } else {
    niveau = { label: 'TRÈS FAIBLE', emoji: '🔴' };
  }

  return { score, niveau, facteurs };
}

// ---------------------------------------------------------------------------
// 6. predictOdds
// ---------------------------------------------------------------------------
export function predictOdds(
  participant: ScoredParticipant,
  maxScore: number
): PredictedOdds {
  const coteMatin = participant.cote;

  if (coteMatin === null || coteMatin === undefined || maxScore === 0) {
    return {
      coteMatin,
      coteEstimee: coteMatin,
      variation: '0%',
      tendance: 'STABLE',
    };
  }

  const scoreRatio = participant.scoreAlgo / maxScore;
  let factor = 1.0;

  if (scoreRatio >= 0.85) {
    factor *= 0.8;
  } else if (scoreRatio >= 0.7) {
    factor *= 0.9;
  } else if (scoreRatio <= 0.3) {
    factor *= 1.15;
  }

  if (participant.nombreSuiveurs > 500) {
    factor *= 0.85;
  }

  const coteEstimee = Math.round(coteMatin * factor * 10) / 10;
  const variationPct = ((coteEstimee - coteMatin) / coteMatin) * 100;
  const variationRounded = Math.round(variationPct);
  const variation =
    variationRounded >= 0 ? `+${variationRounded}%` : `${variationRounded}%`;

  let tendance: PredictedOdds['tendance'];
  if (variationRounded <= -15) {
    tendance = 'BAISSE_FORTE';
  } else if (variationRounded < -3) {
    tendance = 'BAISSE';
  } else if (variationRounded > 5) {
    tendance = 'HAUSSE';
  } else {
    tendance = 'STABLE';
  }

  return { coteMatin, coteEstimee, variation, tendance };
}

// ---------------------------------------------------------------------------
// 7. computeValue
// ---------------------------------------------------------------------------
export function computeValue(
  participant: ScoredParticipant,
  allScored: ScoredParticipant[]
): ValueAnalysis {
  const stats = participant.musicStats;
  let probabilite: number;

  if (stats && stats.recentPositions.length > 0) {
    const last5 = stats.recentPositions.slice(-5);
    const wins = last5.filter((p) => p === 1).length;
    const podiums = last5.filter((p) => p >= 1 && p <= 3).length;

    if (wins >= 3) {
      probabilite = 0.3;
    } else if (wins >= 2) {
      probabilite = 0.23;
    } else if (wins >= 1) {
      probabilite = 0.18;
    } else if (podiums >= 2) {
      probabilite = 0.14;
    } else if (stats.ratioForme >= 0.4) {
      probabilite = 0.08;
    } else {
      probabilite = 0.05;
    }
  } else {
    probabilite = 0.05;
  }

  // Fair odds with 14.5% commission
  const coteJuste = Math.round((1 / (probabilite * 0.855)) * 100) / 100;
  const cotePMU = participant.cote ?? coteJuste;
  const valueIndex = Math.round((cotePMU / coteJuste) * 100) / 100;

  let label: string;
  let emoji: string;
  let miseConseillee: number;

  if (valueIndex >= 3.0) {
    label = 'VALUE EXCEPTIONNELLE';
    emoji = '💎';
    miseConseillee = 5;
  } else if (valueIndex >= 2.2) {
    label = 'VALUE FORTE';
    emoji = '🔥';
    miseConseillee = 3;
  } else if (valueIndex >= 1.6) {
    label = 'VALUE CORRECTE';
    emoji = '✅';
    miseConseillee = 2;
  } else if (valueIndex >= 0.8) {
    label = 'VALUE NEUTRE';
    emoji = '➖';
    miseConseillee = 1;
  } else {
    label = 'SURCÔTÉ';
    emoji = '❌';
    miseConseillee = 0;
  }

  return {
    probabilite,
    coteJuste,
    cotePMU,
    valueIndex,
    label,
    emoji,
    miseConseillee,
  };
}

// ---------------------------------------------------------------------------
// 8. identifyProfiles
// ---------------------------------------------------------------------------
export function identifyProfiles(
  top5: ScoredParticipant[],
  solidite: FavoriteSolidity,
  confiance: ConfidenceScore,
  valueTop5: Record<number, ValueAnalysis>
): StrategicProfiles {
  let beton: ScoredParticipant | null = null;
  let pepite: ScoredParticipant | null = null;
  let sniper: ScoredParticipant | null = null;

  // Beton: top5[0] if solidite >= 65 AND confiance >= 7.0
  if (
    top5.length > 0 &&
    solidite.score >= 65 &&
    confiance.score >= 7.0
  ) {
    beton = top5[0];
  }

  // Pepite: first in top5 (not beton) with valueIndex >= 1.95 AND confiance >= 7.5
  for (const runner of top5) {
    if (beton && runner.numPmu === beton.numPmu) continue;
    const value = valueTop5[runner.numPmu];
    if (value && value.valueIndex >= 1.95 && confiance.score >= 7.5) {
      pepite = runner;
      break;
    }
  }

  // Sniper: first in top5 (not beton, not pepite) with valueIndex >= 1.45 AND confiance >= 7.8
  for (const runner of top5) {
    if (beton && runner.numPmu === beton.numPmu) continue;
    if (pepite && runner.numPmu === pepite.numPmu) continue;
    const value = valueTop5[runner.numPmu];
    if (value && value.valueIndex >= 1.45 && confiance.score >= 7.8) {
      sniper = runner;
      break;
    }
  }

  // Lisibilite
  let lisibilite: StrategicProfiles['lisibilite'];
  if (beton) {
    lisibilite = 'LISIBLE';
  } else if (pepite || sniper) {
    lisibilite = 'COMPLEXE';
  } else {
    lisibilite = 'LOTERIE';
  }

  return { beton, pepite, sniper, lisibilite };
}

// ---------------------------------------------------------------------------
// 9. buildBetRecommendations
// ---------------------------------------------------------------------------
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function getSureteLabel(score: number) {
  if (score >= 8.5) return "Tres forte";
  if (score >= 7) return "Forte";
  if (score >= 5.5) return "Moyenne";
  return "Speculative";
}

function getRunnerReliability(runner: ScoredParticipant, topScore: number) {
  const stats = runner.musicStats;
  const scoreRatio = topScore > 0 ? runner.scoreAlgo / topScore : 0;
  const fiabilite = stats?.fiabilite ?? 0.5;
  const ratioForme = stats?.ratioForme ?? 0.4;
  const podiumRate = runner.nombreCourses > 0 ? runner.nombrePlaces / runner.nombreCourses : 0;

  return clamp(scoreRatio * 4 + fiabilite * 3 + ratioForme * 2 + podiumRate, 0, 10);
}

function getDrawRating(
  runner: ScoredParticipant,
  estPlat: boolean,
  nombrePartants: number
) {
  if (!runner.placeCorde || runner.placeCorde <= 0) {
    return 0.5;
  }

  const normalized = 1 - (runner.placeCorde - 1) / Math.max(1, nombrePartants - 1);

  if (estPlat) {
    return clamp(normalized, 0.1, 1);
  }

  return clamp(0.35 + normalized * 0.65, 0.2, 1);
}

function getRunnerSignals(
  runner: ScoredParticipant,
  topScore: number,
  estPlat: boolean,
  nombrePartants: number,
  valueTop5: Record<number, ValueAnalysis>
) {
  const stats = runner.musicStats;
  const scoreRatio = topScore > 0 ? runner.scoreAlgo / topScore : 0;
  const podiumRate = runner.nombreCourses > 0 ? runner.nombrePlaces / runner.nombreCourses : 0;
  const winRate = runner.nombreCourses > 0 ? runner.nombreVictoires / runner.nombreCourses : 0;
  const fiabilite = stats?.fiabilite ?? 0.5;
  const ratioForme = stats?.ratioForme ?? 0.4;
  const recentWinBoost = stats?.recentPositions?.slice(-3).includes(1) ? 1 : 0;
  const drawRating = getDrawRating(runner, estPlat, nombrePartants);
  const valueIndex = valueTop5[runner.numPmu]?.valueIndex ?? 1;

  const podiumChance = clamp(
    scoreRatio * 0.28 +
      fiabilite * 0.22 +
      ratioForme * 0.2 +
      podiumRate * 0.18 +
      drawRating * 0.12,
    0.08,
    0.88
  );

  const winChance = clamp(
    scoreRatio * 0.34 +
      fiabilite * 0.12 +
      ratioForme * 0.16 +
      winRate * 0.16 +
      recentWinBoost * 0.12 +
      drawRating * 0.1,
    0.04,
    0.8
  );

  const safetyScore = clamp(
    podiumChance * 5.8 + fiabilite * 1.7 + ratioForme * 1.5 + drawRating,
    0,
    10
  );

  const attackScore = clamp(
    winChance * 6.2 + scoreRatio * 2 + recentWinBoost * 0.8 + Math.min(valueIndex, 2.2) * 0.4,
    0,
    10
  );

  return {
    podiumChance,
    winChance,
    fiabilite,
    ratioForme,
    drawRating,
    valueIndex,
    safetyScore,
    attackScore,
  };
}

function buildPairEvaluations(
  top5: ScoredParticipant[],
  topScore: number,
  estPlat: boolean,
  nombrePartants: number,
  valueTop5: Record<number, ValueAnalysis>
) {
  const pairs: Array<{
    runners: [ScoredParticipant, ScoredParticipant];
    placeScore: number;
    placeSurete: number;
    winScore: number;
    winSurete: number;
    placeReasons: string[];
    winReasons: string[];
  }> = [];

  for (let i = 0; i < top5.length; i++) {
    for (let j = i + 1; j < top5.length; j++) {
      const first = top5[i];
      const second = top5[j];
      const firstSignals = getRunnerSignals(first, topScore, estPlat, nombrePartants, valueTop5);
      const secondSignals = getRunnerSignals(second, topScore, estPlat, nombrePartants, valueTop5);

      const pairSafetyFloor = Math.min(firstSignals.podiumChance, secondSignals.podiumChance);
      const pairSafetyAverage = (firstSignals.podiumChance + secondSignals.podiumChance) / 2;
      const pairAttackFloor = Math.min(firstSignals.winChance, secondSignals.winChance);
      const pairAttackAverage = (firstSignals.winChance + secondSignals.winChance) / 2;
      const combinedDraw = (firstSignals.drawRating + secondSignals.drawRating) / 2;
      const combinedValue = (firstSignals.valueIndex + secondSignals.valueIndex) / 2;
      const complementarity =
        1 - Math.min(Math.abs(firstSignals.attackScore - secondSignals.attackScore), 5) / 10;

      const placeScore = pairSafetyFloor * 0.5 + pairSafetyAverage * 0.32 + complementarity * 0.1 + combinedDraw * 0.08;
      const winScore = pairAttackFloor * 0.48 + pairAttackAverage * 0.28 + complementarity * 0.08 + combinedDraw * 0.06 + Math.min(combinedValue, 1.8) * 0.1;

      const placeSurete = clamp(
        placeScore * 9.4 +
          ((firstSignals.safetyScore + secondSignals.safetyScore) / 2) * 0.18,
        0,
        10
      );
      const winSurete = clamp(
        winScore * 10.1 +
          ((firstSignals.attackScore + secondSignals.attackScore) / 2) * 0.14,
        0,
        10
      );

      const placeReasons = [
        `Base podium: ${Math.round(pairSafetyFloor * 100)}% / ${Math.round(pairSafetyAverage * 100)}%`,
        combinedDraw >= 0.62 ? "Positions de depart favorables pour le duo" : "Duo solide meme sans avantage net a la corde",
        complementarity >= 0.7 ? "Deux profils qui se completent bien" : "Duo plus direct, axe sur la regularite",
      ];

      const winReasons = [
        `Potentiel de victoire combine: ${Math.round(pairAttackAverage * 100)}%`,
        pairAttackFloor >= 0.22 ? "Les deux chevaux gardent une vraie chance de finir tres haut" : "Pari offensif avec un cheval d'appui fort",
        combinedValue >= 1.15 ? "La paire garde un peu de value" : "Pari principalement base sur la force pure du duo",
      ];

      pairs.push({
        runners: [first, second],
        placeScore,
        placeSurete,
        winScore,
        winSurete,
        placeReasons,
        winReasons,
      });
    }
  }

  return pairs;
}

function getEstimatedBetOdds(
  type: BetRecommendation["type"],
  primary: ScoredParticipant,
  secondary: ScoredParticipant | null,
  predictionsCotes: Record<number, PredictedOdds>
) {
  const primaryOdds = predictionsCotes[primary.numPmu]?.coteEstimee ?? primary.cote ?? 2;

  if (!secondary) {
    return round1(primaryOdds);
  }

  const secondaryOdds = predictionsCotes[secondary.numPmu]?.coteEstimee ?? secondary.cote ?? 2.5;
  const combined = primaryOdds + secondaryOdds;

  if (type === "COUPLE_GAGNANT") {
    return round1(Math.max(2.5, combined * 0.9));
  }

  return round1(Math.max(1.4, combined * 0.35));
}

export function buildBetRecommendations(
  courseInfo: RaceSummary,
  top5: ScoredParticipant[],
  favori: ScoredParticipant,
  solidite: FavoriteSolidity,
  confiance: ConfidenceScore,
  profils: StrategicProfiles,
  predictionsCotes: Record<number, PredictedOdds>,
  valueTop5: Record<number, ValueAnalysis>
): BetRecommendation[] {
  if (top5.length === 0) return [];

  const topScore = top5[0].scoreAlgo || favori.scoreAlgo || 1;
  const runnerSignals = top5.map((runner) => ({
    runner,
    signals: getRunnerSignals(
      runner,
      topScore,
      courseInfo.estPlat,
      courseInfo.nombrePartants,
      valueTop5
    ),
  }));

  const primarySingle =
    runnerSignals
      .slice()
      .sort((a, b) => {
        const aWeight = a.signals.winChance * 0.52 + a.signals.podiumChance * 0.22 + (a.runner.numPmu === favori.numPmu ? 0.08 : 0);
        const bWeight = b.signals.winChance * 0.52 + b.signals.podiumChance * 0.22 + (b.runner.numPmu === favori.numPmu ? 0.08 : 0);
        return bWeight - aWeight;
      })[0]?.runner || profils.beton || favori;

  const primarySignals = getRunnerSignals(
    primarySingle,
    topScore,
    courseInfo.estPlat,
    courseInfo.nombrePartants,
    valueTop5
  );
  const simpleSurete = clamp(
    primarySignals.attackScore * 0.62 + primarySignals.safetyScore * 0.18 + confiance.score * 0.16 + solidite.score / 25,
    0,
    10
  );

  const pairEvaluations = buildPairEvaluations(
    top5,
    topScore,
    courseInfo.estPlat,
    courseInfo.nombrePartants,
    valueTop5
  );

  const bestPlacePair = pairEvaluations
    .slice()
    .sort((a, b) => {
      const aAnchored = a.runners.some((runner) => runner.numPmu === primarySingle.numPmu) ? 0.18 : 0;
      const bAnchored = b.runners.some((runner) => runner.numPmu === primarySingle.numPmu) ? 0.18 : 0;
      return (b.placeScore + bAnchored) - (a.placeScore + aAnchored);
    })[0];

  const bestWinPair = pairEvaluations
    .slice()
    .sort((a, b) => {
      const aAnchored = a.runners.some((runner) => runner.numPmu === primarySingle.numPmu) ? 0.14 : 0;
      const bAnchored = b.runners.some((runner) => runner.numPmu === primarySingle.numPmu) ? 0.14 : 0;
      return (b.winScore + bAnchored) - (a.winScore + aAnchored);
    })[0];

  const recommendations: BetRecommendation[] = [
    {
      type: "SIMPLE_GAGNANT",
      label: "Simple gagnant",
      emoji: "SG",
      chevaux: [{
        numPmu: primarySingle.numPmu,
        nom: primarySingle.nom,
        placeCorde: primarySingle.placeCorde,
      }],
      surete: round1(simpleSurete),
      sureteLabel: getSureteLabel(simpleSurete),
      miseConseillee: simpleSurete >= 8 ? 4 : simpleSurete >= 6.5 ? 3 : 2,
      coteEstimee: getEstimatedBetOdds("SIMPLE_GAGNANT", primarySingle, null, predictionsCotes),
      pourquoi: [
        `Base principale: ${primarySingle.nom}`,
        `Potentiel victoire estime: ${Math.round(primarySignals.winChance * 100)}%`,
        primarySignals.drawRating >= 0.7 ? "Bonne stalle / bonne corde pour appuyer le cheval" : "Le profil reste jouable meme sans gros avantage au depart",
        solidite.score >= 65 ? "Favori globalement solide" : "A jouer avec prudence",
      ],
    },
  ];

  if (bestPlacePair) {
    const [firstRunner, secondRunner] = bestPlacePair.runners;
    recommendations.push({
      type: "COUPLE_PLACE",
      label: "Couple place",
      emoji: "CP",
      chevaux: [
        {
          numPmu: firstRunner.numPmu,
          nom: firstRunner.nom,
          placeCorde: firstRunner.placeCorde,
        },
        {
          numPmu: secondRunner.numPmu,
          nom: secondRunner.nom,
          placeCorde: secondRunner.placeCorde,
        },
      ],
      surete: round1(bestPlacePair.placeSurete),
      sureteLabel: getSureteLabel(bestPlacePair.placeSurete),
      miseConseillee: bestPlacePair.placeSurete >= 8 ? 3 : bestPlacePair.placeSurete >= 6 ? 2 : 1,
      coteEstimee: getEstimatedBetOdds("COUPLE_PLACE", firstRunner, secondRunner, predictionsCotes),
      pourquoi: bestPlacePair.placeReasons,
    });
  }

  if (bestWinPair) {
    const [firstRunner, secondRunner] = bestWinPair.runners;
    recommendations.push({
      type: "COUPLE_GAGNANT",
      label: "Couple gagnant",
      emoji: "CG",
      chevaux: [
        {
          numPmu: firstRunner.numPmu,
          nom: firstRunner.nom,
          placeCorde: firstRunner.placeCorde,
        },
        {
          numPmu: secondRunner.numPmu,
          nom: secondRunner.nom,
          placeCorde: secondRunner.placeCorde,
        },
      ],
      surete: round1(bestWinPair.winSurete),
      sureteLabel: getSureteLabel(bestWinPair.winSurete),
      miseConseillee: bestWinPair.winSurete >= 7.5 ? 2 : 1,
      coteEstimee: getEstimatedBetOdds("COUPLE_GAGNANT", firstRunner, secondRunner, predictionsCotes),
      pourquoi: bestWinPair.winReasons,
    });
  }

  return recommendations;
}

function buildAlgorithmHealth(
  solidite: FavoriteSolidity,
  confiance: ConfidenceScore,
  profils: StrategicProfiles,
  parisRecommandes: BetRecommendation[],
  top5: ScoredParticipant[],
  valueTop5: Record<number, ValueAnalysis>
): AlgorithmHealth {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const notes: string[] = [];
  let score = 5.5;

  if (solidite.score >= 72) {
    score += 1.6;
    strengths.push(`Favori solide (${solidite.score}/100)`);
  } else if (solidite.score >= 58) {
    score += 0.8;
    strengths.push(`Base correcte sur le favori (${solidite.score}/100)`);
  } else {
    score -= 1.2;
    weaknesses.push(`Favori fragile (${solidite.score}/100)`);
  }

  if (confiance.score >= 7.5) {
    score += 1.3;
    strengths.push(`Confiance elevee sur la course (${confiance.score}/10)`);
  } else if (confiance.score >= 6) {
    score += 0.6;
    notes.push(`Confiance moyenne mais exploitable (${confiance.score}/10)`);
  } else {
    score -= 1.1;
    weaknesses.push(`Lecture de course delicate (${confiance.score}/10)`);
  }

  if (profils.lisibilite === 'LISIBLE') {
    score += 0.9;
    strengths.push('Course lisible pour l IA');
  } else if (profils.lisibilite === 'COMPLEXE') {
    notes.push('Course plus technique, les paris demandent de la prudence');
  } else {
    score -= 0.8;
    weaknesses.push('Course de type loterie');
  }

  const topGap =
    top5.length > 1 ? top5[0].scoreAlgo - top5[1].scoreAlgo : top5[0]?.scoreAlgo ?? 0;
  if (topGap >= 12) {
    score += 0.7;
    strengths.push(`Ecarts nets en tete (${topGap} pts)`);
  } else if (topGap <= 4) {
    score -= 0.7;
    weaknesses.push(`Top serre (${topGap} pts entre les deux premiers)`);
  }

  const strongValues = top5.filter((runner) => (valueTop5[runner.numPmu]?.valueIndex ?? 0) >= 1.4);
  if (strongValues.length >= 2) {
    score += 0.5;
    strengths.push('Plusieurs chevaux gardent une vraie value');
  } else if (strongValues.length === 0) {
    notes.push('Peu de value pure, l IA joue surtout la force sportive');
  }

  const averageSurete =
    parisRecommandes.length > 0
      ? parisRecommandes.reduce((sum, pari) => sum + pari.surete, 0) / parisRecommandes.length
      : 0;

  if (averageSurete >= 7) {
    score += 0.8;
    strengths.push(`Plans de paris coherents (${round1(averageSurete)}/10)`);
  } else if (averageSurete < 5.5) {
    score -= 0.8;
    weaknesses.push(`Plans de paris encore fragiles (${round1(averageSurete)}/10)`);
  }

  if (solidite.alertes.length > 0) {
    score -= Math.min(1.2, solidite.alertes.length * 0.35);
    weaknesses.push(...solidite.alertes.slice(0, 2));
  }

  score = round1(clamp(score, 0, 10));

  const status =
    score >= 7.5 ? 'SAIN' : score >= 5.5 ? 'SURVEILLANCE' : 'FRAGILE';

  if (notes.length === 0) {
    notes.push(
      status === 'SAIN'
        ? 'L algo lit bien cette course.'
        : status === 'SURVEILLANCE'
          ? 'La lecture est jouable mais doit etre suivie.'
          : 'Mieux vaut rester prudent sur cette course.'
    );
  }

  return {
    score,
    status,
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    notes: notes.slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// 10. analyzeRace
// ---------------------------------------------------------------------------
export function analyzeRace(
  courseInfo: RaceSummary,
  participants: Participant[]
): RaceAnalysis {
  // 1. Score all participants
  const scored = participants.map((p) => scoreRunner(p, courseInfo.estPlat));

  // 2. Sort by scoreAlgo descending
  scored.sort((a, b) => b.scoreAlgo - a.scoreAlgo);

  // 3. Take top 5 non-tocard
  const top5 = scored.filter((p) => !p.estTocard).slice(0, 5);

  // 4. Get favori
  const favori = top5.length > 0 ? top5[0] : null;

  // 5-8: Only if favori exists
  let soliditeFavori: FavoriteSolidity | null = null;
  let recommandation: Recommendation | null = null;
  let scoreConfiance: ConfidenceScore | null = null;
  let parisRecommandes: BetRecommendation[] = [];
  const predictionsCotes: Record<number, PredictedOdds> = {};
  const valueTop5: Record<number, ValueAnalysis> = {};
  let profils: StrategicProfiles = {
    beton: null,
    pepite: null,
    sniper: null,
    lisibilite: 'LOTERIE',
  };
  let algorithmHealth: AlgorithmHealth | null = null;

  if (favori) {
    // 5. Analyze favorite solidity
    soliditeFavori = analyzeFavoriteSolidity(favori, scored);

    // 6. Build recommendation
    recommandation = buildRecommendation(soliditeFavori, favori);

    // 7. Compute confidence
    scoreConfiance = computeConfidenceScore(soliditeFavori, top5);

    // 8. Predict odds for top 5
    const maxScore = top5[0].scoreAlgo;
    for (const runner of top5) {
      predictionsCotes[runner.numPmu] = predictOdds(runner, maxScore);
    }

    // 9. Compute value for top 5
    for (const runner of top5) {
      valueTop5[runner.numPmu] = computeValue(runner, scored);
    }

    // 10. Identify profiles
    profils = identifyProfiles(
      top5,
      soliditeFavori,
      scoreConfiance,
      valueTop5
    );

    parisRecommandes = buildBetRecommendations(
      courseInfo,
      top5,
      favori,
      soliditeFavori,
      scoreConfiance,
      profils,
      predictionsCotes,
      valueTop5
    );

    algorithmHealth = buildAlgorithmHealth(
      soliditeFavori,
      scoreConfiance,
      profils,
      parisRecommandes,
      top5,
      valueTop5
    );
  }

  // 11. Return complete analysis
  return {
    courseInfo,
    participants: participants.length,
    top5,
    favori,
    soliditeFavori,
    recommandation,
    parisRecommandes,
    scoreConfiance,
    predictionsCotes,
    profils,
    valueTop5,
    algorithmHealth,
  };
}

// ---------------------------------------------------------------------------
// 11. getMinutesUntilStart
// ---------------------------------------------------------------------------
export function getMinutesUntilStart(heureDepart: string): number {
  const [hours, minutes] = heureDepart.split(':').map(Number);

  // Build a Date for today in Europe/Paris timezone
  const now = new Date();

  // Get current time in Paris
  const parisNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/Paris' })
  );

  // Build target time in Paris
  const parisTarget = new Date(parisNow);
  parisTarget.setHours(hours, minutes, 0, 0);

  const diffMs = parisTarget.getTime() - parisNow.getTime();
  return Math.round(diffMs / 60000);
}

// ---------------------------------------------------------------------------
// 12. getRaceStatus
// ---------------------------------------------------------------------------
export function getRaceStatus(heureDepart: string): {
  status: RaceStatus;
  minutesUntil: number;
} {
  const minutesUntil = getMinutesUntilStart(heureDepart);

  let status: RaceStatus;
  if (minutesUntil < -10) {
    status = 'finished';
  } else if (minutesUntil <= 30) {
    status = 'prono_available';
  } else {
    status = 'upcoming';
  }

  return { status, minutesUntil };
}
