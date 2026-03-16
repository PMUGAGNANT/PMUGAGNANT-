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

  const totalScore =
    formScore +
    serieBonus +
    recentVictory +
    formProgression +
    eliteScore +
    winRateBonus +
    ageBonus;

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
  const primarySingle = profils.beton || favori;
  const alternativePairHorse =
    top5.find((runner) => runner.numPmu !== primarySingle.numPmu && !runner.estTocard) || top5[1] || null;

  const safestPlaceHorse =
    top5
      .filter((runner) => runner.numPmu !== primarySingle.numPmu)
      .sort((a, b) => getRunnerReliability(b, topScore) - getRunnerReliability(a, topScore))[0] || null;

  const coupleWinnerHorse =
    top5
      .filter((runner) => runner.numPmu !== primarySingle.numPmu)
      .sort((a, b) => {
        const aValue = valueTop5[a.numPmu]?.valueIndex ?? 1;
        const bValue = valueTop5[b.numPmu]?.valueIndex ?? 1;
        return b.scoreAlgo + bValue * 10 - (a.scoreAlgo + aValue * 10);
      })[0] || alternativePairHorse;

  const simpleSurete = clamp(confiance.score * 0.55 + solidite.score / 22, 0, 10);
  const couplePlaceBase = safestPlaceHorse
    ? (getRunnerReliability(primarySingle, topScore) + getRunnerReliability(safestPlaceHorse, topScore)) / 2
    : 0;
  const couplePlaceSurete = clamp(couplePlaceBase + (profils.lisibilite === "LISIBLE" ? 0.8 : 0.2), 0, 10);
  const coupleGagnantBase = coupleWinnerHorse
    ? (getRunnerReliability(primarySingle, topScore) * 0.55 + getRunnerReliability(coupleWinnerHorse, topScore) * 0.45)
    : 0;
  const coupleGagnantSurete = clamp(coupleGagnantBase + solidite.ecartScore / 20 - 0.6, 0, 10);

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
        `Confiance course ${confiance.score}/10`,
        solidite.score >= 65 ? "Favori globalement solide" : "A jouer avec prudence",
      ],
    },
  ];

  if (safestPlaceHorse) {
    recommendations.push({
      type: "COUPLE_PLACE",
      label: "Couple place",
      emoji: "CP",
      chevaux: [
        {
          numPmu: primarySingle.numPmu,
          nom: primarySingle.nom,
          placeCorde: primarySingle.placeCorde,
        },
        {
          numPmu: safestPlaceHorse.numPmu,
          nom: safestPlaceHorse.nom,
          placeCorde: safestPlaceHorse.placeCorde,
        },
      ],
      surete: round1(couplePlaceSurete),
      sureteLabel: getSureteLabel(couplePlaceSurete),
      miseConseillee: couplePlaceSurete >= 8 ? 3 : couplePlaceSurete >= 6 ? 2 : 1,
      coteEstimee: getEstimatedBetOdds("COUPLE_PLACE", primarySingle, safestPlaceHorse, predictionsCotes),
      pourquoi: [
        "Pair la plus reguliere du top 5",
        profils.lisibilite === "LISIBLE" ? "Course lisible pour un couple place" : "Option defensive sur course moins nette",
        `Deux chevaux avec un profil de securite combine`,
      ],
    });
  }

  if (coupleWinnerHorse) {
    recommendations.push({
      type: "COUPLE_GAGNANT",
      label: "Couple gagnant",
      emoji: "CG",
      chevaux: [
        {
          numPmu: primarySingle.numPmu,
          nom: primarySingle.nom,
          placeCorde: primarySingle.placeCorde,
        },
        {
          numPmu: coupleWinnerHorse.numPmu,
          nom: coupleWinnerHorse.nom,
          placeCorde: coupleWinnerHorse.placeCorde,
        },
      ],
      surete: round1(coupleGagnantSurete),
      sureteLabel: getSureteLabel(coupleGagnantSurete),
      miseConseillee: coupleGagnantSurete >= 7.5 ? 2 : 1,
      coteEstimee: getEstimatedBetOdds("COUPLE_GAGNANT", primarySingle, coupleWinnerHorse, predictionsCotes),
      pourquoi: [
        "Duo avec le meilleur potentiel de victoire combine",
        solidite.ecartScore >= 10 ? "Le favori garde un vrai avantage au score" : "Pair plus speculative",
        `Alternative appuyee par la value du top 5`,
      ],
    });
  }

  return recommendations;
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
      top5,
      favori,
      soliditeFavori,
      scoreConfiance,
      profils,
      predictionsCotes,
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
