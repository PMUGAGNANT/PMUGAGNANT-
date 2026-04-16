'use strict';

function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }

    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseInteger(value, defaultValue) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
}

function getRuntimeConfig() {
    return {
        nodeEnv: process.env.NODE_ENV || 'development',
        modernProductionMode: parseBoolean(process.env.MODERN_PRODUCTION_MODE, true),
        franceOnlyMode: parseBoolean(process.env.FRANCE_ONLY_MODE, false),
        dataDirectory: process.env.LEGACY_DATA_DIR || '.legacy-data',
        requestTimeoutMs: parseInteger(process.env.PMU_REQUEST_TIMEOUT_MS, 12000),
        telegramEnabled: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
    };
}

function getPublicRuntimeConfig() {
    const runtime = getRuntimeConfig();

    return {
        nodeEnv: runtime.nodeEnv,
        modernProductionMode: runtime.modernProductionMode,
        franceOnlyMode: runtime.franceOnlyMode,
        requestTimeoutMs: runtime.requestTimeoutMs,
        telegramEnabled: runtime.telegramEnabled
    };
}

module.exports = {
    getPublicRuntimeConfig,
    getRuntimeConfig
};
