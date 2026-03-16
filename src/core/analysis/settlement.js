'use strict';

const { ALGORITHM_CONFIG } = require('../config/algorithm');
const { parseOdds } = require('../utils/odds');

function buildOperationalBetPlan(analysis, selection) {
    const score = Number(analysis.scoreConfiance?.score) || 0;
    const valueIndex = Number(selection?.valueIndex) || 0;
    const levels = ALGORITHM_CONFIG.confidenceStakeLevels;
    const targetRunner = selection?.runner || analysis.favori;
    const targetOdds = parseOdds(targetRunner.coteTempsReel || targetRunner.cote || targetRunner._cote) || 0;

    if (selection?.profile === 'pepite' || selection?.profile === 'sniper' || selection?.profile === 'braquage') {
        return { type: 'Place', stake: 1, odds: targetOdds, outsiderForcePlace: true };
    }

    if (score >= levels.veryHigh.threshold && valueIndex >= 1.2) {
        return { type: levels.veryHigh.type, stake: levels.veryHigh.stake, odds: targetOdds };
    }

    if (score >= levels.high.threshold) {
        return { type: levels.high.type, stake: levels.high.stake, odds: targetOdds };
    }

    if (score >= levels.medium.threshold) {
        return { type: levels.medium.type, stake: levels.medium.stake, odds: targetOdds };
    }

    return { type: 'Place', stake: 1, odds: targetOdds };
}

function settleSelection(plan, selection, arrivals = []) {
    const targetNumber = String(selection?.runner?.numero || '');
    if (!plan?.odds || !plan?.stake || !targetNumber) {
        return {
            result: 'INCONNU',
            profit: 0,
            won: false,
            placed: false
        };
    }

    const placedNumbers = new Set((arrivals || []).filter((participant) => Number(participant.ordreArrivee) > 0 && Number(participant.ordreArrivee) <= 3).map((participant) => String(participant.numPmu)));
    const winnerNumber = String((arrivals || []).find((participant) => Number(participant.ordreArrivee) === 1)?.numPmu || '');

    if (String(plan.type || '').toLowerCase().includes('gagnant')) {
        const won = targetNumber === winnerNumber;
        return {
            result: won ? 'GAGNANT' : 'PERDU',
            profit: won ? round2(plan.stake * plan.odds - plan.stake) : -plan.stake,
            won,
            placed: won
        };
    }

    const placed = placedNumbers.has(targetNumber);
    const placeOdds = Math.max(1.1, plan.odds * 0.3);
    return {
        result: placed ? 'PLACE' : 'PERDU',
        profit: placed ? round2(plan.stake * placeOdds - plan.stake) : -plan.stake,
        won: targetNumber === winnerNumber,
        placed
    };
}

function round2(value) {
    return Math.round((value || 0) * 100) / 100;
}

module.exports = {
    buildOperationalBetPlan,
    settleSelection
};
