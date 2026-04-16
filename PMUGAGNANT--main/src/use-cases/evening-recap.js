'use strict';

const { buildOperationalBetPlan, settleSelection } = require('../core/analysis/settlement');
const { formatPmuDate } = require('../core/utils/date');

async function runEveningRecap({
    date = new Date(),
    pmuApi,
    storage,
    telegram,
    force = false
}) {
    const dateStr = formatPmuDate(date);
    const bilansKey = `bilans/${dateStr}-modern.json`;
    const predictionBook = await storage.readJson(`predictions/${dateStr}-modern.json`);
    const recommendations = predictionBook?.recommendations || [];
    const watchlist = predictionBook?.watchlist || [];
    const allAnalyses = predictionBook?.allAnalyses || [];
    const previousRecap = await storage.readJson(bilansKey);

    if (recommendations.length === 0 && allAnalyses.length === 0) {
        const empty = {
            success: true,
            dateStr,
            totalSelections: 0,
            totalStake: 0,
            totalProfit: 0,
            roi: 0,
            races: [],
            predictionLog: []
        };

        if (telegram && (!previousRecap?.telegramSentAt || force)) {
            await telegram.sendMessage(`<b>PMU AI - BILAN ${dateStr}</b>\nAucune selection moderne aujourd'hui.`);
        }

        return empty;
    }

    const predictionLog = [];
    const races = [];
    let totalStake = 0;
    let totalProfit = 0;
    let wins = 0;
    let places = 0;
    let losses = 0;

    for (const item of recommendations) {
        const participants = await pmuApi.getParticipantsWithResults(dateStr, item.reunion, item.course);
        const arrivals = participants.filter((participant) => Number(participant.ordreArrivee) > 0);

        const selection = hydrateSelection(item, participants);
        if (!selection) {
            continue;
        }

        const plan = buildOperationalBetPlan({
            favori: item.favori,
            scoreConfiance: item.confiance,
            selection
        }, selection);
        const settlement = settleSelection(plan, selection, arrivals);

        totalStake += plan.stake;
        totalProfit += settlement.profit;
        if (settlement.won) wins += 1;
        if (settlement.placed) places += 1;
        if (!settlement.won && !settlement.placed) losses += 1;

        const logEntry = buildPredictionLogEntry(item, selection, plan, settlement, 'valide');
        predictionLog.push(logEntry);

        races.push({
            reunion: item.reunion,
            course: item.course,
            hippodrome: item.hippodrome,
            selection: {
                numero: selection.runner.numero,
                nom: selection.runner.nom,
                profile: selection.profile
            },
            plan,
            settlement
        });
    }

    for (const item of watchlist) {
        const participants = await pmuApi.getParticipantsWithResults(dateStr, item.reunion, item.course);
        const arrivals = participants.filter((participant) => Number(participant.ordreArrivee) > 0);
        const selection = hydrateSelection(item, participants);
        if (!selection) continue;

        const plan = buildOperationalBetPlan({
            favori: item.favori,
            scoreConfiance: item.confiance,
            selection
        }, selection);
        const settlement = settleSelection(plan, selection, arrivals);

        const logEntry = buildPredictionLogEntry(item, selection, plan, settlement, 'surveillance');
        predictionLog.push(logEntry);
    }

    for (const item of allAnalyses) {
        const alreadyLogged = predictionLog.some((entry) =>
            String(entry.reunion) === String(item.reunion)
            && String(entry.course) === String(item.course)
        );
        if (alreadyLogged) continue;

        const logEntry = {
            date: dateStr,
            reunion: item.reunion,
            course: item.course,
            hippodrome: item.hippodrome || '',
            cheval_predit: item.favori?.nom || '',
            numero: item.favori?.numero || '',
            score_cheval: item.confiance?.score || 0,
            confiance: item.confiance?.score || 0,
            qualite: item.pilotage?.score || 0,
            lisibilite: item.profils?.lisibilite || 'INCONNUE',
            value: 0,
            cote_matin: item.favori?.cote || null,
            cote_depart: null,
            decision: 'rejet',
            resultat_place: null,
            rapport_place: null,
            rapport_gagnant: null,
            roi_simule: 0
        };
        predictionLog.push(logEntry);
    }

    await storage.writeJson(`predictions/${dateStr}-log.json`, predictionLog);

    const roiByCategory = computeRoiByCategory(predictionLog);

    const result = {
        success: true,
        dateStr,
        totalSelections: races.length,
        wins,
        places,
        losses,
        winRate: races.length > 0 ? round1((wins / races.length) * 100) : 0,
        placeRate: races.length > 0 ? round1((places / races.length) * 100) : 0,
        lossRate: races.length > 0 ? round1((losses / races.length) * 100) : 0,
        totalStake: round2(totalStake),
        totalProfit: round2(totalProfit),
        roi: totalStake > 0 ? round2((totalProfit / totalStake) * 100) : 0,
        races,
        predictionLog,
        roiByCategory,
        surveillancePlaceRate: computeSurveillancePlaceRate(predictionLog)
    };

    if (telegram && previousRecap?.telegramSentAt && !force) {
        return {
            ...result,
            skipped: true,
            reason: 'duplicate_recap',
            previousSentAt: previousRecap.telegramSentAt
        };
    }

    if (telegram) {
        await telegram.sendMessage(buildEveningRecapMessage(result));
        result.telegramSentAt = new Date().toISOString();
    }

    await storage.writeJson(bilansKey, result);

    return result;
}

