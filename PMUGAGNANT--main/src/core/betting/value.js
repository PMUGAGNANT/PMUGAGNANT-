'use strict';

const { parseMusic } = require('../horse/music');
const { ALGORITHM_CONFIG } = require('../config/algorithm');
const { calculateFairOdds, calculateValueIndex, parseOdds } = require('../utils/odds');

const VALUE_CONFIG = {
    maxValueCap: 5.0,
    exceptional: 3.0,
    strong: 2.2,
    correct: 1.6,
    negative: 0.8,
    confidenceBonusExceptional: 2.0,
    confidenceBonusStrong: 1.2,
    confidenceBonusCorrect: 0.5,
    confidenceMalusNegative: -1.5,
    stakeExceptional: 5,
    stakeStrong: 3,
    stakeCorrect: 2,
    stakeNeutral: 1,
    probabilitiesFromMusic: {
        tripleVictory: 0.30,
        doubleVictory: 0.23,
        recentVictory: 0.18,
        regularPodium: 0.14,
        recentPodium: 0.11,
        averageForm: 0.08,
        weakForm: 0.05,
        tocard: 0.02
    }
};

function estimateProbabilityFromMusic(music, scoreAlgo = 0) {
    const stats = typeof music === 'string' ? parseMusic(music) : music;
    const recent = stats.coursesVal.slice(0, 5).map((race) => race.position);
    const wins = recent.filter((position) => position === 1).length;
    const podiums = recent.filter((position) => position <= 3).length;
    const incidents = stats.nbDQ + stats.nbAbandons;

    let baseProbability;
    if (wins >= 3) baseProbability = VALUE_CONFIG.probabilitiesFromMusic.tripleVictory;
    else if (wins >= 2) baseProbability = VALUE_CONFIG.probabilitiesFromMusic.doubleVictory;
    else if (recent[0] === 1 || recent[1] === 1) baseProbability = VALUE_CONFIG.probabilitiesFromMusic.recentVictory;
    else if (podiums >= 3 && incidents === 0) baseProbability = VALUE_CONFIG.probabilitiesFromMusic.regularPodium;
    else if (podiums >= 1 && incidents <= 1) baseProbability = VALUE_CONFIG.probabilitiesFromMusic.recentPodium;
    else if (recent.length > 0 && recent[0] <= 6) baseProbability = VALUE_CONFIG.probabilitiesFromMusic.averageForm;
    else if (incidents >= 3) baseProbability = VALUE_CONFIG.probabilitiesFromMusic.tocard;
    else baseProbability = VALUE_CONFIG.probabilitiesFromMusic.weakForm;

    if (scoreAlgo > 0) {
        const scoreProbability = Math.min(0.30, Math.max(0.03, scoreAlgo / 200));
        return (baseProbability * 0.6) + (scoreProbability * 0.4);
    }

    return baseProbability;
}

function calculateRealProbability(participant, validResults = []) {
    const stats = participant._mu || parseMusic(participant.musique || '');
    let score = 0;

    score += (stats.ratioForme || 0) * 40;
    score += Math.min((stats.serie || 0) * 6, 18);
    score += (stats.fiabilite || 0) * 10;

    const signal = participant._signalEquidia?.signal || 'NEUTRE';
    if (signal === 'TRES_POSITIF') score += 15;
    else if (signal === 'POSITIF') score += 8;
    else if (signal === 'NEGATIF') score -= 8;
    else if (signal === 'TRES_NEGATIF') score -= 15;

    const followers = participant.nombreSuiveurs || 0;
    if (followers >= 800) score += 12;
    else if (followers >= 400) score += 7;
    else if (followers >= 200) score += 3;

    const latest = stats.coursesVal?.slice(0, 2) || [];
    if (latest[0]?.position === 1) score += 15;
    else if (latest[0]?.position <= 2) score += 8;
    else if (latest[0]?.position <= 3) score += 4;

    score += tempoBonus(participant._tempo);
    score += (participant._reseau?.forceNorm || 0) * 1.5;
    score += (participant._croisements?.forceDirecte || 0) * 4;
    score += participant._biaisBonus || 0;
    score += participant._memoire?.bonus || 0;

    const pool = (validResults || [])
        .filter((item) => item && !item._estTocard)
        .map((item) => ({
            numero: item.numero,
            score: computeIndependentScore(item)
        }));

    if (pool.length === 0) {
        return 0.05;
    }

    const maxScore = Math.max(...pool.map((item) => item.score));
    const exponents = pool.map((item) => ({
        numero: item.numero,
        exp: Math.exp((item.score - maxScore) / 25)
    }));
    const total = exponents.reduce((sum, item) => sum + item.exp, 0) || 1;
    const target = exponents.find((item) => item.numero === participant.numero);
    const ratio = (target?.exp || 0) / total;

    return Math.min(0.35, Math.max(0.02, ratio));
}

