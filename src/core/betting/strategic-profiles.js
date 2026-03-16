'use strict';

const { marketProbabilityFromOdds, parseOdds } = require('../utils/odds');
const { ALGORITHM_CONFIG } = require('../config/algorithm');

function computeStrategicProfiles(resultats, predictionsCotes, options = {}) {
    const validRunners = (resultats || []).filter((runner) => runner && !runner._estTocard && !runner._excluFautif);
    const ratedRunners = validRunners.map((runner) => enrichRunner(runner, predictionsCotes, options));
    const readability = evaluateCourseReadability(ratedRunners);
    const thresholds = ALGORITHM_CONFIG.profileThresholds;

    const beton = readability.level > 0
        ? ratedRunners
        .filter((runner) => runner._fiabilite >= thresholds.beton.fiabilite && runner._score >= thresholds.beton.score)
        .filter((runner) => runner._cote >= thresholds.beton.minOdds && runner._cote <= thresholds.beton.maxOdds)
        .sort((left, right) => right._score - left._score)[0] || null
        : null;

    const pepite = readability.level >= 2
        ? ratedRunners
            .filter((runner) => isNotSameHorse(runner, beton))
            .filter((runner) => runner._cote >= thresholds.pepite.minOdds && runner._cote <= thresholds.pepite.maxOdds)
            .filter((runner) => runner._valueIdx >= thresholds.pepite.valueIndex && runner._fiabilite >= thresholds.pepite.fiabilite && runner._score >= thresholds.pepite.score && runner._aPodiumRecent && runner._aVictoireRecente)
            .filter((runner) => hasMarketOrFormSignal(runner))
            .sort((left, right) => computePepiteComposite(right) - computePepiteComposite(left))[0] || null
        : null;

    const sniper = readability.level >= 2
        ? ratedRunners
            .filter((runner) => isNotSameHorse(runner, beton) && isNotSameHorse(runner, pepite))
            .filter((runner) => runner._cote >= thresholds.sniper.minOdds && runner._cote <= thresholds.sniper.maxOdds)
            .filter((runner) => runner._score >= thresholds.sniper.score && runner._fiabilite >= thresholds.sniper.fiabilite && runner._aPodiumRecent && runner._aVictoireRecente)
            .filter((runner) => hasMarketOrFormSignal(runner))
            .sort((left, right) => computeSniperComposite(right) - computeSniperComposite(left))[0] || null
        : null;

    const braquage = readability.level >= 2
        ? ratedRunners
        .filter((runner) => isNotSameHorse(runner, beton) && isNotSameHorse(runner, pepite) && isNotSameHorse(runner, sniper))
        .filter((runner) => runner._cote >= thresholds.braquage.minOdds && runner._cote <= thresholds.braquage.maxOdds)
        .filter((runner) => runner._valueIdx >= thresholds.braquage.valueIndex && runner._score >= thresholds.braquage.score && runner._fiabilite >= thresholds.braquage.fiabilite && (runner._aVictoireRecente || runner._signalSuiveur) && runner._aPodiumRecent)
        .filter((runner) => hasMarketOrFormSignal(runner))
        .sort((left, right) => computeBraquageComposite(right) - computeBraquageComposite(left))[0] || null
        : null;

    const outsiderCount = [pepite, sniper, braquage].filter(Boolean).length;
    let selectedOutsider = null;
    if (outsiderCount > 1) {
        const outsiderCandidates = [
            pepite ? { profile: 'pepite', runner: pepite, composite: computePepiteComposite(pepite) } : null,
            sniper ? { profile: 'sniper', runner: sniper, composite: computeSniperComposite(sniper) } : null,
            braquage ? { profile: 'braquage', runner: braquage, composite: computeBraquageComposite(braquage) } : null
        ].filter(Boolean).sort((a, b) => b.composite - a.composite);
        selectedOutsider = outsiderCandidates[0];
    }

    const finalPepite = selectedOutsider ? (selectedOutsider.profile === 'pepite' ? pepite : null) : pepite;
    const finalSniper = selectedOutsider ? (selectedOutsider.profile === 'sniper' ? sniper : null) : sniper;
    const finalBraquage = selectedOutsider ? (selectedOutsider.profile === 'braquage' ? braquage : null) : braquage;

    return {
        beton,
        pepite: finalPepite,
        sniper: finalSniper,
        braquage: finalBraquage,
        lisibilite: readability.label,
        nbChevauxFiables: readability.reliableRunnerCount,
        niveauDiff: readability.level,
        outsiderLimite: outsiderCount > 1
    };
}