async function runWeeklyReport({
    date = new Date(),
    storage,
    telegram
}) {
    const logs = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(date);
        d.setDate(d.getDate() - i);
        const dateStr = formatPmuDate(d);
        const dayLog = await storage.readJson(`predictions/${dateStr}-log.json`);
        if (dayLog && Array.isArray(dayLog)) {
            logs.push(...dayLog);
        }
    }

    if (logs.length === 0) {
        return { success: true, empty: true };
    }

    const valides = logs.filter((l) => l.decision === 'valide');
    const surveillances = logs.filter((l) => l.decision === 'surveillance');
    const rejets = logs.filter((l) => l.decision === 'rejet');

    const roiValides = computeRoiFromLogs(valides);
    const roiSurveillances = computeRoiFromLogs(surveillances);

    const byHippodrome = {};
    valides.forEach((entry) => {
        const hippo = entry.hippodrome || 'Inconnu';
        if (!byHippodrome[hippo]) byHippodrome[hippo] = [];
        byHippodrome[hippo].push(entry);
    });
    const hippodromeRoi = {};
    for (const [hippo, entries] of Object.entries(byHippodrome)) {
        hippodromeRoi[hippo] = computeRoiFromLogs(entries);
    }

    const bestHippodrome = Object.entries(hippodromeRoi)
        .sort((a, b) => (b[1].roi || 0) - (a[1].roi || 0))[0];

    const byConfidence = {
        '6-7': valides.filter((l) => l.confiance >= 6 && l.confiance < 7),
        '7-8': valides.filter((l) => l.confiance >= 7 && l.confiance < 8),
        '8+': valides.filter((l) => l.confiance >= 8)
    };
    const roiByConfidence = {};
    for (const [range, entries] of Object.entries(byConfidence)) {
        roiByConfidence[range] = computeRoiFromLogs(entries);
    }

    const byReadability = {
        LISIBLE: valides.filter((l) => l.lisibilite === 'LISIBLE'),
        COMPLEXE: valides.filter((l) => l.lisibilite === 'COMPLEXE')
    };
    const roiByReadability = {};
    for (const [type, entries] of Object.entries(byReadability)) {
        roiByReadability[type] = computeRoiFromLogs(entries);
    }

    const weekNumber = getISOWeekNumber(date);
    const report = {
        success: true,
        weekNumber,
        totalCourses: logs.length,
        valides: valides.length,
        surveillances: surveillances.length,
        rejets: rejets.length,
        roiValides,
        roiSurveillances,
        roiByConfidence,
        roiByReadability,
        hippodromeRoi,
        bestHippodrome: bestHippodrome ? { name: bestHippodrome[0], roi: bestHippodrome[1].roi } : null
    };

    if (telegram) {
        await telegram.sendMessage(buildWeeklyReportMessage(report));
    }

    await storage.writeJson(`stats/weekly-${weekNumber}.json`, report);

    return report;
}

function buildPredictionLogEntry(item, selection, plan, settlement, decision) {
    return {
        date: item.dateStr || '',
        reunion: item.reunion,
        course: item.course,
        hippodrome: item.hippodrome || '',
        cheval_predit: selection.runner.nom || '',
        numero: selection.runner.numero,
        score_cheval: Number(item.confiance?.score) || 0,
        confiance: Number(item.confiance?.score) || 0,
        qualite: Number(item.pilotage?.score) || 0,
        lisibilite: item.profils?.lisibilite || 'INCONNUE',
        value: Number(selection.valueIndex) || 0,
        cote_matin: item.favori?.cote || null,
        cote_depart: selection.runner.coteTempsReel || selection.runner.cote || null,
        decision,
        resultat_place: settlement.placed || false,
        rapport_place: settlement.placed ? round2(plan.stake * Math.max(1.1, (plan.odds || 0) * 0.3)) : null,
        rapport_gagnant: settlement.won ? round2(plan.stake * (plan.odds || 0)) : null,
        roi_simule: plan.stake > 0 ? round2((settlement.profit / plan.stake) * 100) : 0,
        profile: selection.profile || ''
    };
}

function computeRoiByCategory(predictionLog) {
    const byDecision = {};
    predictionLog.forEach((entry) => {
        const key = entry.decision || 'inconnu';
        if (!byDecision[key]) byDecision[key] = [];
        byDecision[key].push(entry);
    });

    const result = {};
    for (const [decision, entries] of Object.entries(byDecision)) {
        result[decision] = computeRoiFromLogs(entries);
    }
    return result;
}

