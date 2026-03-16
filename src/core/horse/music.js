'use strict';

const { parseOdds } = require('../utils/odds');

function parseMusic(music) {
    if (!music) {
        return createEmptyMusicStats();
    }

    const segments = String(music)
        .replace(/\s+/g, '')
        .match(/\(\d+\)|0[ap]?|[Dd][ap]?|\d+[ap]?|[A-Za-z][a-z]?/g) || [];
    const races = [];

    for (const segment of segments) {
        if (/^\(\d+\)$/.test(segment)) {
            continue;
        }

        const disqualification = segment.match(/^(D|d)(a|p)?/i);
        if (disqualification) {
            races.push({ type: 'DQ', raw: segment });
            continue;
        }

        if (segment === '0' || segment === '0a' || segment === '0p') {
            races.push({ type: 'ABANDON', raw: segment });
            continue;
        }

        const position = segment.match(/^(\d+)([ap])?$/i);
        if (position) {
            races.push({
                type: 'COURSE',
                raw: segment,
                position: parseInt(position[1], 10),
                discipline: position[2]?.toLowerCase() || 'a',
                disc: position[2]?.toLowerCase() || ''
            });
        }
    }

    const completedRaces = races.filter((race) => race.type === 'COURSE');
    const recentPositions = completedRaces.slice(0, 5).map((race) => race.position);
    const reliability = races.length > 0 ? completedRaces.length / races.length : 0;
    const averagePosition = completedRaces.length > 0
        ? completedRaces.reduce((sum, race) => sum + race.position, 0) / completedRaces.length
        : 99;

    let podiumStreak = 0;
    for (const race of races) {
        if (race.type === 'COURSE' && race.position <= 3) {
            podiumStreak += 1;
            continue;
        }
        break;
    }

    const weightedRecentFormScore = calculateWeightedRecentFormScore(completedRaces);
    const maxWeightedRecentFormScore = [5, 4, 3, 2, 1]
        .slice(0, Math.min(5, completedRaces.length))
        .reduce((sum, weight) => sum + (weight * 10), 0);
    const formRatio = maxWeightedRecentFormScore > 0
        ? weightedRecentFormScore / maxWeightedRecentFormScore
        : 0;
    const trend = calculateTrend(completedRaces);
    const placeProfile = completedRaces.length >= 3
        && completedRaces.filter((race) => race.position === 1).length === 0
        && averagePosition >= 3
        && averagePosition <= 5;
    const daSignal = analyzeDaSignal(races, completedRaces);

    const last10 = races.slice(0, 10);
    const dqInLast10 = last10.filter((race) => race.type === 'DQ').length;
    const tauxFaute = last10.length > 0 ? dqInLast10 / last10.length : 0;

    return {
        races,
        courses: races,
        completedRaces,
        coursesVal: completedRaces,
        recentPositions,
        dernieres5: recentPositions,
        wins: completedRaces.filter((race) => race.position === 1).length,
        nbVictoires: completedRaces.filter((race) => race.position === 1).length,
        podiums: completedRaces.filter((race) => race.position <= 3).length,
        nbPodiums: completedRaces.filter((race) => race.position <= 3).length,
        disqualifications: races.filter((race) => race.type === 'DQ').length,
        nbDQ: races.filter((race) => race.type === 'DQ').length,
        abandonments: races.filter((race) => race.type === 'ABANDON').length,
        nbAbandons: races.filter((race) => race.type === 'ABANDON').length,
        totalRaces: races.length,
        total: races.length,
        completedCount: completedRaces.length,
        nbTerminees: completedRaces.length,
        reliability,
        fiabilite: reliability,
        averagePosition,
        avgPos: averagePosition,
        podiumStreak,
        serie: podiumStreak,
        trend,
        ratioForme: formRatio,
        placeProfile,
        signalDa: daSignal.signal,
        noteDaDetail: daSignal.note,
        tauxFaute,
        dqLast10: dqInLast10
    };
}

function createEmptyMusicStats() {
    return {
        races: [],
        courses: [],
        completedRaces: [],
        coursesVal: [],
        recentPositions: [],
        dernieres5: [],
        wins: 0,
        nbVictoires: 0,
        podiums: 0,
        nbPodiums: 0,
        disqualifications: 0,
        nbDQ: 0,
        abandonments: 0,
        nbAbandons: 0,
        totalRaces: 0,
        total: 0,
        completedCount: 0,
        nbTerminees: 0,
        reliability: 0,
        fiabilite: 0,
        averagePosition: 99,
        avgPos: 99,
        podiumStreak: 0,
        serie: 0,
        trend: 0,
        ratioForme: 0,
        placeProfile: false,
        signalDa: 'NEUTRE',
        noteDaDetail: '',
        tauxFaute: 0,
        dqLast10: 0
    };
}

function calculateWeightedRecentFormScore(completedRaces) {
    const weights = [5, 4, 3, 2, 1];
    let score = 0;

    completedRaces.slice(0, 5).forEach((race, index) => {
        const weight = weights[index] || 1;

        if (race.position === 1) score += 10 * weight;
        else if (race.position === 2) score += 7 * weight;
        else if (race.position === 3) score += 5 * weight;
        else if (race.position <= 5) score += 2 * weight;
    });

    return score;
}

