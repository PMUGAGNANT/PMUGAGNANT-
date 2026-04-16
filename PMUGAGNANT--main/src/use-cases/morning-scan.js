'use strict';

const { analyzeCourse } = require('../core/analysis/course-analyzer');
const { buildScanSummary } = require('../core/analysis/scan-summary');
const { resolveOperationalSelection, resolveWatchSelection } = require('../core/analysis/selection-policy');
const { detectOddsMovements, inferTrackBias } = require('../core/analysis/enrichments');
const { formatMorningScanTelegram, normalizeTelegramMode } = require('../core/messages/telegram-formatters');
const { formatPmuDate } = require('../core/utils/date');
const { getRuntimeConfig } = require('../config/env');
const { logger } = require('../shared/logger');

const runtimeConfig = getRuntimeConfig();

async function runMorningScan({
    date = new Date(),
    pmuApi,
    storage,
    telegram,
    weather,
    telegramMode = 'normal',
    limit = null,
    force = false
}) {
    const dateStr = formatPmuDate(date);
    const races = await pmuApi.getAllRaces(dateStr);
    const trotRaces = races.filter((race) => race.estTrot);
    const eligibleRaces = runtimeConfig.franceOnlyMode
        ? trotRaces.filter((race) => String(race.pays || '').toUpperCase() === 'FRA')
        : trotRaces;
    const selectedRaces = typeof limit === 'number' ? eligibleRaces.slice(0, limit) : eligibleRaces;
    const analyses = [];
    const meteoCache = {};
    const networkByHorse = await storage.readJson('reseau/performances.json') || {};

    for (const race of selectedRaces) {
        const [participants, conditions, realtimeOdds] = await Promise.all([
            pmuApi.getParticipants(dateStr, race.reunion, race.course),
            pmuApi.getCourseConditions(dateStr, race.reunion, race.course),
            pmuApi.getRealtimeOdds(dateStr, race.reunion, race.course)
        ]);

        const hydratedParticipants = participants.map((participant) => ({
            ...participant,
            coteTempsReel: realtimeOdds[participant.numPmu] || null
        }));

        const historiesByHorse = {};
        await Promise.all(hydratedParticipants.map(async (participant) => {
            const key = storage.normalizeStoreKey(participant.nom);
            historiesByHorse[participant.numPmu] = await storage.chevaux.read(key) || [];
        }));

        const hippodrome = race.hippodrome || conditions.hippodrome || '';
        if (!meteoCache[hippodrome]) {
            meteoCache[hippodrome] = weather
                ? await weather.getWeatherForHippodrome(hippodrome)
                : { disponible: false };
        }

        const analysis = await analyzeCourse(
            {
                ...race,
                ...conditions,
                dateStr,
                hippodrome: race.hippodrome || conditions.hippodrome || ''
            },
            hydratedParticipants,
            {
                mouvementsCotes: detectOddsMovements(hydratedParticipants, realtimeOdds),
                biaisPiste: inferTrackBias([]),
                meteo: meteoCache[hippodrome],
                historiesByHorse,
                networkByHorse
            }
        );

        if (analysis) {
            analyses.push(analysis);
        }
    }

    const rawRecommendations = analyses
        .map((analysis) => ({
            analysis,
            selection: resolveOperationalSelection(analysis)
        }))
        .filter((item) => Boolean(item.selection))
        .map((item) => ({
            ...item.analysis,
            selection: item.selection
        }));

    const outsiderProfiles = new Set(['pepite', 'sniper', 'braquage']);
    const outsiderByReunion = {};
    const recommendations = rawRecommendations.filter((rec) => {
        const profile = rec.selection?.profile || '';
        if (!outsiderProfiles.has(profile)) return true;
        const reunionId = String(rec.courseInfo?.reunion || '');
        if (outsiderByReunion[reunionId]) return false;
        outsiderByReunion[reunionId] = true;
        return true;
    });
    const watchlist = analyses
        .map((analysis) => ({
            analysis,
            selection: resolveWatchSelection(analysis)
        }))
        .filter((item) => Boolean(item.selection))
        .filter((item) => !recommendations.some((recommendation) =>
            recommendation.courseInfo?.reunion === item.analysis.courseInfo?.reunion
            && recommendation.courseInfo?.course === item.analysis.courseInfo?.course
        ))
        .sort((left, right) => scoreWatchSelection(right) - scoreWatchSelection(left))
        .slice(0, 3)
        .map((item) => ({
            ...item.analysis,
            selection: item.selection
        }));
    const summary = buildScanSummary(analyses, recommendations);

    await storage.writeJson(`predictions/${dateStr}-modern.json`, {
        dateStr,
        totalRaces: selectedRaces.length,
        analyzedRaces: analyses.length,
        summary,
        allAnalyses: analyses.map(toStoredRecommendation),
        recommendations: recommendations.map(toStoredRecommendation),
        watchlist: watchlist.map(toStoredRecommendation)
    });
    await storage.writeJson(`stats/${dateStr}-modern-scan.json`, summary);

    const result = {
        ok: true,
        dateStr,
        totalRaces: races.length,
        eligibleRaces: selectedRaces.length,
        analyzedRaces: analyses.length,
        summary,
        recommendations: recommendations.map(toApiRecommendation),
        watchlist: watchlist.map(toApiRecommendation)
    };

    if (recommendations.length > 0 || watchlist.length > 0) {
        const dispatchKey = `dispatch/${dateStr}-morning-scan.json`;
        const signature = buildMorningScanSignature(recommendations, watchlist, summary);
        const previousDispatch = storage ? await storage.readJson(dispatchKey) : null;

        if (!force && previousDispatch?.signature === signature) {
            return {
                ...result,
                skipped: true,
                reason: 'duplicate_morning_scan',
                previousSentAt: previousDispatch.sentAt || null
            };
        }

        if (telegram) {
            await telegram.sendMessage(formatMorningScanTelegram(dateStr, recommendations, watchlist, normalizeTelegramMode(telegramMode), summary));
        }

        if (storage) {
            await storage.writeJson(dispatchKey, {
                dateStr,
                signature,
                sentAt: new Date().toISOString(),
                recommendationCount: recommendations.length,
                watchCount: watchlist.length
            });
        }
    } else {
        logger.info('morning_scan.no_recommendation', {
            dateStr,
            analyzedRaces: analyses.length,
            summary
        });
    }

    return result;
}