function calculateMarketProbability(odds) {
    const value = parseOdds(odds);
    if (!value) {
        return 0;
    }

    return (1 / value) / 1.15;
}

function calculateLegacyValueBet(participant, validResults) {
    const odds = Number(participant.coteTempsReel || participant.cote) || 0;
    if (odds <= 0) {
        return 0;
    }

    const market = calculateMarketProbability(odds);
    const real = calculateRealProbability(participant, validResults);
    if (market <= 0) {
        return 0;
    }

    return Math.round((real / market) * 100) / 100;
}

function decisionFromValue(value) {
    if (value <= 0) return { decision: 'NE PAS JOUER', emoji: '❌' };
    if (value < 0.90) return { decision: 'NE PAS JOUER', emoji: '❌' };
    if (value < VALUE_CONFIG.correct) return { decision: 'SURVEILLER', emoji: '👀' };
    if (value < VALUE_CONFIG.strong) return { decision: 'PLACE', emoji: '🟡' };
    return { decision: 'GAGNANT', emoji: '🟢' };
}

function analyzeRunnerValue(runner, validResults = [], options = {}) {
    const marketOdds = parseOdds(runner.coteTempsReel || runner.cote || runner.cotePmu);
    const musicStats = runner._mu || parseMusic(runner.musique || runner.historique || '');
    const scoreAlgo = runner._scoreAlgo || runner.score || 0;
    const probability = estimateProbabilityFromMusic(musicStats, scoreAlgo);
    const fairOdds = calculateFairOdds(probability, 0.145) || 99;
    const rawValueIndex = marketOdds ? Number(calculateValueIndex(marketOdds, fairOdds).toFixed(2)) : 1;
    const legacyValue = marketOdds ? calculateLegacyValueBet({ ...runner, _mu: musicStats }, validResults) : null;

    let finalValueIndex = Math.min(VALUE_CONFIG.maxValueCap, rawValueIndex);
    if (legacyValue !== null && legacyValue > 0) {
        const legacyDecision = decisionFromValue(legacyValue);
        if (rawValueIndex >= VALUE_CONFIG.exceptional && legacyDecision.decision === 'NE PAS JOUER') {
            finalValueIndex = VALUE_CONFIG.correct;
        } else if (rawValueIndex >= VALUE_CONFIG.strong && legacyDecision.decision === 'SURVEILLER') {
            finalValueIndex = VALUE_CONFIG.correct + 0.1;
        }
    }

    const readability = options.readability || 'INCONNUE';
    const confidence = Number(options.confidence) || 0;

    if (readability === 'LOTERIE') {
        finalValueIndex = 0;
    } else if (readability === 'COMPLEXE') {
        finalValueIndex = finalValueIndex * 0.5;
    }

    if (finalValueIndex > 0 && (confidence < 6.0 && confidence > 0) && readability !== 'LISIBLE') {
        finalValueIndex = Math.min(finalValueIndex, VALUE_CONFIG.correct - 0.1);
    }

    finalValueIndex = Math.min(VALUE_CONFIG.maxValueCap, finalValueIndex);

    let label = 'Pas de value';
    let emoji = '⚪';
    let confidenceBonus = 0;
    let recommendedStake = VALUE_CONFIG.stakeNeutral;

    if (finalValueIndex >= VALUE_CONFIG.exceptional) {
        label = 'VALUE EXCEPTIONNELLE';
        emoji = '💎';
        confidenceBonus = VALUE_CONFIG.confidenceBonusExceptional;
        recommendedStake = VALUE_CONFIG.stakeExceptional;
    } else if (finalValueIndex >= VALUE_CONFIG.strong) {
        label = 'VALUE FORTE';
        emoji = '🔥';
        confidenceBonus = VALUE_CONFIG.confidenceBonusStrong;
        recommendedStake = VALUE_CONFIG.stakeStrong;
    } else if (finalValueIndex >= VALUE_CONFIG.correct) {
        label = 'VALUE CORRECTE';
        emoji = '✅';
        confidenceBonus = VALUE_CONFIG.confidenceBonusCorrect;
        recommendedStake = VALUE_CONFIG.stakeCorrect;
    } else if (finalValueIndex < VALUE_CONFIG.negative) {
        label = 'CHEVAL SURCOTE';
        emoji = '❌';
        confidenceBonus = VALUE_CONFIG.confidenceMalusNegative;
        recommendedStake = 0;
    }

    return {
        probabilite: Math.round(probability * 100),
        coteJuste: fairOdds,
        cotePMU: marketOdds,
        valueIndex: finalValueIndex,
        valueIndexBrut: rawValueIndex,
        valueV86: legacyValue,
        label,
        emoji,
        bonusConfiance: confidenceBonus,
        miseConseille: recommendedStake,
        readabilityApplied: readability
    };
}

