export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  dateIso: string;
  readMinutes: number;
  keywords: string[];
  body: string;
};

export const blogPosts: BlogPost[] = [
  {
    slug: "lire-un-programme-pmu-sans-se-perdre",
    title: "Lire un programme PMU sans se perdre",
    description:
      "Filtrer le bruit, prioriser la décision et savoir quand ne pas jouer — même avec beaucoup de courses sur la journée.",
    dateIso: "2026-03-15",
    readMinutes: 6,
    keywords: ["programme PMU", "turf", "gestion bankroll"],
    body: `## Décider vite

Un bon programme ne sert pas à tout analyser : il sert à repérer **2 ou 3 lectures nettes** et à ignorer le reste sans FOMO.

## Signaux utiles

- **Lisibilité** : hiérarchie claire vs champ homogène.
- **Timing** : fenêtre 1 h / 30 min avant le départ pour des cotes plus stables.
- **Discipline** : ticket unique, mise plafonnée, pas de rattrapage.

## Erreurs fréquentes

Jouer pour « se faire plaisir » sur une course catalogue, multiplier les réunions sans edge, confondre **opinion** et **probabilité**.

Chez PMU Gagnant, l’objectif reste identique : **moins de paris, mieux cadrés**.`,
  },
  {
    slug: "quinte-value-bet-favori-fragile",
    title: "Quinté : value bet et favori fragile",
    description:
      "Comment repérer un marché qui sur-rémunère un outsider cohérent, et quand le favori peut lâcher sans surprise.",
    dateIso: "2026-03-22",
    readMinutes: 7,
    keywords: ["Quinté", "value bet", "pronostic turf"],
    body: `## Marché vs modèle

Le turf réagit à la masse, pas à ta lecture. Une **value** apparaît quand ta proba reste au-dessus de ce que la cote impose — avec des limites de liquidité.

## Favori fragile

Indices classiques : peu de marge sur le terrain, progression récente perfectible, engagement costaud. Ce n’est pas une vérité : c’est un **scénario à pondérer**.

## Hygiène de jeu

Structure le quinté en bases / compléments, évite l’élargissement infini. Le blog reste pédagogique : **aucune garantie de gain**, uniquement une meilleure lecture.`,
  },
  {
    slug: "mobile-first-parier-mieux",
    title: "Mobile first : parier mieux avec moins d’écran",
    description:
      "Pourquoi l’UX courte et lisible bat l’accumulation de stats quand le temps de décision est compté.",
    dateIso: "2026-03-28",
    readMinutes: 4,
    keywords: ["paris mobiles", "UX turf", "décision"],
    body: `## Moins d’étapes

Sur mobile, chaque scroll coûte du temps. Une fiche course doit livrer **verdict, confiance et risques** avant le détail optionnel.

## Ce qu’on optimise

- hiérarchie visuelle ;
- boutons d’action clairs ;
- réduction du bruit (graphismes sans signal).

L’application PMU Gagnant vise **décision rapide** sans sacrifier la profondeur pour ceux qui veulent creuser.`,
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
