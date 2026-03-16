'use strict';

const { formatPmuDate } = require('../core/utils/date');
const { runRaceAnalysis } = require('./analyze-race');

async function runPreRaceAlert({
    date = new Date(),
    reunion,
    course,
    hippodrome = '',
    discipline = 'trot',
    pmuApi,
    storage,
    telegram,
    weather,
    force = false
}) {
    const dateStr = formatPmuDate(date);

    const morningPrediction = storage
        ? await storage.readJson(`predictions/${dateStr}-modern.json`)
        : null;
    const morningData = findMorningAnalysis(morningPrediction, reunion, course);

    const result = await runRaceAnalysis({
        date,
        reunion,
        course,
        hippodrome,
        discipline,
        pmuApi,
        storage,
        telegram,
        weather,
        sendTelegram: false,
        telegramMode: 'court'
    });

    if (!result || result.skipped) {
        return result || { success: false, skipped: true, reason: 'analysis_unavailable' };
    }

    const analysis = result.analyse;

    const oddsVariations = computeOddsVariations(analysis, morningData);
    const confidenceAdjustment = computeConfidenceAdjustment(oddsVariations, analysis);
    const adjustedConfidence = Math.min(10, Math.max(0,
        (Number(analysis.scoreConfiance?.score) || 0) + confidenceAdjustment.totalBonus
    ));

    analysis._preRaceUpdate = {
        oddsVariations,
        confidenceAdjustment,
        originalConfidence: analysis.scoreConfiance?.score || 0,
        adjustedConfidence,
        morningDataAvailable: Boolean(morningData)
    };

    if (analysis.scoreConfiance) {
        analysis.scoreConfiance.scoreAvantMaj = analysis.scoreConfiance.score;
        analysis.scoreConfiance.score = Math.round(adjustedConfidence * 10) / 10;
    }

    const hasSignals = Boolean(
        analysis.selection
        || (analysis.mouvementsCotes?.alertes || []).length > 0
        || (analysis.mouvementsCotes?.signaux || []).length > 0
        || oddsVariations.length > 0
    );

    if (!hasSignals) {
        return {
            success: true,
            skipped: true,
            reason: 'no_actionable_signal',
            analyse: analysis
        };
    }

    const alertKey = `alerts/${dateStr}-R${reunion}C${course}.json`;
    const signature = buildAlertSignature(analysis);
    const previousAlert = storage ? await storage.readJson(alertKey) : null;

    if (!force && previousAlert?.signature === signature) {
        return {
            success: true,
            skipped: true,
            reason: 'duplicate_alert',
            analyse: analysis,
            previousAlert
        };
    }

    const message = buildPreRaceAlertMessage(analysis, oddsVariations);
    if (telegram) {
        await telegram.sendMessage(message);
    }

    if (storage) {
        await storage.writeJson(alertKey, {
            dateStr,
            reunion,
            course,
            signature,
            sentAt: new Date().toISOString(),
            selection: analysis.selection || null,
            oddsVariations,
            adjustedConfidence
        });
    }

    return {
        success: true,
        sent: true,
        analyse: analysis,
        oddsVariations,
        adjustedConfidence
    };
}

function findMorningAnalysis(predictionBook, reunion, course) {
    if (!predictionBook) return null;

    const all = [
        ...(predictionBook.recommendations || []),
        ...(predictionBook.watchlist || []),
        ...(predictionBook.allAnalyses || [])
    ];

    return all.find((item) =>
        String(item.reunion) === String(reunion)
        && String(item.course) === String(course)
    ) || null;
}

function computeOddsVariations(analysis, morningData) {
    const variations = [];
    const runners = analysis.resultats || analysis.top5 || [];

    runners.slice(0, 8).forEach((runner) => {
        const currentOdds = Number(runner.coteTempsReel || runner.cote) || 0;
        const morningOdds = findMorningOdds(runner, morningData);

        if (!currentOdds || !morningOdds || morningOdds <= 0) return;

        const variationPct = Math.round(((currentOdds - morningOdds) / morningOdds) * 100);

        if (Math.abs(variationPct) < 10) return;

        let signal = 'STABLE';
        let significance = 'faible';

        if (variationPct <= -20) {
            signal = 'SIGNAL_FORT';
            significance = variationPct <= -35 ? 'tres_fort' : 'fort';
        } else if (variationPct >= 30) {
            signal = 'SIGNAL_NEGATIF';
            significance = variationPct >= 50 ? 'tres_negatif' : 'negatif';
        } else if (variationPct <= -10) {
            signal = 'BAISSE';
            significance = 'modere';
        } else if (variationPct >= 10) {
            signal = 'HAUSSE';
            significance = 'modere';
        }

        variations.push({
            numero: runner.numero || runner.numPmu,
            nom: runner.nom || '',
            coteMatin: morningOdds,
            coteActuelle: currentOdds,
            variationPct,
            signal,
            significance
        });
    });

    return variations.sort((a, b) => Math.abs(b.variationPct) - Math.abs(a.variationPct));
}

function findMorningOdds(runner, morningData) {
    if (!morningData) return null;

    if (morningData.favori && String(morningData.favori.numero) === String(runner.numero || runner.numPmu)) {
        return Number(morningData.favori.cote) || null;
    }

    const valueEntry = morningData.valueTop5?.[runner.numero || runner.numPmu];
    if (valueEntry?.cotePMU) {
        return Number(valueEntry.cotePMU) || null;
    }

    const prediction = morningData.predictionsCotes?.[runner.numero || runner.numPmu];
    if (prediction?.coteMatin) {
        return Number(prediction.coteMatin) || null;
    }

    return null;
}