function hasMarketOrFormSignal(runner) {
    const hasOddsMovement = runner._signalSuiveur || (runner.nombreSuiveurs || 0) >= 200;
    const hasFormSignal = runner._aVictoireRecente
        || (runner._mu?.trend >= 2)
        || (runner._mu?.serie >= 2);
    return hasOddsMovement || hasFormSignal;
}

function evaluateCourseReadability(runners) {
    const reliableRunnerCount = runners.filter((runner) => runner._fiabilite >= 0.58).length;
    const sorted = [...runners].sort((left, right) => right._score - left._score);
    const top3 = sorted.slice(0, 3);
    const topReliabilityAverage = top3.length > 0
        ? top3.reduce((sum, runner) => sum + (runner._fiabilite || 0), 0) / top3.length
        : 0;
    const topGap = top3.length >= 2 ? (top3[0]._score || 0) - (top3[1]._score || 0) : 0;
    const top3Gap = top3.length >= 3 ? (top3[0]._score || 0) - (top3[2]._score || 0) : topGap;

    if (reliableRunnerCount >= 3 && topReliabilityAverage >= 0.68 && topGap >= 6 && top3Gap >= 12) {
        return {
            label: 'LISIBLE',
            level: 2,
            reliableRunnerCount
        };
    }

    if (reliableRunnerCount >= 2 && topReliabilityAverage >= 0.55 && topGap >= 2) {
        return {
            label: 'COMPLEXE',
            level: 1,
            reliableRunnerCount
        };
    }

    return {
        label: 'LOTERIE',
        level: 0,
        reliableRunnerCount
    };
}

function enrichRunner(runner, predictionsCotes, options) {
    const odds = predictionsCotes?.[runner.numero]?.coteEstimee
        || runner.coteTempsReel
        || parseOdds(runner.cote)
        || 0;
    const score = runner._scoreAlgo || runner.score || 0;
    const fiabilite = runner._mu?.fiabilite || runner.fiabilite || 0;
    const podiumRecent = Boolean(runner._mu?.coursesVal?.slice(0, 5).some((race) => race.position <= 3));
    const victoireRecente = Boolean(runner._mu?.coursesVal?.slice(0, 4).some((race) => race.position === 1));
    const signalSuiveur = (runner.nombreSuiveurs || 0) >= (options.minSuiveursSignal || 100);
    const valueIndex = computeValueIndex(runner, odds, options.resultatsValides || []);

    return {
        ...runner,
        _cote: odds,
        _score: score,
        _fiabilite: fiabilite,
        _aPodiumRecent: podiumRecent,
        _aVictoireRecente: victoireRecente,
        _signalSuiveur: signalSuiveur,
        _valueIdx: valueIndex
    };
}

function computeValueIndex(runner, odds, resultatsValides) {
    if (!odds || odds <= 0) {
        return 0;
    }

    const marketProbability = marketProbabilityFromOdds(odds) / 1.15;
    if (marketProbability <= 0) {
        return 0;
    }

    const scores = (resultatsValides.length > 0 ? resultatsValides : [runner])
        .filter((item) => item && !item._estTocard)
        .map((item) => ({
            numero: item.numero,
            score: Math.max(0.01, item._scoreAlgo || item.score || 0.01)
        }));

    const totalScore = scores.reduce((sum, item) => sum + item.score, 0) || 1;
    const targetScore = scores.find((item) => item.numero === runner.numero)?.score || Math.max(0.01, runner._scoreAlgo || runner.score || 0.01);
    const realProbability = Math.min(0.35, Math.max(0.02, targetScore / totalScore));

    return Math.min(5, Number((realProbability / marketProbability).toFixed(2)));
}

function computePepiteComposite(runner) {
    return runner._valueIdx * 14 + runner._score * 0.25 + runner._fiabilite * 18 + (runner._aVictoireRecente ? 18 : 0);
}

function computeSniperComposite(runner) {
    return runner._score * 0.7 + runner._fiabilite * 28 + (runner._aVictoireRecente ? 18 : 0) + (runner._signalSuiveur ? 8 : 0);
}

function computeBraquageComposite(runner) {
    return runner._valueIdx * 10 + runner._score * 0.2 + runner._fiabilite * 18 + (runner._aVictoireRecente ? 22 : 0) + ((runner.nombreSuiveurs || 0) * 0.05);
}

function isNotSameHorse(left, right) {
    return !right || String(left.numero) !== String(right.numero);
}

module.exports = {
    computeStrategicProfiles,
    evaluateCourseReadability
};
