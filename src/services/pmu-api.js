/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const { getRuntimeConfig } = require('../config/env');

const BASE_URL = 'https://online.turfinfo.api.pmu.fr/rest/client/1';

async function fetchPmuJson(path, revalidateSeconds = 60) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getRuntimeConfig().requestTimeoutMs);

    try {
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'pmu-ai-legacy-bridge/1.0'
            },
            signal: controller.signal,
            next: { revalidate: revalidateSeconds }
        });

        if (!response.ok) {
            throw new Error(`PMU API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

function toParisHour(ms) {
    if (!ms) {
        return '';
    }

    return new Date(ms).toLocaleTimeString('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function hasQuinteOffer(course) {
    if (Boolean(course?.grandPrixNationalTrot)) {
        return true;
    }

    const categorieParticularite = String(course?.categorieParticularite ?? '').toUpperCase();
    if (categorieParticularite.includes('QUINTE')) {
        return true;
    }

    const paris = Array.isArray(course?.paris) ? course.paris : [];
    if (
        paris.some((pari) => {
            const pariType = String(pari?.typePari ?? pari?.codePari ?? '').toUpperCase();
            return pariType.includes('QUINTE') || pari?.nouveauQuinte === true;
        })
    ) {
        return true;
    }

    const cagnottes = Array.isArray(course?.cagnottes) ? course.cagnottes : [];
    return cagnottes.some((cagnotte) =>
        String(cagnotte?.typePari ?? cagnotte?.codePari ?? '').toUpperCase().includes('QUINTE')
    );
}

function normalizeOdds(rawValue) {
    if (typeof rawValue !== 'number' || Number.isNaN(rawValue)) {
        return null;
    }

    return rawValue > 100 ? rawValue / 100 : rawValue;
}

function mapParticipant(raw) {
    const rawValue = raw?.coteDirect?.cotePmu
        ?? raw?.dernierRapportDirect?.rapport
        ?? raw?.rapportDirect?.rapport
        ?? raw?.cotePmu
        ?? null;
    const cote = normalizeOdds(rawValue);
    const coteMatin = typeof raw?.coteMatin === 'number'
        ? raw.coteMatin
        : typeof raw?.coteReference === 'number'
            ? raw.coteReference
            : cote;

    return {
        numPmu: Number(raw?.numPmu ?? 0),
        nom: String(raw?.nom ?? ''),
        driver: String(raw?.driver ?? raw?.driverPrincipal ?? ''),
        entraineur: String(raw?.entraineur ?? raw?.entraineurPrincipal ?? ''),
        jockey: String(raw?.jockey ?? raw?.jockeyPrincipal ?? raw?.driver ?? ''),
        age: Number(raw?.age ?? 0),
        sexe: String(raw?.sexe ?? ''),
        cote,
        coteMatin,
        coteTempsReel: cote,
        musique: String(raw?.musique ?? ''),
        nombreCourses: Number(raw?.nombreCourses ?? raw?.nombreCoursesDuCheval ?? 0),
        nombreVictoires: Number(raw?.nombreVictoires ?? 0),
        nombrePlaces: Number(raw?.nombrePlaces ?? 0),
        gainCarriere: Number(raw?.gainsParticipant?.gainsCarriere ?? 0) + Number(raw?.gainsParticipant?.gainsAnneeEnCours ?? 0),
        nombreSuiveurs: Number(raw?.nombreIndicateursFavoris ?? raw?.nombreSuiveurs ?? 0),
        ordreArrivee: typeof raw?.ordreArrivee === 'number' ? Number(raw.ordreArrivee) : null,
        statut: String(raw?.statut ?? ''),
        placeCorde: typeof raw?.placeCorde === 'number' ? raw.placeCorde : null,
        stalle: typeof raw?.stalle === 'number' ? raw.stalle : null,
        poids: typeof raw?.poids === 'number' ? raw.poids : null,
        ferrure: typeof raw?.ferrure === 'string' ? raw.ferrure : null,
        nonPartant: String(raw?.statut ?? '') !== 'PARTANT'
    };
}

async function getAllRaces(dateStr) {
    const data = await fetchPmuJson(`/programme/${dateStr}`);
    const reunions = data?.programme?.reunions || [];
    const races = [];

    reunions.forEach((reunion) => {
        const reunionNumber = Number(reunion?.numOfficiel ?? 0);
        const hippodrome = String(reunion?.hippodrome?.libelleCourt ?? '');
        const pays = String(reunion?.pays?.code ?? '');

        (reunion?.courses || []).forEach((course) => {
            const discipline = String(course?.discipline ?? '');
            races.push({
                dateStr,
                reunion: reunionNumber,
                course: Number(course?.numOrdre ?? 0),
                hippodrome,
                pays,
                nomCourse: String(course?.libelle ?? course?.libelleCourt ?? ''),
                heureDepart: toParisHour(Number(course?.heureDepart ?? 0)),
                discipline,
                estTrot: discipline.includes('TROT'),
                estPlat: discipline === 'PLAT',
                estQuinte: hasQuinteOffer(course),
                allocation: Number(course?.montantTotalOffert ?? 0),
                distance: Number(course?.distance ?? 0),
                nombrePartants: Number(course?.nombreDeclaresPartants ?? 0)
            });
        });
    });

    return races.sort((left, right) => String(left.heureDepart).localeCompare(String(right.heureDepart)));
}

async function getParticipants(dateStr, reunion, course) {
    const data = await fetchPmuJson(`/programme/${dateStr}/R${reunion}/C${course}/participants`);
    return (data?.participants || [])
        .filter((participant) => String(participant?.statut ?? 'PARTANT') !== 'SUPPRIME')
        .map(mapParticipant);
}

async function getParticipantsWithResults(dateStr, reunion, course) {
    return getParticipants(dateStr, reunion, course);
}

async function getCourseConditions(dateStr, reunion, course) {
    try {
        const data = await fetchPmuJson(`/programme/${dateStr}/R${reunion}/C${course}`);
        return {
            hippodrome: String(data?.reunion?.hippodrome?.libelleCourt ?? data?.hippodrome?.libelleCourt ?? ''),
            estQuinte: hasQuinteOffer(data?.course ?? {})
        };
    } catch {
        return {};
    }
}

async function getRealtimeOdds(dateStr, reunion, course) {
    try {
        const data = await fetchPmuJson(`/programme/${dateStr}/R${reunion}/C${course}/rapports-definitifs`, 30);
        const reports = {};

        (data?.rapports || []).forEach((rapport) => {
            if (!String(rapport?.typePari ?? '').includes('SIMPLE_GAGNANT')) {
                return;
            }

            (rapport?.combinaisons || []).forEach((combinaison) => {
                const numPmu = typeof combinaison?.numPmu === 'number'
                    ? combinaison.numPmu
                    : Array.isArray(combinaison?.combinaison)
                        ? Number(combinaison.combinaison[0])
                        : null;
                const rapportValue = normalizeOdds(combinaison?.rapport ?? combinaison?.pourUnEuro ?? null);

                if (numPmu !== null && rapportValue) {
                    reports[numPmu] = rapportValue;
                }
            });
        });

        return reports;
    } catch {
        return {};
    }
}

const pmuApiService = {
    getAllRaces,
    getCourseConditions,
    getParticipants,
    getParticipantsWithResults,
    getRealtimeOdds
};

module.exports = {
    pmuApiService
};
