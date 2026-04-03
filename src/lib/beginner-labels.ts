/**
 * Beginner-friendly labels — PMU Gagnant
 *
 * Mapping central : termes techniques → français simple.
 * Utilisé quand le mode débutant est activé, ou pour les tooltips.
 */

/* ─── Score global ─── */

export interface BeginnerScoreLabel {
  label: string;
  emoji: string;
  explanation: string;
  advice: string;
  color: string;
}

export function interpretScoreForBeginner(score: number): BeginnerScoreLabel {
  if (score >= 9) {
    return {
      label: "Coup sûr du jour",
      emoji: "🟢",
      explanation: "Notre meilleure opportunité. Confiance très élevée.",
      advice: "C'est notre top prono. Misez avec discipline.",
      color: "#00FF88",
    };
  }
  if (score >= 7) {
    return {
      label: "Bonne opportunité",
      emoji: "🟡",
      explanation: "Course intéressante avec de bonnes chances.",
      advice: "Un bon rapport risque/gain. Pari placé recommandé.",
      color: "#00CC66",
    };
  }
  if (score >= 5) {
    return {
      label: "À surveiller",
      emoji: "🔵",
      explanation: "Potentiel mais incertitude plus élevée.",
      advice: "Attendez le signal T-30min avant de décider.",
      color: "#FFB800",
    };
  }
  return {
    label: "On passe",
    emoji: "⚪",
    explanation: "Trop de risque, on ne joue pas aujourd'hui.",
    advice: "Mieux vaut garder sa mise pour une meilleure opportunité.",
    color: "#9CA3AF",
  };
}

/* ─── Lisibilité ─── */

export function lisibiliteForBeginner(lis: string): {
  label: string;
  emoji: string;
  tooltip: string;
} {
  switch (lis) {
    case "LISIBLE":
      return {
        label: "Course claire",
        emoji: "🟢",
        tooltip:
          "Les favoris sont identifiables, le résultat est plus prévisible que la moyenne.",
      };
    case "COMPLEXE":
      return {
        label: "Course incertaine",
        emoji: "🟡",
        tooltip:
          "Plusieurs chevaux peuvent gagner, la lecture est moins évidente. On joue avec prudence.",
      };
    case "LOTERIE":
      return {
        label: "Loterie",
        emoji: "🔴",
        tooltip:
          "Impossible de dégager un favori clair. On ne joue pas ce type de course.",
      };
    default:
      return {
        label: "Analyse en cours",
        emoji: "⏳",
        tooltip: "Les données ne sont pas encore disponibles.",
      };
  }
}

/* ─── Décisions ─── */

export function decisionForBeginner(decision: string): {
  label: string;
  emoji: string;
  tooltip: string;
} {
  switch (decision) {
    case "VALIDE":
      return {
        label: "On joue !",
        emoji: "✅",
        tooltip: "Notre moteur a validé cette course. Le pari est recommandé.",
      };
    case "SURVEILLANCE":
      return {
        label: "À surveiller",
        emoji: "👀",
        tooltip:
          "La course est intéressante mais pas assez sûre. On attend le signal T-30min.",
      };
    case "REJET":
      return {
        label: "On passe",
        emoji: "⛔",
        tooltip: "Trop de risque. Gardez votre mise pour une meilleure course.",
      };
    default:
      return {
        label: "En attente",
        emoji: "⏳",
        tooltip: "L'analyse n'est pas encore terminée.",
      };
  }
}

/* ─── Types de pari ─── */