function toStoredRecommendation(analysis) {
    return {
        reunion: analysis.courseInfo.reunion,
        course: analysis.courseInfo.course,
        hippodrome: analysis.courseInfo.hippodrome,
        favori: {
            numero: analysis.favori.numero,
            nom: analysis.favori.nom,
            cote: analysis.favori.cote
        },
        selection: analysis.selection || null,
        recommandation: analysis.recommandation,
        confiance: analysis.scoreConfiance,
        pilotage: analysis.pilotage,
        valueTop5: analysis.valueTop5,
        meteo: analysis.meteo || { disponible: false },
        profils: {
            beton: toProfileSummary(analysis.profils?.beton),
            pepite: toProfileSummary(analysis.profils?.pepite),
            sniper: toProfileSummary(analysis.profils?.sniper),
            braquage: toProfileSummary(analysis.profils?.braquage),
            lisibilite: analysis.profils?.lisibilite || 'INCONNUE'
        }
    };
}

function toApiRecommendation(analysis) {
    return {
        reunion: analysis.courseInfo.reunion,
        course: analysis.courseInfo.course,
        hippodrome: analysis.courseInfo.hippodrome,
        favori: analysis.favori.nom,
        selection: analysis.selection ? {
            profil: analysis.selection.profile,
            cheval: analysis.selection.runner.nom,
            numero: analysis.selection.runner.numero,
            valueIndex: analysis.selection.valueIndex
        } : null,
        decision: analysis.recommandation?.decision || null,
        confiance: analysis.scoreConfiance?.score || null,
        lisibilite: analysis.profils?.lisibilite || null,
        terrain: analysis.meteo?.terrain || null,
        qualite: analysis.pilotage?.score || null
    };
}

function scoreWatchSelection(analysis) {
    return ((Number(analysis.scoreConfiance?.score) || 0) * 10)
        + (Number(analysis.pilotage?.score) || 0)
        + ((Number(analysis.selection?.valueIndex) || 0) * 20);
}

function toProfileSummary(profile) {
    if (!profile) {
        return null;
    }

    return {
        numero: profile.numero,
        nom: profile.nom,
        cote: profile._cote,
        score: profile._score
    };
}

function buildMorningScanSignature(recommendations, watchlist, summary) {
    const recommendationSignature = (recommendations || [])
        .map((analysis) => {
            const selection = analysis.selection;
            return [
                analysis.courseInfo?.reunion,
                analysis.courseInfo?.course,
                selection?.profile || 'none',
                selection?.runner?.numero || 'none',
                round2(selection?.valueIndex || 0),
                round1(analysis.scoreConfiance?.score || 0)
            ].join(':');
        })
        .join('|');
    const watchSignature = (watchlist || [])
        .map((analysis) => {
            const selection = analysis.selection;
            return [
                analysis.courseInfo?.reunion,
                analysis.courseInfo?.course,
                selection?.profile || 'watch',
                selection?.runner?.numero || 'none',
                round2(selection?.valueIndex || 0),
                round1(analysis.scoreConfiance?.score || 0)
            ].join(':');
        })
        .join('|');

    return [
        recommendationSignature,
        watchSignature,
        summary?.lisibilite?.LISIBLE || 0,
        summary?.lisibilite?.COMPLEXE || 0,
        summary?.lisibilite?.LOTERIE || 0,
        round1(summary?.confianceMoyenne || 0),
        round2(summary?.valueMoyenneFavori || 0)
    ].join('::');
}

function round1(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
}

function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

module.exports = {
    runMorningScan
};
