'use strict';

const { classifyTempo } = require('../horse/music');

function enrichParticipants(participants = [], options = {}) {
    return (participants || []).map((participant) => {
        const tempo = classifyTempo(participant._mu || null);
        const bias = computeBiasBonus(participant, options.biaisPiste);

        return {
            ...participant,
            _tempo: tempo,
            _biaisBonus: bias,
            _croisements: participant._croisements || { forceDirecte: 0, bonus: 0 },
            _reseau: participant._reseau || { forceNorm: 0, bonus: 0 },
            _memoire: participant._memoire || { bonus: 0, notes: [] }
        };
    });
}

function detectOddsMovements(participants = [], realtimeOdds = {}) {
    const alertes = [];
    const signaux = [];

    (participants || []).forEach((participant) => {
        const baseOdds = toNumber(participant.cote);
        const liveOdds = toNumber(realtimeOdds?.[participant.numPmu] ?? participant.coteTempsReel);
        if (!baseOdds || !liveOdds || baseOdds <= 0) {
            return;
        }

        const variation = Math.round(((liveOdds - baseOdds) / baseOdds) * 100);
        if (Math.abs(variation) < 10) {
            return;
        }

        const movement = {
            numero: participant.numPmu,
            nom: participant.nom || '',
            coteMatin: baseOdds,
            coteActuelle: liveOdds,
            variationPct: variation,
            variation
        };

        if (variation <= -20) {
            alertes.push({
                ...movement,
                message: `N${participant.numPmu} en forte baisse (${variation}%)`
            });
            signaux.push({
                type: 'FORTE_BAISSE',
                numero: participant.numPmu,
                variation,
                message: `Signal acheteur sur N${participant.numPmu}`
            });
        } else if (variation >= 30) {
            alertes.push({
                ...movement,
                message: `N${participant.numPmu} en forte hausse (+${variation}%)`
            });
            signaux.push({
                type: 'FORTE_HAUSSE',
                numero: participant.numPmu,
                variation,
                message: `Desengagement marche sur N${participant.numPmu}`
            });
        }
    });

    return { alertes, signaux };
}

function inferTrackBias(samples = []) {
    if (!Array.isArray(samples) || samples.length === 0) {
        return null;
    }

    return {
        source: 'history',
        strength: Math.min(1, samples.length / 20)
    };
}

function applyTrackBiasToConfidence(scoreConfiance, favori, biaisPiste) {
    const next = {
        ...(scoreConfiance || {}),
        facteurs: [...(scoreConfiance?.facteurs || [])]
    };

    const biasStrength = Number(biaisPiste?.strength || 0);
    if (biasStrength > 0 && favori?.placeCorde && favori.placeCorde <= 3) {
        next.score = Math.min(10, (Number(next.score) || 0) + 0.3 * biasStrength);
        next.facteurs.push('Biais piste favorable');
    }

    next.score = Math.round((Number(next.score) || 0) * 10) / 10;
    return next;
}

function computeBiasBonus(participant, biaisPiste) {
    const strength = Number(biaisPiste?.strength || 0);
    if (!strength) {
        return 0;
    }

    const stall = Number(participant.placeCorde || participant.stalle || participant.numPmu || 99);
    if (stall <= 3) {
        return Math.round(strength * 10) / 10;
    }

    if (stall >= 10) {
        return Math.round(-strength * 10) / 10;
    }

    return 0;
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

module.exports = {
    applyTrackBiasToConfidence,
    detectOddsMovements,
    enrichParticipants,
    inferTrackBias
};
