'use strict';

async function call(name, req, res) {
    if (res && typeof res.status === 'function' && typeof res.json === 'function') {
        res.status(501).json({
            ok: false,
            error: 'legacy_handler_unavailable',
            name
        });
        return;
    }

    return {
        ok: false,
        error: 'legacy_handler_unavailable',
        name,
        req
    };
}

module.exports = {
    call
};
