'use strict';

const { ALGORITHM_CONFIG } = require('../config/algorithm');
const { parseMusic, shouldRejectAsTocard } = require('../horse/music');
const { computeStrategicProfiles } = require('../betting/strategic-profiles');
const { analyzeTopValues } = require('../betting/value');
const { attachHistoricalSignals } = require('./historical-signals');
const { buildAnalysisPilotage } = require('./scan-summary');
const { applyTrackBiasToConfidence, enrichParticipants } = require('./enrichments');
const { scoreRunner } = require('./scoring');
const {
    analyzeFavoriteSolidity,
    buildRecommendation,
    computeConfidenceScore,
    getConfidenceLevel,
    predictFinalOdds
} = require('./course-evaluation');

async function analyzeCourse(courseInfo, participants, options = {}) {
    if (!participants || participants.length < 3) {
        return null;
    }

    const participantsWithHistory = attachHistoricalSignals(
        participants,
        options.historiesByHorse || {},
        options.networkByHorse || {}
    );

    const preparedParticipants = enrichParticipants(
        participantsWithHistory.map((participant) => ({
            ...participant,
            _mu: parseMusic(participant.musique || '')
        })),
        {
            biaisPiste: options.biaisPiste || null
        }
    );

    const scored = preparedParticipants.map((participant) => {
        const music = parseMusic(participant.musique || '');
        const tocard = shouldRejectAsTocard(participant, music);
        const scoring = scoreRunner(
            { ...participant, _mu: music },
            {
                estPlat: Boolean(courseInfo.estPlat),
                allParticipants: participants
            }
        );

        return {
            numero: participant.numPmu,
            nom: participant.nom,
            driver: participant.driver || '',
            jockey: participant.jockey || '',
            entraineur: participant.entraineur || '',
            musique: participant.musique || '',
            cote: participant.cote || null,
            coteTempsReel: participant.coteTempsReel || null,
            nombreSuiveurs: participant.nombreSuiveurs || 0,
            numPmu: participant.numPmu,
            ...scoring,
            _scoreAlgo: scoring.score,
            _estTocard: tocard.reject,
            _raisonsTocard: tocard.reasons,
            _mu: music,
            _tempo: participant._tempo,
            _biaisBonus: participant._biaisBonus,
            _croisements: participant._croisements,
            _reseau: participant._reseau,
            _memoire: participant._memoire
        };
    });

    const resultatsValides = scored.filter((runner) => !runner._estTocard).sort((left, right) => right.score - left.score);
    if (resultatsValides.length === 0) {
        return null;
    }

    const top5 = resultatsValides.slice(0, 5);
    const predictionsCotes = {};
    scored.forEach((runner) => {
        predictionsCotes[runner.numero] = predictFinalOdds(runner, scored, runner._scoreAlgo || runner.score || 0, Boolean(courseInfo.estQuinte));
    });

    const favori = top5[0];
    const soliditeFavori = analyzeFavoriteSolidity(favori, scored, {
        nombrePartants: participants.length
    });
    const recommandation = buildRecommendation(soliditeFavori, favori, predictionsCotes[favori.numero], options.alternativeText || null);
    const scoreConfiance = computeConfidenceScore({
        solidite: soliditeFavori,
        recommendation: recommandation,
        mouvementsCotes: options.mouvementsCotes || { alertes: [], signaux: [] },
        meteo: options.meteo || { disponible: false },
        cheval: favori,
        top5,
        predictionsCotes
    });
    const profils_pre = computeStrategicProfiles(scored, predictionsCotes, { resultatsValides });
    const valueTop5 = analyzeTopValues(top5, resultatsValides, {
        readability: profils_pre.lisibilite || 'INCONNUE',
        confidence: scoreConfiance.score || 0
    });
    const valueCheval = valueTop5[favori.numero];
    if (valueCheval && valueCheval.bonusConfiance) {
        scoreConfiance.score = Math.min(10, Math.max(0, Math.round((scoreConfiance.score + valueCheval.bonusConfiance) * 10) / 10));
        scoreConfiance.facteurs.push(`Value ${valueCheval.valueIndex}x (${valueCheval.label})`);
        scoreConfiance.niveau = getConfidenceLevel(scoreConfiance.score);
    }

    if (valueCheval && valueCheval.valueIndex < 0.9) {
        recommandation.vautLeCoup = false;
        recommandation.raisonnement = [
            ...(recommandation.raisonnement || []),
            `Value insuffisante (${valueCheval.valueIndex}x)`
        ];
    }
    const confidenceWithTrackBias = applyTrackBiasToConfidence(scoreConfiance, favori, options.biaisPiste || null);
    confidenceWithTrackBias.niveau = getConfidenceLevel(confidenceWithTrackBias.score);
    const profils = computeStrategicProfiles(scored, predictionsCotes, {
        resultatsValides
    });

    const readabilityCoeff = ALGORITHM_CONFIG.readabilityCoefficients[profils.lisibilite] ?? 1.0;
    const scoreFinalPari = Math.round((favori._scoreAlgo || favori.score || 0) * readabilityCoeff * 10) / 10;

    const pilotage = buildAnalysisPilotage({
        favoris: favori,
        favori,
        recommandation,
        scoreConfiance: confidenceWithTrackBias,
        profils,
        valueTop5
    });

    return {
        courseInfo,
        participants: participants.length,
        resultats: scored,
        tocardsFiltres: scored.filter((runner) => runner._estTocard),
        top5,
        favori,
        soliditeFavori,
        recommandation,
        scoreConfiance: confidenceWithTrackBias,
        predictionsCotes,
        profils,
        valueTop5,
        biaisPiste: options.biaisPiste || null,
        meteo: options.meteo || { disponible: false },
        pilotage,
        scoreFinalPari,
        readabilityCoefficient: readabilityCoeff
    };
}

module.exports = {
    analyzeCourse
};
