'use strict';

const { parseMusic } = require('../horse/music');
const { ALGORITHM_CONFIG } = require('../config/algorithm');

function scoreRunner(participant, options = {}) {
    const music = participant._mu || parseMusic(participant.musique || '');
    const weights = options.weights || (options.estPlat ? ALGORITHM_CONFIG.scoringWeights.plat : ALGORITHM_CONFIG.scoringWeights.trot);
    const antiPatterns = ALGORITHM_CONFIG.antiPatterns;
    const estPlat = Boolean(options.estPlat);
    let score = 0;
    const bonus = [];
    const malus = [];
    const details = {};

    const formScore = music.ratioForme * (weights.forme_5courses || 0);
    score += formScore;
    details.forme = round1(formScore);

    if (music.serie >= 4) {
        score += weights.placements_consecutifs || 0;
        bonus.push(`${music.serie} podiums consecutifs`);
    } else if (music.serie >= 2) {
        score += (weights.placements_consecutifs || 0) * 0.6;
    }

    if (music.coursesVal[0]?.position === 1) {
        score += weights.victoire_recente || 0;
        bonus.push('Vainqueur a la derniere sortie');
    }

    if (music.trend >= 3) {
        score += weights.progression_forme || 0;
        bonus.push('Progression nette');
    } else if (music.trend >= 1.5) {
        score += (weights.progression_forme || 0) * 0.5;
    } else if (music.trend <= -2) {
        score += antiPatterns.formDrop;
        malus.push('Chute de forme');
    }

    if (music.fiabilite >= 0.8) {
        score += 2.2;
        bonus.push('Tres fiable');
    } else if (music.fiabilite >= 0.7) {
        score += 1.2;
    } else if (music.fiabilite < 0.55) {
        score -= 2.8;
        malus.push('Fiabilite faible');
    }

    if (music.tauxFaute > 0.5) {
        return {
            score: 0,
            scoreOutsider: 0,
            details,
            bonus,
            malus: [...malus, `Cheval fautif exclus (${Math.round(music.tauxFaute * 100)}% Da)`],
            _mu: music,
            _excluFautif: true
        };
    }

    if (music.tauxFaute > 0.3) {
        score -= 1.5;
        malus.push(`Fautif recurrent (${Math.round(music.tauxFaute * 100)}% Da sur 10 courses)`);
    }

    if (music.placeProfile) {
        score += 1.3;
        bonus.push('Profil place');
    }

    if (participant._memoire?.bonus) {
        score += participant._memoire.bonus;
        bonus.push(...(participant._memoire.notes || []));
    }

    const eliteConnection = estPlat
        ? scoreEliteName(participant.jockey || participant.driver, ALGORITHM_CONFIG.eliteJockeys)
        : scoreEliteName(participant.driver, ALGORITHM_CONFIG.eliteDrivers);
    const trainerConnection = scoreEliteName(participant.entraineur, ALGORITHM_CONFIG.eliteTrainers);

    if (estPlat) {
        const jockeyPoints = (eliteConnection.score / 10) * (weights.jockey_elite || 0);
        score += jockeyPoints;
        details.jockey = round1(jockeyPoints);
    } else {
        const driverPoints = (eliteConnection.score / 10) * (weights.driver_elite || 0);
        score += driverPoints;
        details.driver = round1(driverPoints);
    }

    const trainerPoints = (trainerConnection.score / 10) * (weights.entraineur_elite || 5);
    score += trainerPoints;
    details.entraineur = round1(trainerPoints);

    if (eliteConnection.score >= 7 && trainerConnection.score >= 7) {
        score += weights.duo_driver_entraineur || 0;
        bonus.push('Duo elite confirme');
    }

    const drawNumber = participant.numPmu || 99;
    if (!estPlat) {
        if (drawNumber === 1) score += weights.position_depart || 0;
        else if (drawNumber <= 4) score += (weights.position_depart || 0) * (1 - ((drawNumber - 1) * 0.2));
        else if (drawNumber > 10) {
            score += antiPatterns.badTrotDraw;
            malus.push(`Corde ${drawNumber} defavorable`);
        }
    }

    const age = participant.age || 0;
    const optimalAge = estPlat ? age >= 3 && age <= 4 : age >= 4 && age <= 6;
    if (optimalAge) score += weights.age_optimal || 0;
    else if (age >= 2 && age <= 9) score += (weights.age_optimal || 0) * 0.4;

    const runs = participant.nombreCourses || 0;
    const wins = participant.nombreVictoires || 0;
    const winRate = runs > 0 ? wins / runs : 0;
    if (winRate >= 0.25) score += (weights.taux_victoire_global || 0) * 2;
    else if (winRate >= 0.15) score += weights.taux_victoire_global || 0;

    const lifetimeGains = participant.gainCarriere || 0;
    if (lifetimeGains >= 500000) score += (weights.gain_carriere_niveau || 0) * 2;
    else if (lifetimeGains >= 200000) score += (weights.gain_carriere_niveau || 0) * 1.5;
    else if (lifetimeGains >= 80000) score += weights.gain_carriere_niveau || 0;

    const runnerScore = round1(Math.max(0, score));
    if (participant._reseau?.bonus) {
        score += participant._reseau.bonus;
    }
    if (participant._croisements?.bonus) {
        score += Math.max(-2, Math.min(2, participant._croisements.bonus));
    }

    return {
        score: round1(Math.max(0, score)),
        scoreOutsider: computeOutsiderScore(participant, music, options.allParticipants || []),
        details,
        bonus,
        malus,
        _mu: music
    };
}

function computeOutsiderScore(participant, music, allParticipants) {
    const odds = Number(participant.coteTempsReel || participant.cote) || 99;
    const avgFollowers = average((allParticipants || []).map((item) => item.nombreSuiveurs || 0).filter(Boolean)) || 100;
    const followerRatio = (participant.nombreSuiveurs || 0) / Math.max(1, avgFollowers);
    let score = 0;

    if (odds >= 7 && odds <= 25) score += 30;
    if (odds > 25 && odds <= 70) {
        if (music.coursesVal.slice(0, 3).some((race) => race.position === 1)) score += 20;
        else if (music.coursesVal.slice(0, 5).some((race) => race.position <= 3)) score += 10;
        else score -= 5;
    }
    if (odds > 70) score -= 20;
    if (followerRatio >= 2.5 && odds >= 7) score += 40;
    else if (followerRatio >= 1.8) score += 20;
    if (music.signalDa === 'OUTSIDER_SURPRISE') score += 20;
    if (music.nbVictoires >= 2 && music.coursesVal.length >= 5) score += 15;

    return Math.min(100, Math.max(0, score));
}

function scoreEliteName(name, dictionary) {
    if (!name) {
        return { score: 0, name: null };
    }

    const normalized = String(name).toLowerCase();
    for (const [candidate, score] of Object.entries(dictionary)) {
        if (normalized.includes(candidate.toLowerCase())) {
            return { score, name: candidate };
        }
    }

    return { score: 0, name: null };
}

function average(values) {
    if (!values || values.length === 0) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round1(value) {
    return Math.round(value * 10) / 10;
}

module.exports = {
    scoreRunner
};