export function betTypeForBeginner(betType: string | null | undefined): {
  label: string;
  tooltip: string;
} {
  const u = (betType ?? "").toUpperCase();
  if (u === "GAGNANT") {
    return {
      label: "Gagnant",
      tooltip:
        "Votre cheval doit finir 1er. Plus risqué mais gain plus élevé.",
    };
  }
  if (u === "PLACE") {
    return {
      label: "Placé",
      tooltip:
        "Votre cheval doit finir dans les 3 premiers (ou 2 si moins de 8 partants). Moins risqué.",
    };
  }
  if (u === "COUPLE" || u === "COUPLE_GAGNANT") {
    return {
      label: "Couplé",
      tooltip: "Trouver les 2 premiers dans l'ordre ou le désordre.",
    };
  }
  if (u === "TRIO") {
    return {
      label: "Trio",
      tooltip: "Trouver les 3 premiers dans l'ordre ou le désordre.",
    };
  }
  return {
    label: betType ?? "Pari",
    tooltip: "Type de pari sur cette course.",
  };
}

/* ─── Glossaire complet ─── */

export interface GlossaryEntry {
  term: string;
  definition: string;
  example?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "Placé",
    definition:
      "Votre cheval doit finir dans les 3 premiers (ou 2 premiers si moins de 8 partants). Moins risqué que « Gagnant » mais gains plus faibles.",
    example: "Mise 2€ placé, cote 3.5 → vous gagnez 7€ si le cheval finit dans le top 3.",
  },
  {
    term: "Gagnant",
    definition:
      "Votre cheval doit finir 1er. Plus risqué mais gain plus élevé.",
    example: "Mise 2€ gagnant, cote 8.0 → vous gagnez 16€ s'il gagne.",
  },
  {
    term: "Cote",
    definition:
      "Le multiplicateur de votre mise. Plus la cote est haute, plus c'est risqué mais rémunérateur.",
    example: "Cote 5.0 signifie que 2€ misés rapportent 10€.",
  },
  {
    term: "Opportunité value",
    definition:
      "Un pari dont la cote est plus haute qu'elle ne devrait être. Comme acheter un produit soldé — vous payez moins que sa vraie valeur.",
  },
  {
    term: "Lisibilité",
    definition:
      "Notre mesure de la difficulté d'une course. Une course « lisible » a des favoris clairs. Une « loterie » est imprévisible.",
  },
  {
    term: "Confiance",
    definition:
      "Notre niveau de certitude sur un pronostic, de 0 à 10. Plus c'est haut, plus on est sûrs de notre analyse.",
  },
  {
    term: "Outsider",
    definition:
      "Un cheval avec une cote élevée (peu favori) mais qui a des chances cachées détectées par notre moteur.",
  },
  {
    term: "Trot attelé",
    definition:
      "Discipline où le jockey est assis dans un sulky (petit chariot tiré par le cheval). Le cheval doit trotter sans galoper.",
  },
  {
    term: "Trot monté",
    definition:
      "Le jockey est directement sur le cheval, qui trotte. Plus physique que l'attelé.",
  },
  {
    term: "Plat",
    definition:
      "Course de galop sur piste plate. Les chevaux courent le plus vite possible.",
  },
  {
    term: "Obstacle",
    definition:
      "Course avec des haies ou des obstacles à franchir. Plus imprévisible que le plat.",
  },
  {
    term: "Quinté+",
    definition:
      "La course star du jour avec une grosse cagnotte. Il faut trouver les 5 premiers dans l'ordre.",
  },
  {
    term: "Musique",
    definition:
      "L'historique des résultats récents d'un cheval. « 1a2312 » signifie : 1er, abandon, 2e, 3e, 1er, 2e.",
  },
  {
    term: "Non-partant (NP)",
    definition:
      "Un cheval déclaré au programme mais qui ne participe finalement pas. Peut changer toute la dynamique d'une course.",
  },
  {
    term: "Bankroll",
    definition:
      "Le budget total que vous réservez aux paris. Règle d'or : ne jamais miser plus de 5% de votre bankroll sur un seul pari.",
  },
  {
    term: "ROI",
    definition:
      "Retour sur investissement. Un ROI de +10% signifie que pour 100€ misés, vous avez gagné 110€ (10€ de profit).",
  },
  {
    term: "Signal T-10 / T-30",
    definition:
      "Notre alerte envoyée 10 ou 30 minutes avant le départ. Les cotes sont plus stables à ce moment, l'analyse est plus fiable.",
  },
  {
    term: "Favori fragile",
    definition:
      "Un cheval très joué (cote basse) mais que notre moteur juge moins solide qu'il n'y paraît. Attention piège !",
  },
  {
    term: "Ferrure",
    definition:
      "Le type de fer utilisé sous les sabots du cheval. Un changement de dernière minute peut être un signal positif ou négatif.",
  },
];