function calculateTrend(completedRaces) {
    const recent = completedRaces.slice(0, 5).map((race) => race.position);
    if (recent.length < 3) {
        return 0;
    }

    const midpoint = Math.floor(recent.length / 2);
    const recentAverage = recent.slice(0, midpoint).reduce((sum, value) => sum + value, 0) / midpoint;
    const olderAverage = recent.slice(midpoint).reduce((sum, value) => sum + value, 0) / (recent.length - midpoint);
    return olderAverage - recentAverage;
}

function analyzeDaSignal(races, completedRaces) {
    const disqualifications = races.filter((race) => race.type === 'DQ').length;
    if (disqualifications === 0) {
        return { signal: 'NEUTRE', note: '' };
    }

    const podiums = completedRaces.filter((race) => race.position <= 3).length;
    const poorRuns = completedRaces.filter((race) => race.position >= 7).length;
    const ratio = disqualifications / Math.max(1, races.length);
    const firstRealEvent = races.find((race) => race.type === 'DQ' || race.type === 'ABANDON' || race.type === 'COURSE');
    const latestWasDq = firstRealEvent?.type === 'DQ';

    if (ratio >= 0.25 && podiums >= 2 && !latestWasDq) {
        return {
            signal: 'OUTSIDER_SURPRISE',
            note: `${disqualifications} Da + ${podiums} podiums`
        };
    }

    if (ratio >= 0.3 && poorRuns >= 2) {
        return {
            signal: 'MAUVAIS',
            note: `${disqualifications} Da + ${poorRuns} mauvaises perfs`
        };
    }

    if (latestWasDq && podiums >= 1) {
        return {
            signal: 'OUTSIDER_SURPRISE',
            note: 'Derniere sortie incident mais valeur presente'
        };
    }

    return {
        signal: 'NEUTRE',
        note: ''
    };
}

function classifyTempo(musicStats) {
    const recent = musicStats?.coursesVal?.slice(0, 5) || [];
    if (recent.length < 2) {
        return { tempo: 'NEUTRE', bonus: 0, detail: 'Tempo insuffisant' };
    }

    const firstTwo = recent.slice(0, 2).map((race) => race.position);
    const lastThree = recent.slice(2, 5).map((race) => race.position);

    const recentAverage = firstTwo.reduce((sum, value) => sum + value, 0) / firstTwo.length;
    const olderAverage = lastThree.length > 0
        ? lastThree.reduce((sum, value) => sum + value, 0) / lastThree.length
        : recentAverage;
    const delta = olderAverage - recentAverage;

    if (delta >= 3) return { tempo: 'MONTEE_FORTE', bonus: 1.2, detail: 'Forte progression recente' };
    if (delta >= 1.5) return { tempo: 'MONTEE_DOUCE', bonus: 0.6, detail: 'Progression recente' };
    if (delta <= -3) return { tempo: 'CHUTE_FORTE', bonus: -1.2, detail: 'Chute de forme nette' };
    if (delta <= -1.5) return { tempo: 'CHUTE_DOUCE', bonus: -0.6, detail: 'Legere baisse de forme' };
    return { tempo: 'NEUTRE', bonus: 0, detail: 'Tempo stable' };
}

function shouldRejectAsTocard(participant, musicStats = parseMusic(participant?.musique || '')) {
    const odds = parseOdds(participant?.cote) || 99;
    const reasons = [];

    const topSix = musicStats.courses.slice(0, 6);
    const recentPodiums = topSix.filter((race) => race.type === 'COURSE' && race.position <= 3).length;
    const recentWins = musicStats.courses.slice(0, 4)
        .filter((race) => race.type === 'COURSE' && race.position === 1)
        .length;

    if (recentPodiums >= 3 || recentWins >= 2) {
        return { reject: false, reasons: [], protected: true };
    }

    if (musicStats.total >= 4 && musicStats.fiabilite < 0.5) {
        reasons.push(`Fiabilite ${Math.round(musicStats.fiabilite * 100)}%`);
    }

    if (musicStats.coursesVal.length >= 4 && musicStats.avgPos > 9) {
        reasons.push(`Moyenne ${musicStats.avgPos.toFixed(1)}`);
    }

    const lastTen = musicStats.coursesVal.slice(0, 10);
    const hasRecentPodium = lastTen.some((race) => race.position <= 3);
    if (lastTen.length >= 6 && !hasRecentPodium && odds > 40) {
        reasons.push(`Aucun podium recent et cote ${odds}`);
    }

    const recentFinished = topSix.filter((race) => race.type === 'COURSE').length;
    if (topSix.length >= 5 && recentFinished < 2) {
        reasons.push(`${recentFinished} course terminee sur 6`);
    }

    if (musicStats.total >= 2 && musicStats.fiabilite === 0) {
        reasons.push(`Aucune course terminee`);
    }

    return {
        reject: reasons.length >= 2,
        reasons,
        protected: false
    };
}

module.exports = {
    classifyTempo,
    parseMusic,
    shouldRejectAsTocard
};
