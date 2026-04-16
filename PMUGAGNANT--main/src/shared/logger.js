'use strict';

function write(level, event, payload) {
    const record = {
        timestamp: new Date().toISOString(),
        level,
        event,
        ...(payload && typeof payload === 'object' ? payload : { value: payload })
    };

    const line = JSON.stringify(record);
    if (level === 'error') {
        console.error(line);
        return;
    }

    if (level === 'warn') {
        console.warn(line);
        return;
    }

    console.log(line);
}

const logger = {
    debug(event, payload) {
        write('debug', event, payload);
    },
    info(event, payload) {
        write('info', event, payload);
    },
    warn(event, payload) {
        write('warn', event, payload);
    },
    error(event, payload) {
        write('error', event, payload);
    }
};

module.exports = {
    logger
};
