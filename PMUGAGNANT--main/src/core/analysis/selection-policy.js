'use strict';

const { ALGORITHM_CONFIG } = require('../config/algorithm');

function resolveOperationalSelection(analysis) {
    if (!analysis) {
        return null;
    }

    const calibration = getHippodromeCalibration(analysis.courseInfo?.hippodrome);
    const confidence = Math.max(0, (Number(analysis.scoreConfiance?.score) || 0) + calibration.confidence);
    const pilotage = Math.max(0, (Number(analysis.pilotage?.score) || 0) + calibration.pilotage);
    const readability = analysis.profils?.lisibilite || 'INCONNUE';
    const qualite = Number(analysis.pilotage?.score) || 0;

    if (!analysis.recommandation?.vautLeCoup || readability === 'LOTERIE') {
        return null;
    }

    if (confidence < ALGORITHM_CONFIG.confidenceMinimum || pilotage < ALGORITHM_CONFIG.pilotageMinimum) {
        return null;
    }

    if (qualite < (ALGORITHM_CONFIG.qualiteMinimum || 70)) {
        return null;
    }

    const readabilityCoefficient = readability === 'LISIBLE' ? 1.0 : readability === 'COMPLEXE' ? 0.6 : 0;

    const beton = analysis.profils?.beton;
    if (beton) {
        const rawValueIndex = getRunnerValueIndex(analysis, beton.numero);
        const valueIndex = applyValueReadability(rawValueIndex, readability);
        if (valueIndex >= ALGORITHM_CONFIG.valueMinimum) {
            return {
                profile: 'beton',
                runner: beton,
                valueIndex,
                readabilityCoefficient,
                calibration
            };
        }
    }

    if (calibration.allowOnlyBeton) {
        return null;
    }

    const pepite = analysis.profils?.pepite;
    if (pepite) {
        const rawValueIndex = getRunnerValueIndex(analysis, pepite.numero);
        const valueIndex = applyValueReadability(rawValueIndex, readability);
        if (readability === 'LISIBLE' && confidence >= 7.5 && pilotage >= 56 && valueIndex >= 1.8) {
            return {
                profile: 'pepite',
                runner: pepite,
                valueIndex,
                readabilityCoefficient,
                calibration
            };
        }
    }

    const sniper = analysis.profils?.sniper;
    if (sniper) {
        const rawValueIndex = getRunnerValueIndex(analysis, sniper.numero);
        const valueIndex = applyValueReadability(rawValueIndex, readability);
        if (readability === 'LISIBLE' && confidence >= 7.8 && pilotage >= 58 && valueIndex >= 1.35) {
            return {
                profile: 'sniper',
                runner: sniper,
                valueIndex,
                readabilityCoefficient,
                calibration
            };
        }
    }

    return null;
}

function applyValueReadability(valueIndex, readability) {
    if (readability === 'LOTERIE') return 0;
    if (readability === 'COMPLEXE') return valueIndex * 0.5;
    return Math.min(5.0, valueIndex);
}

function resolveWatchSelection(analysis) {
    if (!analysis) {
        return null;
    }

    const calibration = getHippodromeCalibration(analysis.courseInfo?.hippodrome);
    const confidence = Math.max(0, (Number(analysis.scoreConfiance?.score) || 0) + calibration.confidence);
    const pilotage = Math.max(0, (Number(analysis.pilotage?.score) || 0) + calibration.pilotage);
    const readability = analysis.profils?.lisibilite || 'INCONNUE';

    if (!analysis.recommandation?.vautLeCoup || readability === 'LOTERIE') {
        return null;
    }

    if (confidence < Math.max(5.0, ALGORITHM_CONFIG.confidenceMinimum - 1.0)) {
        return null;
    }

    if (pilotage < Math.max(40, ALGORITHM_CONFIG.pilotageMinimum - 8)) {
        return null;
    }

    const preferredRunner = analysis.profils?.beton
        || analysis.profils?.pepite
        || analysis.profils?.sniper
        || analysis.favori;

    if (!preferredRunner) {
        return null;
    }

    const valueIndex = getRunnerValueIndex(analysis, preferredRunner.numero);
    const profile = analysis.profils?.beton && preferredRunner.numero === analysis.profils.beton.numero
        ? 'beton_watch'
        : analysis.profils?.pepite && preferredRunner.numero === analysis.profils.pepite.numero
            ? 'pepite_watch'
            : analysis.profils?.sniper && preferredRunner.numero === analysis.profils.sniper.numero
                ? 'sniper_watch'
                : 'favori_watch';

    return {
        profile,
        runner: preferredRunner,
        valueIndex,
        calibration,
        reason: readability === 'COMPLEXE' ? 'course_complexe' : 'validation_incomplete'
    };
}

function getRunnerValueIndex(analysis, numero) {
    return Number(analysis.valueTop5?.[numero]?.valueIndex) || 0;
}

function getHippodromeCalibration(hippodrome) {
    const normalized = String(hippodrome || '').trim().toUpperCase();
    const positive = ALGORITHM_CONFIG.hippodromeCalibration?.positive?.[normalized] || null;
    const negative = ALGORITHM_CONFIG.hippodromeCalibration?.negative?.[normalized] || null;
    const source = negative || positive || {};

    return {
        confidence: Number(source.confidence) || 0,
        pilotage: Number(source.pilotage) || 0,
        allowOnlyBeton: Boolean(source.allowOnlyBeton)
    };
}

module.exports = {
    applyValueReadability,
    getHippodromeCalibration,
    getRunnerValueIndex,
    resolveOperationalSelection,
    resolveWatchSelection
};
