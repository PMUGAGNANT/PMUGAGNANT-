/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { logger } = require('../shared/logger');

function createHttpHandler(name, handler) {
    return async function wrappedHttpHandler(req, res) {
        try {
            await handler(req, res);
        } catch (error) {
            logger.error('http_handler.failure', {
                name,
                error: error instanceof Error ? error.message : String(error)
            });

            if (res && typeof res.status === 'function' && typeof res.json === 'function') {
                res.status(500).json({
                    ok: false,
                    error: 'internal_error',
                    handler: name
                });
                return;
            }

            throw error;
        }
    };
}

module.exports = {
    createHttpHandler
};
