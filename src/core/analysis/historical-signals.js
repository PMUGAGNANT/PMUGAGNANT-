'use strict';

function attachHistoricalSignals(participants = [], historiesByHorse = {}, networkByHorse = {}) {
    return (participants || []).map((participant) => {
        const history = historiesByHorse?.[participant.numPmu] || [];
        const network = networkByHorse?.[participant.numPmu] || networkByHorse?.[participant.nom] || {};
        const recentHistory = Array.isArray(history) ? history.slice(-5) : [];
        const positiveHistory = recentHistory.filter((entry) => Number(entry?.ordreArrivee || entry?.position || 99) <= 3).length;

        return {
            ...participant,
            _memoire: {
                bonus: positiveHistory >= 2 ? 1 : 0,
                notes: positiveHistory >= 2 ? ['Historique recent favorable'] : []
            },
            _reseau: {
                forceNorm: Number(network.forceNorm || network.force || 0) || 0,
                bonus: Number(network.bonus || 0) || 0
            },
            _croisements: {
                forceDirecte: Number(network.forceDirecte || 0) || 0,
                bonus: Number(network.crossBonus || 0) || 0
            }
        };
    });
}

module.exports = {
    attachHistoricalSignals
};
