'use strict';

const ALGORITHM_CONFIG = {
    minimumProfitableOdds: 1.6,
    fragileFavoriteThreshold: 55,
    confidenceMinimum: 6.0,
    valueMinimum: 1.15,
    pilotageMinimum: 48,
    qualiteMinimum: 70,
    readabilityCoefficients: {
        LISIBLE: 1.0,
        COMPLEXE: 0.6,
        LOTERIE: 0.0
    },
    profileThresholds: {
        beton: {
            fiabilite: 0.78,
            score: 55,
            minOdds: 1.8,
            maxOdds: 5.5
        },
        pepite: {
            minOdds: 5,
            maxOdds: 18,
            valueIndex: 2.2,
            fiabilite: 0.62,
            score: 48
        },
        sniper: {
            minOdds: 7,
            maxOdds: 15,
            fiabilite: 0.6,
            score: 52
        },
        braquage: {
            minOdds: 28,
            maxOdds: 60,
            valueIndex: 2.4,
            fiabilite: 0.45,
            score: 32
        }
    },
    hippodromeCalibration: {
        positive: {
            "HIPPODROME D'ENGHIEN SOISY": { confidence: 0.2, pilotage: 3 },
            'HIPPODROME DE CAGNES/MER': { confidence: 0.2, pilotage: 3 },
            'HIPPODROME DE TOULOUSE LA CEPIERE': { confidence: 0.2, pilotage: 2 }
        },
        negative: {
            'HIPPODROME DE PARIS-VINCENNES': { confidence: -0.4, pilotage: -8, allowOnlyBeton: true },
            'HIPPODROME DE REIMS': { confidence: -0.3, pilotage: -6, allowOnlyBeton: true },
            'HIPPODROME DE VICHY': { confidence: -0.2, pilotage: -4, allowOnlyBeton: true }
        }
    },
    recommendations: {
        playFavorite: { label: 'JOUEZ LE FAVORI', emoji: '🟢' },
        favoriteWithCaution: { label: 'FAVORI JOUABLE AVEC PRUDENCE', emoji: '🟡' },
        playAlternative: { label: 'JOUEZ ALTERNATIF GAGNANT', emoji: '🔴' },
        avoidRace: { label: 'COURSE A EVITER', emoji: '⛔' }
    },
    antiPatterns: {
        longBreak: -8,
        disqualifications: -3,
        abandonments: -5,
        formDrop: -7,
        badTrotDraw: -4,
        worseFlatDraw: -5,
        driverChange: -3
    },
    confidenceStakeLevels: {
        veryHigh: { threshold: 8.5, stake: 4, type: 'Gagnant simple' },
        high: { threshold: 7.5, stake: 3, type: 'Place' },
        medium: { threshold: 6.8, stake: 2, type: 'Place' }
    },
    trackBias: {
        confidenceBonus: 1.0,
        oppositeBiasPenalty: -0.8
    },
    scoringWeights: {
        trot: {
            forme_5courses: 10,
            placements_consecutifs: 18,
            victoire_recente: 15,
            progression_forme: 12,
            driver_elite: 9,
            duo_driver_entraineur: 6,
            position_depart: 5,
            age_optimal: 5,
            gain_carriere_niveau: 3,
            taux_victoire_global: 2
        },
        plat: {
            forme_5courses: 12,
            victoire_recente: 15,
            progression_3eme: 14,
            progression_forme: 10,
            jockey_elite: 10,
            entraineur_elite: 8,
            meme_parcours_exact: 16,
            amelioration_corde: 8,
            age_optimal: 5,
            taux_victoire_global: 2
        }
    },
    eliteDrivers: {
        Bazire: 10,
        Duvaldestin: 10,
        Abrivard: 10,
        Nivard: 9,
        Raffin: 9,
        Mottier: 8,
        Bigeon: 8,
        Monclin: 7
    },
    eliteJockeys: {
        Demuro: 10,
        Soumillon: 10,
        Lemaire: 10,
        Guyon: 9,
        Barzalona: 9,
        Pasquier: 9,
        Dettori: 10,
        Buick: 9,
        Murphy: 9
    },
    eliteTrainers: {
        Martens: 10,
        Rouget: 10,
        Fabre: 10,
        Bigeon: 9,
        Delcher: 9,
        Lamy: 8,
        Ferland: 7
    }
};

module.exports = {
    ALGORITHM_CONFIG
};
