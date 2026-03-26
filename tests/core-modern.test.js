'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseMusic, shouldRejectAsTocard } = require('../src/core/horse/music');
const { analyzeRunnerValue, estimateProbabilityFromMusic } = require('../src/core/betting/value');
const { getHippodromeCalibration, resolveOperationalSelection, resolveWatchSelection } = require('../src/core/analysis/selection-policy');
const { buildOperationalBetPlan, settleSelection } = require('../src/core/analysis/settlement');
const { calculateFairOdds, calculateValueIndex, marketProbabilityFromOdds, parseOdds } = require('../src/core/utils/odds');

test('parseMusic parse correctement la musique et les incidents', () => {
    const stats = parseMusic('1a2aDa0a5a');

    assert.equal(stats.nbVictoires, 1);
    assert.equal(stats.nbPodiums, 2);
    assert.equal(stats.nbDQ, 1);
    assert.equal(stats.nbAbandons, 1);
    assert.equal(stats.total, 5);
    assert.equal(stats.nbTerminees, 3);
    assert.equal(stats.fiabilite, 0.6);
    assert.equal(stats.avgPos, (1 + 2 + 5) / 3);
});

test('shouldRejectAsTocard protege un cheval solide et rejette un profil trop faible', () => {
    const protectedHorse = shouldRejectAsTocard(
        { musique: '1a2a1a3a2a', cote: 18 },
        parseMusic('1a2a1a3a2a')
    );
    const rejectedHorse = shouldRejectAsTocard(
        { musique: '0aDa0a10a10a10a10a10a10a', cote: 55 },
        parseMusic('0aDa0a10a10a10a10a10a10a')
    );

    assert.equal(protectedHorse.reject, false);
    assert.equal(protectedHorse.protected, true);
    assert.equal(rejectedHorse.reject, true);
    assert.ok(rejectedHorse.reasons.length >= 2);
});

test('estimateProbabilityFromMusic et analyzeRunnerValue distinguent un cheval de value d un cheval surcote', () => {
    const strongMusic = parseMusic('1a1a1a2a2a');
    const weakMusic = parseMusic('7a8a9aDa0a');

    const strongProbability = estimateProbabilityFromMusic(strongMusic, 62);
    const weakProbability = estimateProbabilityFromMusic(weakMusic, 18);
    assert.ok(strongProbability > weakProbability);

    const valueRunner = {
        numero: 1,
        nom: 'Alpha',
        musique: '1a1a1a2a2a',
        cote: 8.5,
        coteTempsReel: 8.5,
        _scoreAlgo: 62,
        _mu: strongMusic,
        nombreSuiveurs: 900,
        _tempo: { tempo: 'MONTEE_FORTE' },
        _reseau: { forceNorm: 4 },
        _croisements: { forceDirecte: 1 },
        _memoire: { bonus: 1 }
    };
    const weakRunner = {
        numero: 2,
        nom: 'Bravo',
        musique: '7a8a9aDa0a',
        cote: 2.2,
        coteTempsReel: 2.2,
        _scoreAlgo: 18,
        _mu: weakMusic,
        nombreSuiveurs: 40,
        _tempo: { tempo: 'CHUTE_FORTE' },
        _reseau: { forceNorm: 0 },
        _croisements: { forceDirecte: 0 },
        _memoire: { bonus: 0 }
    };
    const validResults = [
        { ...valueRunner, _estTocard: false, numero: 1 },
        { ...weakRunner, _estTocard: false, numero: 2 },
        {
            numero: 3,
            nom: 'Charlie',
            musique: '3a4a3a5a4a',
            cote: 5.5,
            coteTempsReel: 5.5,
            _scoreAlgo: 32,
            _mu: parseMusic('3a4a3a5a4a'),
            nombreSuiveurs: 180,
            _tempo: { tempo: 'NEUTRE' },
            _reseau: { forceNorm: 1 },
            _croisements: { forceDirecte: 0 },
            _memoire: { bonus: 0 },
            _estTocard: false
        }
    ];

    const valueAnalysis = analyzeRunnerValue(valueRunner, validResults);
    const weakAnalysis = analyzeRunnerValue(weakRunner, validResults);

    assert.ok(valueAnalysis.valueIndex > 1.6);
    assert.ok(valueAnalysis.bonusConfiance > 0);
    assert.ok(weakAnalysis.valueIndex < 0.8);
    assert.equal(weakAnalysis.label, 'CHEVAL SURCOTE');
});

