'use strict';

function normalizeTelegramMode(mode) {
    return String(mode || '').toLowerCase() === 'court' ? 'court' : 'normal';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatMorningScanTelegram(dateStr, recommendations = [], watchlist = [], telegramMode = 'normal', summary = {}) {
    const lines = [
        `<b>PMU AI - Analyse matinale ${escapeHtml(dateStr)}</b>`
    ];

    if (recommendations.length === 0 && watchlist.length === 0) {
        lines.push('Aucune selection exploitable ce matin.');
    } else {
        if (recommendations.length > 0) {
            lines.push('', '<b>SELECTIONS</b>');
            recommendations.slice(0, telegramMode === 'court' ? 3 : 8).forEach((item) => {
                lines.push(
                    `R${item.courseInfo?.reunion}C${item.courseInfo?.course} ${escapeHtml(item.courseInfo?.hippodrome || '')}: ` +
                    `N${item.selection?.runner?.numero} ${escapeHtml(item.selection?.runner?.nom || '')} ` +
                    `(${escapeHtml(String(item.selection?.profile || '').toUpperCase())}) ` +
                    `Confiance ${Number(item.scoreConfiance?.score || 0).toFixed(1)}/10`
                );
            });
        }

        if (watchlist.length > 0 && telegramMode !== 'court') {
            lines.push('', '<b>SURVEILLANCE</b>');
            watchlist.slice(0, 5).forEach((item) => {
                lines.push(
                    `R${item.courseInfo?.reunion}C${item.courseInfo?.course}: ` +
                    `N${item.selection?.runner?.numero} ${escapeHtml(item.selection?.runner?.nom || '')} ` +
                    `(${escapeHtml(String(item.selection?.profile || '').toUpperCase())})`
                );
            });
        }
    }

    if (summary && telegramMode !== 'court') {
        lines.push(
            '',
            `Analyses: <b>${summary.totalAnalyses || 0}</b> | Selections: <b>${summary.totalRecommendations || 0}</b>`,
            `Lisibles: <b>${summary.lisibilite?.LISIBLE || 0}</b> | Complexes: <b>${summary.lisibilite?.COMPLEXE || 0}</b> | Loterie: <b>${summary.lisibilite?.LOTERIE || 0}</b>`
        );
    }

    return lines.join('\n').trim();
}

module.exports = {
    formatMorningScanTelegram,
    normalizeTelegramMode
};