function computeConfidenceAdjustment(oddsVariations, analysis) {
    let totalBonus = 0;
    const reasons = [];
    const selectionNumero = analysis.selection?.runner?.numero || analysis.favori?.numero;

    for (const variation of oddsVariations) {
        if (String(variation.numero) === String(selectionNumero)) {
            if (variation.variationPct <= -20) {
                totalBonus += 1.0;
                reasons.push(`Cote en forte baisse (${variation.variationPct}%) - argent des pros`);
            } else if (variation.variationPct >= 30) {
                totalBonus -= 1.5;
                reasons.push(`Cote en forte hausse (${variation.variationPct}%) - abandon du marche`);
            }
        }
    }

    const npSignals = (analysis.mouvementsCotes?.signaux || [])
        .filter((s) => s.type === 'NON_PARTANT' || s.type === 'NP');
    if (npSignals.length > 0) {
        totalBonus -= 0.3 * npSignals.length;
        reasons.push(`${npSignals.length} non-partant(s) detecte(s)`);
    }

    return { totalBonus: Math.round(totalBonus * 10) / 10, reasons };
}

function buildPreRaceAlertMessage(analysis, oddsVariations = []) {
    const confidence = analysis.scoreConfiance?.score ?? analysis.confiance?.score ?? null;
    const originalConfidence = analysis._preRaceUpdate?.originalConfidence ?? confidence;
    const lines = [
        `<b>🔄 MISE A JOUR T-10min — R${escapeHtml(String(analysis.courseInfo.reunion))}C${escapeHtml(String(analysis.courseInfo.course))}</b>`,
        `<b>${escapeHtml(analysis.courseInfo.hippodrome || 'Hippodrome inconnu')}</b>`,
        `Statut: <b>${analysis.selection ? 'SIGNAL ACTIF' : 'SURVEILLANCE'}</b>`,
        `Confiance: <b>${formatNumber(originalConfidence, 1)}</b> => <b>${formatNumber(confidence, 1)}/10</b> | Lisibilite: <b>${escapeHtml(analysis.profils?.lisibilite || 'INCONNUE')}</b>`
    ];

    if (analysis.selection) {
        const runner = analysis.selection.runner;
        lines.push(
            '',
            `<b>CHEVAL A JOUER</b>`,
            `N${runner.numero} ${escapeHtml(runner.nom || '')} (${escapeHtml(String(analysis.selection.profile || '').toUpperCase())})`,
            `Value: <b>${formatNumber(analysis.selection.valueIndex, 2)}x</b>`
        );
    }

    if (oddsVariations.length > 0) {
        lines.push('', '<b>VARIATIONS DE COTES</b>');
        oddsVariations.slice(0, 5).forEach((v) => {
            const arrow = v.variationPct < 0 ? '📉' : '📈';
            const signalLabel = v.signal === 'SIGNAL_FORT' ? '⚡ SIGNAL FORT'
                : v.signal === 'SIGNAL_NEGATIF' ? '⚠️ SIGNAL NEGATIF'
                : v.variationPct < 0 ? 'Baisse' : 'Hausse';
            lines.push(
                `${arrow} N${v.numero} ${escapeHtml(v.nom)}: ${v.coteMatin} => ${v.coteActuelle} (${v.variationPct > 0 ? '+' : ''}${v.variationPct}%) ${signalLabel}`
            );
        });
    }

    const adjustReasons = analysis._preRaceUpdate?.confidenceAdjustment?.reasons || [];
    if (adjustReasons.length > 0) {
        lines.push('', '<b>AJUSTEMENTS</b>');
        adjustReasons.forEach((reason) => {
            lines.push(`- ${escapeHtml(reason)}`);
        });
    }

    const alerts = analysis.mouvementsCotes?.alertes || [];
    const signals = analysis.mouvementsCotes?.signaux || [];
    if (alerts.length > 0 || signals.length > 0) {
        lines.push('', '<b>MOUVEMENTS DE COTES</b>');
        alerts.slice(0, 3).forEach((item) => {
            lines.push(`- ${escapeHtml(item.message)}`);
        });
        signals.slice(0, 2).forEach((item) => {
            lines.push(`- ${escapeHtml(item.message)}`);
        });
    }

    const decision = confidence >= 6.0 && analysis.selection
        ? '✅ VALIDE => JOUER'
        : confidence >= 5.0
            ? '👀 SURVEILLANCE'
            : '❌ REJETE';
    lines.push('', `Decision: <b>${decision}</b>`);

    return lines.join('\n').trim();
}

function buildAlertSignature(analysis) {
    const selection = analysis.selection
        ? `${analysis.selection.profile}:${analysis.selection.runner.numero}:${formatNumber(analysis.selection.valueIndex, 2)}`
        : 'NO_SELECTION';
    const alerts = (analysis.mouvementsCotes?.alertes || []).map((item) => `${item.numero}:${item.variation}`).join('|');
    const signals = (analysis.mouvementsCotes?.signaux || []).map((item) => `${item.type}:${item.numero}:${item.variation}`).join('|');
    const adjustedConf = analysis._preRaceUpdate?.adjustedConfidence || 0;

    return [
        analysis.courseInfo?.reunion,
        analysis.courseInfo?.course,
        selection,
        alerts,
        signals,
        Math.round(adjustedConf * 10) / 10
    ].join('::');
}

function formatNumber(value, digits = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return 'N/A';
    }

    return numeric.toFixed(digits);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

module.exports = {
    runPreRaceAlert
};