test('resolveOperationalSelection applique la calibration hippodrome et privilegie Beton', () => {
    const positiveCalibration = getHippodromeCalibration("HIPPODROME D'ENGHIEN SOISY");
    const negativeCalibration = getHippodromeCalibration('HIPPODROME DE PARIS-VINCENNES');

    assert.equal(positiveCalibration.pilotage, 3);
    assert.equal(negativeCalibration.allowOnlyBeton, true);

    const beton = { numero: 4, nom: 'Delta', cote: 4.2 };
    const analysis = {
        courseInfo: { hippodrome: "HIPPODROME D'ENGHIEN SOISY" },
        scoreConfiance: { score: 6.5 },
        pilotage: { score: 72 },
        profils: {
            lisibilite: 'LISIBLE',
            beton
        },
        valueTop5: {
            4: { valueIndex: 1.25 }
        },
        recommandation: {
            vautLeCoup: true
        }
    };

    const selection = resolveOperationalSelection(analysis);
    assert.equal(selection.profile, 'beton');
    assert.equal(selection.runner.numero, 4);

    const vincennesAnalysis = {
        courseInfo: { hippodrome: 'HIPPODROME DE PARIS-VINCENNES' },
        scoreConfiance: { score: 8.6 },
        pilotage: { score: 75 },
        profils: {
            lisibilite: 'LISIBLE',
            beton: null,
            pepite: { numero: 7, nom: 'Pepite' }
        },
        valueTop5: {
            7: { valueIndex: 2.4 }
        },
        recommandation: {
            vautLeCoup: true
        }
    };

    assert.equal(resolveOperationalSelection(vincennesAnalysis), null);
});

test('resolveWatchSelection remonte une course a surveiller proche du seuil final', () => {
    const analysis = {
        courseInfo: { hippodrome: 'HIPPODROME DE LAVAL' },
        favori: { numero: 5, nom: 'Kristal', cote: 12 },
        scoreConfiance: { score: 6.9 },
        pilotage: { score: 73 },
        profils: {
            lisibilite: 'COMPLEXE'
        },
        valueTop5: {
            5: { valueIndex: 1.95 }
        },
        recommandation: {
            vautLeCoup: true
        }
    };

    const watchSelection = resolveWatchSelection(analysis);
    assert.equal(watchSelection.profile, 'favori_watch');
    assert.equal(watchSelection.runner.numero, 5);
    assert.equal(watchSelection.valueIndex, 1.95);
});

test('buildOperationalBetPlan et settleSelection reglent correctement les paris gagnant et place', () => {
    const betonSelection = {
        profile: 'beton',
        valueIndex: 1.3,
        runner: {
            numero: 5,
            coteTempsReel: 4.0
        }
    };
    const highConfidenceAnalysis = {
        scoreConfiance: { score: 8.7 },
        favori: {
            numero: 5,
            coteTempsReel: 4.0
        }
    };

    const winningPlan = buildOperationalBetPlan(highConfidenceAnalysis, betonSelection);
    assert.deepEqual(winningPlan, { type: 'Gagnant simple', stake: 4, odds: 4 });

    const winningSettlement = settleSelection(
        winningPlan,
        betonSelection,
        [{ numPmu: 5, ordreArrivee: 1 }, { numPmu: 2, ordreArrivee: 2 }, { numPmu: 8, ordreArrivee: 3 }]
    );
    assert.equal(winningSettlement.result, 'GAGNANT');
    assert.equal(winningSettlement.profit, 12);

    const pepiteSelection = {
        profile: 'pepite',
        valueIndex: 2.1,
        runner: {
            numero: 8,
            coteTempsReel: 10
        }
    };
    const placePlan = buildOperationalBetPlan({ scoreConfiance: { score: 7.2 }, favori: pepiteSelection.runner }, pepiteSelection);
    assert.equal(placePlan.type, 'Place');
    assert.equal(placePlan.stake, 1);
    assert.equal(placePlan.odds, 10);

    const placeSettlement = settleSelection(
        placePlan,
        pepiteSelection,
        [{ numPmu: 2, ordreArrivee: 1 }, { numPmu: 8, ordreArrivee: 2 }, { numPmu: 4, ordreArrivee: 3 }]
    );
    assert.equal(placeSettlement.result, 'PLACE');
    assert.equal(placeSettlement.profit, 2);
});

test('parseOdds et les calculs de cotes gerent les formats PMU courants et les entrees invalides', () => {
    assert.equal(parseOdds(4.25), 4.25);
    assert.equal(parseOdds(' 4,25 '), 4.25);
    assert.equal(parseOdds('PMU 12,5'), 12.5);
    assert.equal(parseOdds('cote 0'), null);
    assert.equal(parseOdds(null), null);
    assert.equal(parseOdds('abc'), null);

    assert.equal(calculateFairOdds(0.2, 0), 5);
    assert.equal(calculateValueIndex(10, 5), 2);
    assert.ok(marketProbabilityFromOdds('4,0') > 0.25);
});