function analyzeTopValues(rankedResults, validResults, options = {}) {
    const results = {};

    (rankedResults || []).slice(0, 5).forEach((runner) => {
        results[runner.numero] = analyzeRunnerValue(runner, validResults, options);
    });

    return results;
}

function computeIndependentScore(runner) {
    const stats = runner._mu || {};
    let score = 0;

    score += (stats.ratioForme || 0) * 40;
    score += Math.min((stats.serie || 0) * 6, 18);
    score += (stats.fiabilite || 0) * 10;

    const signal = runner._signalEquidia?.signal || 'NEUTRE';
    if (signal === 'TRES_POSITIF') score += 15;
    else if (signal === 'POSITIF') score += 8;
    else if (signal === 'NEGATIF') score -= 8;
    else if (signal === 'TRES_NEGATIF') score -= 15;

    const followers = runner.nombreSuiveurs || 0;
    if (followers >= 800) score += 12;
    else if (followers >= 400) score += 7;
    else if (followers >= 200) score += 3;

    const latest = stats.coursesVal?.slice(0, 2) || [];
    if (latest[0]?.position === 1) score += 15;
    else if (latest[0]?.position <= 2) score += 8;
    else if (latest[0]?.position <= 3) score += 4;

    score += tempoBonus(runner._tempo);
    score += (runner._reseau?.forceNorm || 0) * 1.5;
    score += (runner._croisements?.forceDirecte || 0) * 4;
    score += runner._biaisBonus || 0;
    score += runner._memoire?.bonus || 0;

    return Math.max(0, score);
}

function tempoBonus(tempo) {
    if (!tempo) return 0;
    if (tempo.tempo === 'MONTEE_FORTE') return 12;
    if (tempo.tempo === 'MONTEE_DOUCE') return 6;
    if (tempo.tempo === 'CHUTE_FORTE') return -10;
    if (tempo.tempo === 'CHUTE_DOUCE') return -5;
    return 0;
}

module.exports = {
    analyzeRunnerValue,
    analyzeTopValues,
    calculateLegacyValueBet,
    calculateMarketProbability,
    calculateRealProbability,
    decisionFromValue,
    estimateProbabilityFromMusic
};
