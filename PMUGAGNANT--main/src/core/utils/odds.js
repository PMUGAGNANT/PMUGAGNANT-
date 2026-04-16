'use strict';

const DEFAULT_OVERROUND = 0.15;
const MAX_REASONABLE_ODDS = 999;

function parseOdds(value) {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'number') {
        return normalizeOdds(value);
    }

    if (typeof value === 'string') {
        const normalized = normalizeOddsString(value);
        if (!normalized) {
            return null;
        }

        return normalizeOdds(Number(normalized));
    }

    if (typeof value === 'object') {
        const directCandidate = value.cote ?? value.odds ?? value.value ?? value.pmU ?? value.pmu;
        if (directCandidate !== undefined) {
            return parseOdds(directCandidate);
        }
    }

    return null;
}

function marketProbabilityFromOdds(odds, marketMargin = DEFAULT_OVERROUND) {
    const normalizedOdds = parseOdds(odds);
    if (!normalizedOdds) {
        return 0;
    }

    const safeMargin = normalizeMargin(marketMargin);
    return (1 / normalizedOdds) * (1 + safeMargin);
}

function calculateFairOdds(probability, marketMargin = DEFAULT_OVERROUND) {
    const normalizedProbability = normalizeProbability(probability);
    if (!normalizedProbability) {
        return null;
    }

    const safeMargin = normalizeMargin(marketMargin);
    const adjustedProbability = normalizedProbability * (1 + safeMargin);

    return round2(1 / Math.min(0.999, adjustedProbability));
}

function calculateValueIndex(marketOdds, fairOdds) {
    const normalizedMarketOdds = parseOdds(marketOdds);
    const normalizedFairOdds = parseOdds(fairOdds);
    if (!normalizedMarketOdds || !normalizedFairOdds) {
        return 0;
    }

    return round2(normalizedMarketOdds / normalizedFairOdds);
}

function normalizeOdds(value) {
    if (!Number.isFinite(value) || value <= 0) {
        return null;
    }

    const rounded = round2(value);
    if (rounded < 1.01 || rounded > MAX_REASONABLE_ODDS) {
        return null;
    }

    return rounded;
}

function normalizeOddsString(value) {
    const compactValue = String(value).trim().toLowerCase();
    if (!compactValue) {
        return null;
    }

    const sanitized = compactValue
        .replace(/,/g, '.')
        .replace(/\s+/g, '')
        .replace(/(?:€|eur|x|cote|odds|pmu)/g, '');
    const match = sanitized.match(/-?\d+(?:\.\d+)?/);
    return match ? match[0] : null;
}

function normalizeProbability(value) {
    const numericProbability = Number(value);
    if (!Number.isFinite(numericProbability) || numericProbability <= 0) {
        return null;
    }

    return Math.min(0.999, numericProbability);
}

function normalizeMargin(value) {
    const numericMargin = Number(value);
    if (!Number.isFinite(numericMargin)) {
        return DEFAULT_OVERROUND;
    }

    return Math.max(0, Math.min(1, numericMargin));
}

function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

module.exports = {
    calculateFairOdds,
    calculateValueIndex,
    marketProbabilityFromOdds,
    parseOdds
};
