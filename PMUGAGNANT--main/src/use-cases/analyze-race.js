'use strict';

const { analyzeCourse } = require('../core/analysis/course-analyzer');
const { detectOddsMovements, inferTrackBias } = require('../core/analysis/enrichments');
const { resolveOperationalSelection, resolveWatchSelection } = require('../core/analysis/selection-policy');
const { formatPmuDate } = require('../core/utils/date');

async function runRaceAnalysis({
    date = new Date(),
    reunion,
    course,
    hippodrome = '',
    discipline = 'trot',
    pmuApi,
    storage,
    telegram,
    weather,
    sendTelegram = false
}) {
    if (!pmuApi || reunion === undefined || course === undefined) {
        return {
            success: false,
            skipped: true,
            reason: 'missing_inputs'
        };
    }

    const dateStr = formatPmuDate(date);
    const safeReunion = Number(reunion);
    const safeCourse = Number(course);
    const [participants, conditions, realtimeOdds] = await Promise.all([
        pmuApi.getParticipants(dateStr, safeReunion, safeCourse),
        pmuApi.getCourseConditions ? pmuApi.getCourseConditions(dateStr, safeReunion, safeCourse) : {},
        pmuApi.getRealtimeOdds ? pmuApi.getRealtimeOdds(dateStr, safeReunion, safeCourse) : {}
    ]);

    if (!Array.isArray(participants) || participants.length === 0) {
        return {
            success: false,
            skipped: true,
            reason: 'no_participants'
        };
    }

    const hydratedParticipants = participants.map((participant) => ({
        ...participant,
        coteTempsReel: realtimeOdds?.[participant.numPmu] ?? participant.coteTempsReel ?? participant.cote ?? null
    }));
    const historiesByHorse = {};

    if (storage?.chevaux?.read) {
        await Promise.all(hydratedParticipants.map(async (participant) => {
            const key = storage.normalizeStoreKey(participant.nom);
            historiesByHorse[participant.numPmu] = await storage.chevaux.read(key) || [];
        }));
    }

    const analysis = await analyzeCourse(
        {
            dateStr,
            reunion: safeReunion,
            course: safeCourse,
            hippodrome: hippodrome || conditions.hippodrome || '',
            discipline,
            estPlat: String(discipline || '').toLowerCase() === 'plat',
            estQuinte: Boolean(conditions.estQuinte)
        },
        hydratedParticipants,
        {
            historiesByHorse,
            networkByHorse: {},
            meteo: weather && hippodrome ? await weather.getWeatherForHippodrome(hippodrome) : { disponible: false },
            mouvementsCotes: detectOddsMovements(hydratedParticipants, realtimeOdds),
            biaisPiste: inferTrackBias([])
        }
    );

    if (!analysis) {
        return {
            success: false,
            skipped: true,
            reason: 'analysis_unavailable'
        };
    }

    analysis.selection = resolveOperationalSelection(analysis) || resolveWatchSelection(analysis);

    if (sendTelegram && telegram?.sendMessage && analysis.selection) {
        await telegram.sendMessage(
            `TurfEdge\nR${safeReunion}C${safeCourse} ${analysis.courseInfo.hippodrome}\n` +
            `Selection: N${analysis.selection.runner.numero} ${analysis.selection.runner.nom}\n` +
            `Confiance ${analysis.scoreConfiance?.score || 0}/10`
        );
    }

    return {
        success: true,
        analyse: analysis
    };
}

module.exports = {
    runRaceAnalysis
};
