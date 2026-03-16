'use strict';

function buildScanSummary(analyses = [], recommendations = []) {
    const lisibilite = {
        LISIBLE: 0,
        COMPLEXE: 0,
        LOTERIE: 0,
        INCONNUE: 0
    };
    const decisions = {};
    const profiles = {
        beton: 0,
        pepite: 0,
        sniper: 0,
        braquage: 0
    };

    let confidenceTotal = 0;
    let confidenceCount = 0;
    let valueTotal = 0;
    let valueCount = 0;
    let underValuedFavorites = 0;
    let overValuedFavorites = 0;

    analyses.forEach((analysis) => {
        const readability = analysis.profils?.lisibilite || 'INCONNUE';
        lisibilite[readability] = (lisibilite[readability] || 0) + 1;

        const decision = analysis.recommandation?.decision || 'INCONNUE';
        decisions[decision] = (decisions[decision] || 0) + 1;

        if (analysis.profils?.beton) profiles.beton += 1;
        if (analysis.profils?.pepite) profiles.pepite += 1;
        if (analysis.profils?.sniper) profiles.sniper += 1;
        if (analysis.profils?.braquage) profiles.braquage += 1;

        if (Number.isFinite(analysis.scoreConfiance?.score)) {
            confidenceTotal += analysis.scoreConfiance.score;
            confidenceCount += 1;
        }

        const favoriteValue = analysis.valueTop5?.[analysis.favori?.numero];
        if (favoriteValue && Number.isFinite(favoriteValue.valueIndex)) {
            valueTotal += favoriteValue.valueIndex;
            valueCount += 1;

            if (favoriteValue.valueIndex >= 1.2) {
                underValuedFavorites += 1;
            } else if (favoriteValue.valueIndex < 0.9) {
                overValuedFavorites += 1;
            }
        }
    });

    const summary = {
        totalAnalyses: analyses.length,
        totalRecommendations: recommendations.length,
        tauxSelection: safeRatio(recommendations.length, analyses.length),
        confianceMoyenne: round1(safeRatio(confidenceTotal, confidenceCount)),
        valueMoyenneFavori: round2(safeRatio(valueTotal, valueCount)),
        lisibilite,
        decisions,
        profiles,
        favorisSousEstimes: underValuedFavorites,
        favorisSurcotes: overValuedFavorites
    };

    return {
        ...summary,
        calibrationHints: buildCalibrationHints(summary)
    };
}

function buildCalibrationHints(summary) {
    const hints = [];

    if (summary.totalAnalyses === 0) {
        hints.push('Aucune course analysee, impossible de calibrer');
        return hints;
    }

    if (summary.tauxSelection < 0.08) {
        hints.push('Filtrage tres dur: verifier seuils confiance/value');
    } else if (summary.tauxSelection > 0.35) {
        hints.push('Filtrage large: risque de bruit, resserrer les validations');
    }

    if (summary.lisibilite.LOTERIE > summary.totalAnalyses * 0.45) {
        hints.push('Beaucoup de courses loterie: renforcer le refus ou affiner la lisibilite');
    }

    if (summary.favorisSurcotes > summary.favorisSousEstimes * 1.5) {
        hints.push('Le marche surcote souvent les favoris: durcir la validation value');
    }

    if (summary.confianceMoyenne >= 7.8 && summary.totalRecommendations === 0) {
        hints.push('Confiance haute mais peu de selections: probablement trop strict sur la value ou les profils');
    }

    if ((summary.profiles.pepite + summary.profiles.sniper + summary.profiles.braquage) === 0 && summary.totalRecommendations > 0) {
        hints.push('Selections trop concentrees sur le favori: enrichir la detection des profils alternatifs');
    }

    if (hints.length === 0) {
        hints.push('Base saine: poursuivre avec backtests et calibrage par hippodrome');
    }

    return hints;
}

function buildAnalysisPilotage(analysis) {
    const favoriteValue = analysis.valueTop5?.[analysis.favori?.numero];
    const confidence = Number(analysis.scoreConfiance?.score) || 0;
    const valueIndex = Number(favoriteValue?.valueIndex) || 0;
    const profileCount = ['beton', 'pepite', 'sniper', 'braquage'].filter((key) => Boolean(analysis.profils?.[key])).length;

    let quality = 40;
    const reasons = [];

    if (analysis.recommandation?.vautLeCoup) {
        quality += 15;
        reasons.push('Decision exploitable');
    } else {
        reasons.push('Decision prudente');
    }

    if (confidence >= 8) {
        quality += 20;
        reasons.push('Confiance tres haute');
    } else if (confidence >= 7) {
        quality += 12;
        reasons.push('Confiance solide');
    } else if (confidence < 5.5) {
        quality -= 12;
        reasons.push('Confiance faible');
    }

    if (valueIndex >= 1.6) {
        quality += 18;
        reasons.push('Bonne value');
    } else if (valueIndex >= 1.2) {
        quality += 10;
        reasons.push('Value correcte');
    } else if (valueIndex < 0.9) {
        quality -= 18;
        reasons.push('Favori surcote');
    }

    if (analysis.profils?.lisibilite === 'LISIBLE') {
        quality += 12;
        reasons.push('Course lisible');
    } else if (analysis.profils?.lisibilite === 'LOTERIE') {
        quality -= 15;
        reasons.push('Course loterie');
    }

    quality += Math.min(10, profileCount * 3);
    if (profileCount > 0) {
        reasons.push(`${profileCount} profil(s) actif(s)`);
    }

    return {
        score: Math.max(0, Math.min(100, Math.round(quality))),
        label: getPilotageLabel(quality),
        raisons: reasons
    };
}

function getPilotageLabel(score) {
    if (score >= 80) return 'TRES SOLIDE';
    if (score >= 65) return 'SOLIDE';
    if (score >= 50) return 'MOYEN';
    if (score >= 35) return 'FRAGILE';
    return 'A RISQUE';
}

function safeRatio(value, total) {
    if (!total) {
        return 0;
    }

    return value / total;
}

function round1(value) {
    return Math.round((value || 0) * 10) / 10;
}

function round2(value) {
    return Math.round((value || 0) * 100) / 100;
}

module.exports = {
    buildAnalysisPilotage,
    buildCalibrationHints,
    buildScanSummary
};
