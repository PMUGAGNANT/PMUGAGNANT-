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
    slug: "le-pmu-en-5-minutes",
    title: "Le PMU en 5 minutes : tout comprendre pour bien débuter",
    description:
      "Les bases absolues du PMU expliquées simplement. Idéal si vous n'avez jamais parié.",
    dateIso: "2026-04-01",
    readMinutes: 5,
    keywords: ["PMU", "débutant", "bases", "paris hippiques"],
    body: `## Qu'est-ce que le PMU ?

Le PMU (Pari Mutuel Urbain) organise les paris sur les courses de chevaux en France. Chaque jour, des courses ont lieu sur différents hippodromes. Vous pouvez parier sur le cheval que vous pensez voir gagner ou bien se classer.

## Les 3 disciplines principales

**Le Trot attelé** : le cheval tire un petit chariot (sulky) avec un jockey assis dedans. Il doit trotter sans jamais galoper, sinon il est disqualifié. C'est la discipline la plus populaire en France.

**Le Trot monté** : même principe mais le jockey est directement sur le cheval. Plus rare mais très spectaculaire.

**Le Galop (Plat)** : les chevaux courent le plus vite possible. C'est ce qu'on voit souvent dans les films. Les courses à obstacles (haies, steeple) sont une variante.

## Comment fonctionne une cote ?

La cote reflète combien le public parie sur un cheval. Plus un cheval est joué, plus sa cote baisse. La cote est aussi votre multiplicateur de gain.

**Exemple concret** : cote de 5.0 signifie que 2€ misés rapportent 10€ si le cheval gagne (ou se place, selon le type de pari).

## Par où commencer ?

Le plus simple pour débuter : le **pari Placé**. Votre cheval doit simplement finir dans les 3 premiers. C'est moins risqué qu'un pari Gagnant et ça vous permet d'apprendre en douceur.

Chez PMU Gagnant, on vous recommande exactement quel cheval jouer et quel type de pari choisir. Vous n'avez qu'à suivre le signal.`,
  },
  {
    slug: "gagnant-place-couple-quel-pari-choisir",
    title: "Gagnant, Placé, Couplé : quel pari choisir ?",
    description:
      "Guide complet des types de paris PMU. Quel pari pour quel profil de joueur ?",
    dateIso: "2026-04-02",
    readMinutes: 6,
    keywords: ["types de paris", "gagnant", "placé", "couplé", "quinté"],
    body: `## Le Pari Simple Placé (recommandé pour débuter)

Votre cheval doit finir dans les **3 premiers** (ou 2 premiers si moins de 8 partants). C'est le pari le plus sûr et celui que nous recommandons le plus souvent.

**Avantage** : vous avez 3 chances au lieu d'une seule. **Inconvénient** : les gains sont plus faibles qu'en Gagnant.

## Le Pari Simple Gagnant

Votre cheval doit finir **1er**. Plus risqué mais plus rémunérateur. Chez PMU Gagnant, on ne recommande le Gagnant que sur nos signaux les plus forts (confiance 8+/10).

## Le Couplé

Vous devez trouver **2 chevaux** parmi les premiers. Il existe le Couplé Gagnant (les 2 premiers dans l'ordre), le Couplé Placé (les 2 dans les 3 premiers, dans n'importe quel ordre) et le Couplé Ordre (les 2 premiers exactement dans l'ordre).

**Notre conseil** : le Couplé Placé est un bon compromis risque/gain.

## Le Trio et le Quinté+

Le **Trio** demande de trouver les 3 premiers. Le **Quinté+** demande les 5 premiers. Ces paris sont beaucoup plus difficiles mais les gains peuvent être énormes.

**Notre conseil** : réservez le Quinté aux jours où notre moteur identifie une course très lisible.

## Résumé par niveau

**Débutant** → Simple Placé uniquement
**Intermédiaire** → Simple Placé + Simple Gagnant sur les gros signaux
**Confirmé** → Ajoutez le Couplé Placé sur les courses lisibles`,
  },
  {
    slug: "comprendre-nos-pronostics",
    title: "Comment lire nos pronostics (sans être expert)",
    description:
      "Chaque terme de nos pronostics expliqué en français simple. Plus jamais perdu devant un signal.",
    dateIso: "2026-04-03",
    readMinutes: 5,
    keywords: ["pronostic", "comprendre", "signal", "confiance"],
    body: `## Le code couleur

Quand vous ouvrez PMU Gagnant, chaque course a une couleur :

🟢 **Coup sûr** — Notre meilleure opportunité du jour. On joue.
🟡 **Bonne opportunité** — Intéressant mais moins certain. À jouer avec prudence.
🔵 **À surveiller** — On attend le signal final avant de décider.
⚪ **Course à éviter** — Trop de risque, on ne joue pas.

## La barre de confiance

C'est notre thermomètre. Elle va de 0 à 10. Plus elle est remplie, plus notre moteur est sûr de son analyse.

**8-10** : Confiance très élevée. C'est rare, mais quand ça arrive, c'est notre meilleur signal.
**6-8** : Bonne confiance. Pari placé recommandé.
**4-6** : Confiance moyenne. On préfère surveiller.
**0-4** : On ne joue pas.

## "Pourquoi ce cheval ?"

Sous chaque pronostic, on vous explique en 3 points pourquoi notre moteur a choisi ce cheval. Par exemple : "En forme sur ses dernières courses", "Bon jockey qui connaît cette piste", "Course avec peu de concurrence".

## Le signal T-30 et T-10

Ce sont nos alertes envoyées 30 et 10 minutes avant le départ. Les cotes sont plus stables à ce moment, notre analyse est la plus fiable. Si vous devez ne suivre qu'un seul signal, c'est celui-là.

## Le gain potentiel

On vous indique combien vous pourriez gagner avec une mise de 5€. Attention : c'est un potentiel, pas une garantie.`,
  },
  {
    slug: "gerer-son-budget-turf",
    title: "Gérer son budget turf : la méthode qui protège votre portefeuille",
    description:
      "Les règles d'or de la gestion de bankroll. Comment parier sans se ruiner.",
    dateIso: "2026-04-03",
    readMinutes: 5,
    keywords: ["bankroll", "budget", "gestion", "discipline"],
    body: `## Règle n°1 : fixez un budget mensuel

Avant de commencer, décidez d'un montant que vous êtes **prêt à perdre entièrement**. 50€, 100€, 200€ — peu importe le montant, l'important est de ne jamais dépasser cette limite.

Ce budget s'appelle votre **bankroll**.

## Règle n°2 : jamais plus de 5% par pari

Si votre bankroll est de 100€, ne misez jamais plus de 5€ sur un seul pari. Cette règle vous protège des mauvaises séries (et il y en aura, même avec un bon moteur).

Chez PMU Gagnant, nos mises conseillées respectent toujours cette règle.

## Règle n°3 : pas de rattrapage

Vous venez de perdre 3 paris d'affilée. La tentation est de doubler la mise pour "se refaire". C'est la pire erreur possible. Gardez la même discipline, les résultats viendront sur le long terme.

## Règle n°4 : ne jouez pas tous les jours

Certains jours, notre moteur ne trouve aucune bonne opportunité. C'est normal et c'est même bon signe : mieux vaut ne pas jouer que jouer pour jouer.

## Règle n°5 : suivez vos résultats

Notez chaque pari, chaque gain, chaque perte. Au bout d'un mois, calculez votre ROI (retour sur investissement). C'est la seule façon de savoir si votre stratégie fonctionne.

Chez PMU Gagnant, on fait ce suivi pour vous avec le bilan hebdomadaire.`,
  },
  {
    slug: "les-erreurs-du-debutant",
    title: "Les 7 erreurs du débutant en paris hippiques",
    description:
      "Les pièges classiques à éviter quand on commence les paris PMU.",
    dateIso: "2026-04-03",
    readMinutes: 4,
    keywords: ["erreurs", "débutant", "pièges", "conseil"],
    body: `## Erreur n°1 : jouer toutes les courses

C'est l'erreur la plus courante. Plus vous jouez de courses, plus vous perdez statistiquement. La sélection est la clé.

## Erreur n°2 : suivre son instinct plutôt que les données

"J'aime bien le nom de ce cheval" n'est pas une stratégie. Les émotions sont l'ennemi du parieur.

## Erreur n°3 : miser gros après une victoire

Vous venez de gagner 50€ ? Félicitations. Mais ne remettez pas tout en jeu immédiatement. Respectez votre plan de bankroll.

## Erreur n°4 : ignorer le type de course

Une course à réclamer n'a rien à voir avec un Quinté+ du jour. La fiabilité de l'analyse varie selon le contexte.

## Erreur n°5 : ne parier qu'en Gagnant

Le pari Gagnant semble plus excitant, mais le Placé est statistiquement plus rentable sur le long terme.

## Erreur n°6 : ne pas tenir de comptabilité

Si vous ne savez pas combien vous avez misé et gagné sur le mois, vous ne savez pas si votre stratégie marche.

## Erreur n°7 : croire aux garanties

Aucun système ne garantit un gain. Quiconque vous promet 100% de réussite vous ment. Chez PMU Gagnant, on publie nos vrais résultats, gains ET pertes.`,
  },
  {
    slug: "lire-un-programme-pmu-sans-se-perdre",
    title: "Lire un programme PMU sans se perdre",
    description:
      "Filtrer le bruit, prioriser la décision et savoir quand ne pas jouer.",
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

Chez PMU Gagnant, l'objectif reste identique : **moins de paris, mieux cadrés**.`,
  },
  {
    slug: "quinte-value-bet-favori-fragile",
    title: "Quinté : opportunité value et favori fragile",
    description:
      "Comment repérer un marché qui sur-rémunère un outsider cohérent.",
    dateIso: "2026-03-22",
    readMinutes: 7,
    keywords: ["Quinté", "opportunité value", "pronostic turf"],
    body: `## Marché vs modèle

Le turf réagit à la masse, pas à ta lecture. Une **value** apparaît quand ta proba reste au-dessus de ce que la cote impose.

## Favori fragile

Indices classiques : peu de marge sur le terrain, progression récente perfectible, engagement costaud.

## Hygiène de jeu

Structure le quinté en bases / compléments, évite l'élargissement infini. **Aucune garantie de gain**, uniquement une meilleure lecture.`,
  },
  {
    slug: "mobile-first-parier-mieux",
    title: "Mobile first : parier mieux avec moins d'écran",
    description:
      "Pourquoi l'UX courte et lisible bat l'accumulation de stats.",
    dateIso: "2026-03-28",
    readMinutes: 4,
    keywords: ["paris mobiles", "UX turf", "décision"],
    body: `## Moins d'étapes

Sur mobile, chaque scroll coûte du temps. Une fiche course doit livrer **verdict, confiance et risques** avant le détail optionnel.

## Ce qu'on optimise

- hiérarchie visuelle ;
- boutons d'action clairs ;
- réduction du bruit.

L'application PMU Gagnant vise **décision rapide** sans sacrifier la profondeur.`,
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