/* ─── Top facteurs en français simple ─── */

const FACTOR_TRANSLATIONS: Record<string, string> = {
  "Forme récente excellente": "En grande forme sur ses dernières courses",
  "Forme récente solide": "Régulier et fiable récemment",
  "Régularité élevée": "Termine souvent bien placé",
  "Victoire récente": "A gagné récemment — en confiance",
  "Série en cours": "Enchaîne les bons résultats",
  "Jockey/driver d'élite": "Piloté par un des meilleurs jockeys",
  "Entraîneur reconnu": "Préparé par un grand entraîneur",
  "Cote en baisse": "Les professionnels misent dessus (bon signe)",
  "Bon terrain": "La piste du jour lui convient parfaitement",
  "Distance adaptée": "C'est sa distance de prédilection",
  "Connaît l'hippodrome": "A déjà bien performé sur cette piste",
  "Repos optimal": "Bien reposé, prêt à performer",
  "Gains importants": "Un cheval d'expérience avec un beau palmarès",
  "Bonne position de départ": "Bien placé dans les stalles (avantage)",
  "Poids favorable": "Porte un poids léger (avantage en plat)",
};

export function translateFactor(rawFactor: string): string {
  return FACTOR_TRANSLATIONS[rawFactor] ?? rawFactor;
}

export function translateFactors(factors: string[]): string[] {
  return factors.map(translateFactor);
}

/* ─── Profils psychologiques en français simple ─── */

export function profileStatusForBeginner(status: string): {
  label: string;
  tooltip: string;
} {
  switch (status) {
    case "SIGNAL_FORT":
      return {
        label: "Super signal",
        tooltip: "Tous les voyants sont au vert. C'est notre meilleur pari.",
      };
    case "FAVORI_DANGEREUX":
      return {
        label: "Attention au favori",
        tooltip:
          "Le cheval le plus joué n'est pas forcément le meilleur. Notre moteur détecte une faiblesse.",
      };
    case "OPPORTUNITE_CACHEE":
      return {
        label: "Pépite cachée",
        tooltip:
          "Un cheval sous-estimé par le public mais détecté par notre moteur.",
      };
    case "COURSE_PIEGE":
      return {
        label: "Course piège",
        tooltip:
          "Beaucoup de partants et un résultat difficile à prédire. Prudence.",
      };
    case "A_EVITER":
      return {
        label: "À éviter",
        tooltip: "Trop de risque. On garde sa mise pour plus tard.",
      };
    default:
      return {
        label: "En analyse",
        tooltip: "Le moteur étudie cette course.",
      };
  }
}

/* ─── Explication simple du score ELO ─── */

export function eloForBeginner(eloGlobal: number): {
  label: string;
  tooltip: string;
} {
  if (eloGlobal >= 8) {
    return {
      label: "Très fiable",
      tooltip: "Notre analyse est très sûre d'elle sur cette course.",
    };
  }
  if (eloGlobal >= 6) {
    return {
      label: "Fiable",
      tooltip: "Bon niveau de confiance dans notre analyse.",
    };
  }
  if (eloGlobal >= 4) {
    return {
      label: "Moyenne",
      tooltip: "Confiance modérée — restez prudent.",
    };
  }
  return {
    label: "Incertain",
    tooltip: "Analyse peu fiable sur cette course.",
  };
}
