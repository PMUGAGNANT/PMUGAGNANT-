'use strict';

async function getWeatherForHippodrome(hippodrome) {
    return {
        disponible: false,
        hippodrome: hippodrome || '',
        source: 'disabled'
    };
}

const weatherService = {
    getWeatherForHippodrome
};

module.exports = {
    weatherService
};