function computeRoiFromLogs(entries) {
    if (!entries || entries.length === 0) {
        return { count: 0, placed: 0, placeRate: 0, roi: 0, totalStake: 0, totalProfit: 0 };
    }

    const placed = entries.filter((e) => e.resultat_place).length;
    const totalRoi = entries.reduce((sum, e) => sum + (e.roi_simule || 0), 0);

    return {
        count: entries.length,
        placed,
        placeRate: round1((placed / entries.length) * 100),
        roi: round2(totalRoi / entries.length)
    };
}

function computeSurveillancePlaceRate(predictionLog) {
    const surveillances = predictionLog.filter((e) => e.decision === 'surveillance');
    if (surveillances.length === 0) return 0;
    const placed = surveillances.filter((e) => e.resultat_place).length;
    return round1((placed / surveillances.length) * 100);
}

function hydrateSelection(item, participants) {
    if (!item?.selection?.runner?.numero && !item?.selection?.numero) {
        return null;
    }

    const numero = item.selection.runner?.numero || item.selection.numero;
    const participant = (participants || []).find((entry) => String(entry.numPmu) === String(numero));

    return {
        profile: item.selection.profile || item.selection.profil || 'beton',
        valueIndex: Number(item.selection.valueIndex) || 0,
        runner: {
            numero,
            nom: participant?.nom || item.selection.runner?.nom || item.selection.cheval || item.favori?.nom || '',
            cote: participant?.cote || item.selection.runner?._cote || item.selection.runner?.cote || item.favori?.cote || null,
            coteTempsReel: participant?.cote || null
        }
    };
}

function buildEveningRecapMessage(result) {
    const lines = [
        `<b>PMU AI v9.2 - BILAN ${result.dateStr}</b>`,
        `Selections: <b>${result.totalSelections}</b>`,
        `Places: <b>${result.places}</b> | Gagnants: <b>${result.wins}</b>`,
        `Taux gagne: <b>${result.winRate}%</b> | Taux place: <b>${result.placeRate}%</b> | Taux perdu: <b>${result.lossRate}%</b>`,
        `Mise: <b>${result.totalStake}</b> | Profit: <b>${result.totalProfit}</b> | ROI: <b>${result.roi}%</b>`
    ];

    if (result.surveillancePlaceRate > 0) {
        lines.push(`Surveillances placees: <b>${result.surveillancePlaceRate}%</b>`);
    }

    result.races.slice(0, 8).forEach((race) => {
        lines.push(
            '',
            `R${race.reunion}C${race.course} ${escapeHtml(race.hippodrome || '')}`,
            `N${race.selection.numero} ${escapeHtml(race.selection.nom || '')} (${escapeHtml(String(race.selection.profile).toUpperCase())})`,
            `Resultat: <b>${escapeHtml(race.settlement.result)}</b> | Profit: <b>${race.settlement.profit}</b>`
        );
    });

    return lines.join('\n').trim();
}

function buildWeeklyReportMessage(report) {
    const lines = [
        `<b>📊 BILAN HEBDO PMU AI v9.2 — Sem. ${report.weekNumber}</b>`,
        '',
        `Courses analysees: <b>${report.totalCourses}</b>`,
        `Validees: <b>${report.valides}</b> | Surveillances: <b>${report.surveillances}</b> | Rejetees: <b>${report.rejets}</b>`,
        `ROI validees: <b>${report.roiValides.roi}%</b> | ROI surveillances: <b>${report.roiSurveillances.roi}%</b>`,
        `Taux place validees: <b>${report.roiValides.placeRate}%</b> | Taux place surveillances: <b>${report.roiSurveillances.placeRate}%</b>`
    ];

    if (report.bestHippodrome) {
        lines.push(`Meilleur hippodrome: <b>${escapeHtml(report.bestHippodrome.name)}</b> (ROI ${report.bestHippodrome.roi}%)`);
    }

    lines.push('', '<b>ROI par confiance:</b>');
    for (const [range, data] of Object.entries(report.roiByConfidence || {})) {
        if (data.count > 0) {
            lines.push(`  ${range}: ROI <b>${data.roi}%</b> (${data.count} courses, ${data.placeRate}% place)`);
        }
    }

    lines.push('', '<b>ROI par lisibilite:</b>');
    for (const [type, data] of Object.entries(report.roiByReadability || {})) {
        if (data.count > 0) {
            lines.push(`  ${type}: ROI <b>${data.roi}%</b> (${data.count} courses, ${data.placeRate}% place)`);
        }
    }

    return lines.join('\n').trim();
}

function getISOWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return Math.round(((d - week1) / 86400000 + 1) / 7);
}

function round2(value) {
    return Math.round((value || 0) * 100) / 100;
}

function round1(value) {
    return Math.round((value || 0) * 10) / 10;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

module.exports = {
    runEveningRecap,
    runWeeklyReport
};
