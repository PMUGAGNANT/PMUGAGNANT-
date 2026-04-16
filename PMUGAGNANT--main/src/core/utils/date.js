'use strict';

const PARIS_TIME_ZONE = 'Europe/Paris';

function getParisParts(date) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: PARIS_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(date);
    const pick = (type) => parts.find((part) => part.type === type)?.value || '0';

    return {
        year: Number(pick('year')),
        month: Number(pick('month')),
        day: Number(pick('day')),
        hour: Number(pick('hour')),
        minute: Number(pick('minute')),
        second: Number(pick('second'))
    };
}

function getTimeZoneOffsetMinutes(date, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset'
    });
    const timeZoneName = formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || 'GMT';
    const match = timeZoneName.match(/^GMT(?:(\+|-)(\d{1,2})(?::?(\d{2}))?)?$/);
    if (!match) {
        return 0;
    }

    const sign = match[1] === '-' ? -1 : 1;
    const hours = Number(match[2] || 0);
    const minutes = Number(match[3] || 0);
    return sign * (hours * 60 + minutes);
}

function getParisDateFromParts(year, month, day, hours = 0, minutes = 0) {
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
    const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, PARIS_TIME_ZONE);
    return new Date(utcGuess.getTime() - offsetMinutes * 60000);
}

function formatPmuDate(date) {
    const source = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const { day, month, year } = getParisParts(source);
    return `${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}${year}`;
}

function parsePmuDate(dateStr) {
    const raw = String(dateStr || '');
    if (!/^\d{8}$/.test(raw)) {
        return new Date(Number.NaN);
    }

    const day = Number(raw.slice(0, 2));
    const month = Number(raw.slice(2, 4));
    const year = Number(raw.slice(4, 8));
    return getParisDateFromParts(year, month, day, 12, 0);
}

function getRaceTimestamp(dateStr, heureDepart) {
    const safeDate = /^\d{8}$/.test(String(dateStr || '')) ? String(dateStr) : formatPmuDate(new Date());
    const [hours, minutes] = String(heureDepart || '00:00').split(':').map((value) => Number.parseInt(value, 10) || 0);
    const day = Number(safeDate.slice(0, 2));
    const month = Number(safeDate.slice(2, 4));
    const year = Number(safeDate.slice(4, 8));
    return getParisDateFromParts(year, month, day, hours, minutes);
}

function getMinutesUntilStart(heureDepart, dateStr) {
    const target = dateStr
        ? getRaceTimestamp(dateStr, heureDepart)
        : (() => {
            const nowParts = getParisParts(new Date());
            const [hours, minutes] = String(heureDepart || '00:00').split(':').map((value) => Number.parseInt(value, 10) || 0);
            return getParisDateFromParts(nowParts.year, nowParts.month, nowParts.day, hours, minutes);
        })();

    return (target.getTime() - Date.now()) / 60000;
}

module.exports = {
    formatPmuDate,
    getMinutesUntilStart,
    getRaceTimestamp,
    parsePmuDate
};
