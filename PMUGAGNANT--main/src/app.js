'use strict';

const { createHttpHandler } = require('./handlers/http');
const legacyEngine = require('./services/legacy-engine');
const { getPublicRuntimeConfig, getRuntimeConfig } = require('./config/env');
const { pmuApiService } = require('./services/pmu-api');
const { storageService } = require('./services/storage');
const { telegramService } = require('./services/telegram');
const { weatherService } = require('./services/weather');
const { runMorningScan } = require('./use-cases/morning-scan');
const { runRaceAnalysis } = require('./use-cases/analyze-race');
const { runPreRaceAlert } = require('./use-cases/pre-race-alert');
const { runEveningRecap, runWeeklyReport } = require('./use-cases/evening-recap');
const runtimeConfig = getRuntimeConfig();

function createWrappedLegacyHandler(name) {
    return createHttpHandler(name, async (req, res) => {
        return legacyEngine.call(name, req, res);
    });
}

module.exports = {
    health: createHttpHandler('health', async (req, res) => {
        res.status(200).json({
            ok: true,
            service: 'pmu-ai',
            version: '10.0.0-foundation',
            runtime: getPublicRuntimeConfig(),
            timestamp: new Date().toISOString()
        });
    }),
    config: createHttpHandler('config', async (req, res) => {
        res.status(200).json({
            ok: true,
            config: getPublicRuntimeConfig(),
            services: {
                pmuApi: ['getProgramme', 'getAllRaces', 'getParticipants', 'getCourseConditions', 'getRealtimeOdds'],
                storage: ['readJson', 'writeJson', 'predictions', 'snapshots', 'bilans', 'stats', 'poids', 'chevaux'],
                telegram: ['sendMessage'],
                weather: ['getWeatherForHippodrome']
            }
        });
    }),
    toutesLesCoursesMatinModern: createHttpHandler('toutesLesCoursesMatinModern', async (req, res) => {
        const limit = req?.query?.limit ? Number.parseInt(req.query.limit, 10) : null;
        const date = req?.query?.date ? parseDateInput(req.query.date) : new Date();
        const result = await runMorningScan({
            date,
            pmuApi: pmuApiService,
            storage: storageService,
            telegram: telegramService,
            weather: weatherService,
            telegramMode: req?.query?.telegramMode || req?.body?.telegramMode || 'normal',
            limit: Number.isFinite(limit) ? limit : null,
            force: (req?.query?.force || req?.body?.force) === '1'
        });

        res.status(200).json(result);
    }),
    analyserCourseModern: createHttpHandler('analyserCourseModern', async (req, res) => {
        const result = await runRaceAnalysis({
            date: req?.query?.date ? parseDateInput(req.query.date) : new Date(),
            reunion: req?.query?.reunion || req?.body?.reunion,
            course: req?.query?.course || req?.body?.course,
            hippodrome: req?.query?.hippodrome || req?.body?.hippodrome || '',
            discipline: req?.query?.discipline || req?.body?.discipline || 'trot',
            sendTelegram: (req?.query?.telegram || req?.body?.telegram) === '1',
            pmuApi: pmuApiService,
            storage: storageService,
            telegram: telegramService,
            weather: weatherService,
            telegramMode: req?.query?.telegramMode || req?.body?.telegramMode || 'normal'
        });

        if (!result) {
            res.status(404).json({ success: false, error: 'Analyse impossible' });
            return;
        }

        res.status(200).json(result);
    }),
    services: {
        pmuApi: pmuApiService,
        storage: storageService,
        telegram: telegramService,
        weather: weatherService
    },
    toutesLesCoursesMatin: createHttpHandler('toutesLesCoursesMatin', async (req, res) => {
        if (shouldUseLegacy(req)) {
            await legacyEngine.call('toutesLesCoursesMatin', req, res);
            return;
        }

        const limit = req?.query?.limit ? Number.parseInt(req.query.limit, 10) : null;
        const date = req?.query?.date ? parseDateInput(req.query.date) : new Date();
        const result = await runMorningScan({
            date,
            pmuApi: pmuApiService,
            storage: storageService,
            telegram: telegramService,
            weather: weatherService,
            telegramMode: req?.query?.telegramMode || req?.body?.telegramMode || 'normal',
            limit: Number.isFinite(limit) ? limit : null,
            force: (req?.query?.force || req?.body?.force) === '1'
        });

        res.status(200).json(result);
    }),
    bilanSoir: createHttpHandler('bilanSoir', async (req, res) => {
        if (shouldUseLegacy(req)) {
            await legacyEngine.call('bilanSoir', req, res);
            return;
        }

        const result = await runEveningRecap({
            date: req?.query?.date ? parseDateInput(req.query.date) : new Date(),
            pmuApi: pmuApiService,
            storage: storageService,
            telegram: (req?.query?.telegram || req?.body?.telegram) === '1' ? telegramService : null,
            force: (req?.query?.force || req?.body?.force) === '1'
        });

        res.status(200).json(result);
    }),
    alertePreCourse: createHttpHandler('alertePreCourse', async (req, res) => {
        if (shouldUseLegacy(req)) {
            await legacyEngine.call('alertePreCourse', req, res);
            return;
        }

        const result = await runPreRaceAlert({
            date: req?.query?.date ? parseDateInput(req.query.date) : new Date(),
            reunion: req?.query?.reunion || req?.body?.reunion,
            course: req?.query?.course || req?.body?.course,
            hippodrome: req?.query?.hippodrome || req?.body?.hippodrome || '',
            discipline: req?.query?.discipline || req?.body?.discipline || 'trot',
            pmuApi: pmuApiService,
            storage: storageService,
            telegram: (req?.query?.telegram || req?.body?.telegram) === '1' ? telegramService : null,
            weather: weatherService,
            force: (req?.query?.force || req?.body?.force) === '1'
        });

        res.status(200).json(result);
    }),
    bilanHebdo: createHttpHandler('bilanHebdo', async (req, res) => {
        const result = await runWeeklyReport({
            date: req?.query?.date ? parseDateInput(req.query.date) : new Date(),
            storage: storageService,
            telegram: (req?.query?.telegram || req?.body?.telegram) === '1' ? telegramService : null
        });

        res.status(200).json(result);
    }),
    historiqueCheval: createWrappedLegacyHandler('historiqueCheval'),
    voirPoids: createWrappedLegacyHandler('voirPoids'),
    resetPoids: createWrappedLegacyHandler('resetPoids'),
    sauvegarderResultat: createWrappedLegacyHandler('sauvegarderResultat'),
    analyserCourse: createHttpHandler('analyserCourse', async (req, res) => {
        if (shouldUseLegacy(req)) {
            await legacyEngine.call('analyserCourse', req, res);
            return;
        }

        const result = await runRaceAnalysis({
            date: req?.query?.date ? parseDateInput(req.query.date) : new Date(),
            reunion: req?.query?.reunion || req?.body?.reunion,
            course: req?.query?.course || req?.body?.course,
            hippodrome: req?.query?.hippodrome || req?.body?.hippodrome || '',
            discipline: req?.query?.discipline || req?.body?.discipline || 'trot',
            sendTelegram: (req?.query?.telegram || req?.body?.telegram) === '1',
            pmuApi: pmuApiService,
            storage: storageService,
            telegram: telegramService,
            weather: weatherService,
            telegramMode: req?.query?.telegramMode || req?.body?.telegramMode || 'normal'
        });

        if (!result) {
            res.status(404).json({ success: false, error: 'Analyse impossible' });
            return;
        }

        res.status(200).json(result);
    })
};

function parseDateInput(value) {
    if (!value) {
        return new Date();
    }

    const raw = String(value);
    if (/^\d{8}$/.test(raw)) {
        const day = raw.slice(0, 2);
        const month = raw.slice(2, 4);
        const year = raw.slice(4, 8);
        return new Date(`${year}-${month}-${day}T08:00:00`);
    }

    return new Date(raw);
}

function shouldUseLegacy(req) {
    const rawLegacy = String(req?.query?.legacy || req?.body?.legacy || '').toLowerCase();
    if (['1', 'true', 'legacy'].includes(rawLegacy)) {
        return true;
    }

    if (!runtimeConfig.modernProductionMode) {
        const rawModern = String(req?.query?.modern || req?.body?.modern || '').toLowerCase();
        return !['1', 'true', 'modern'].includes(rawModern);
    }

    return false;
}
