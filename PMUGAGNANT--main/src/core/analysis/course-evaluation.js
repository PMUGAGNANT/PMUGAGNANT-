'use strict';

const { ALGORITHM_CONFIG } = require('../config/algorithm');

function analyzeFavoriteSolidity(favori, scored = [], options = {}) {
    const rival = [...(scored || [])]
        .filter((runner) => String(runner.numero) !== String(favori?.numero))
        .sort((left, right) => (right.score || 0) - (left.score || 0))[0] || null;
    const score = Number(favori?._scoreAlgo || favori?.score || 0);
    const gap = score - Number(rival?.score || 0);
    const fiabilite = Number(favori?._mu?.fiabilite || 0);
    const nombrePartants = Number(options.nombrePartants || scored.length || 0);

    const solidite = Math.max(0, Math.min(100,
        Math.round((score * 0.8) + (gap * 3) + (fiabilite * 20) - Math.max(0, nombrePartants - 14))
    ));

    return {
        score: solidite,
        gapScore: gap,
        fiabilite,
        fragile: solidite < ALGORITHM_CONFIG.fragileFavoriteThreshold
    };
}

function predictFinalOdds(runner, scored = [], runnerScore = 0, estQuinte = false) {
    const totalScore = (scored || []).reduce((sum, item) => sum + Math.max(1, Number(item._scoreAlgo || item.score || 0)), 0) || 1;
    const probability = Math.max(0.02, Math.min(estQuinte ? 0.28 : 0.35, Math.max(1, runnerScore) / totalScore));
    const coteEstimee = round2(1 / probability);
    const coteMatin = toNumber(runner.coteTempsReel || runner.cote) || coteEstimee;

    return {
        probabilite: Math.round(probability * 100),
        coteEstimee,
        coteMatin,
        coteFinaleProjete: coteEstimee
    };
}

function buildRecommendation(soliditeFavori, favori, predictedOdds, alternativeText = null) {
    const recommendations = ALGORITHM_CONFIG.recommendations;
    const score = Number(soliditeFavori?.score || 0);
    const odds = Number(predictedOdds?.coteEstimee || favori?.coteTempsReel || favori?.cote || 99);

    if (score >= 72 && odds <= 8) {
        return {
            ...recommendations.playFavorite,
            vautLeCoup: true,
            decision: 'VALIDE',
            raisonnement: ['Favori solide', `Cote estimee ${odds}`]
        };
    }

    if (score >= 58 && odds <= 12) {
        return {
            ...recommendations.favoriteWithCaution,
            vautLeCoup: true,
            decision: 'SURVEILLANCE',
            raisonnement: ['Signal jouable mais moins net']
        };
    }

    if (alternativeText) {
        return {
            ...recommendations.playAlternative,
            vautLeCoup: true,
            decision: 'SURVEILLANCE',
            raisonnement: [alternativeText]
        };
    }

    return {
        ...recommendations.avoidRace,
        vautLeCoup: false,
        decision: 'REJET',
        raisonnement: ['Course insuffisamment fiable']
    };
}

function computeConfidenceScore(context = {}) {
    const factors = [];
    let score = 4.5;
    const solidite = Number(context.solidite?.score || 0);
    const prediction = context.predictionsCotes?.[context.cheval?.numero];

    score += Math.min(3.2, solidite / 25);
    if (solidite >= 70) {
        factors.push('Favori solide');
    }

    if (context.recommendation?.vautLeCoup) {
        score += 1.2;
        factors.push('Recommendation positive');
    }

    if ((context.mouvementsCotes?.alertes || []).length > 0) {
        score -= 0.3;
        factors.push('Marche agite');
    }

    if (prediction?.coteEstimee && prediction.coteEstimee <= 8) {
        score += 0.6;
        factors.push('Cote projetee jouable');
    }

    if ((context.top5 || []).length >= 3) {
        score += 0.4;
    }

    score = Math.max(0, Math.min(10, score));

    return {
        score: round1(score),
        facteurs: factors,
        niveau: getConfidenceLevel(score)
    };
}

function getConfidenceLevel(score) {
    if (score >= 8.5) return 'TRES_ELEVE';
    if (score >= 7) return 'ELEVE';
    if (score >= 5.5) return 'MOYEN';
    return 'FAIBLE';
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function round1(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
}

function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

module.exports = {
    analyzeFavoriteSolidity,
    buildRecommendation,
    computeConfidenceScore,
    getConfidenceLevel,
    predictFinalOdds
};
