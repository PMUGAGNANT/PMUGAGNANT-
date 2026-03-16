# PMU HIPPIQUE AI v9.2 VMAX

## PROMPT DE MISE À JOUR POUR PHILIPPE

**15 mars 2026 — Correctifs critiques + nouvelles fonctions**

---

## CONTEXTE DU PROBLÈME

L'algorithme v9.1 VMAX ne valide quasiment jamais de pronostic. Sur une journée type (15 mars 2026, 34 courses analysées) : **0 pronostic validé**, confiance moyenne de **4.3/10**, et seulement **3 courses en surveillance**. L'algo est trop restrictif et le système de value betting est mal calibré. Voici les corrections à intégrer dans la v9.2.

---

## MODULE 1 — SCORE FINAL DE PARI (REFONTE)

### Problème

Actuellement un bon cheval dans une course illisible peut passer en « validé ». Un très bon cheval dans une course pourrie reste un mauvais pari.

### Solution : séparer `score_cheval` et `score_lisibilite`

Remplacer le score unique par deux scores indépendants, puis les combiner :

```
score_final_pari = score_cheval × coefficient_lisibilite
```

**Où `coefficient_lisibilite` vaut :**

| Type de course | Coefficient | Effet |
|---|---|---|
| **LISIBLE** | 1.0 | Score inchangé |
| **COMPLEXE** | 0.6 | Score réduit de 40% |
| **LOTERIE** | 0.0 | Jamais validé |

---

## MODULE 2 — PLAFONNEMENT ET CALIBRATION DE LA VALUE

### Problème

Des values à 9.27x apparaissent sur des courses complexes. C'est un faux signal : soit la conversion probabilité/cote est mal calibrée, soit il n'y a pas de plafonnement.

### Solution

1. **Plafonner la value affichée à 5.0x maximum** (au-delà, c'est suspect)
2. **Ne compter la value que si confiance ≥ 6.0 ET lisibilité ≥ LISIBLE**
3. **Appliquer un coefficient de réduction selon la difficulté :**

```
si course = COMPLEXE => value_effective = value × 0.5
si course = LOTERIE  => ignorer la value complètement
```

---

## MODULE 3 — ABAISSEMENT DES SEUILS DE VALIDATION

### Problème

L'algo ne valide quasiment jamais rien. Exemple : Joyeux du Landret avait une qualité de 85/100, une course lisible, et n'a pas passé le filtre final. **Un algo qui ne joue jamais est inutile.**

### Nouveaux seuils proposés

| Critère | Ancien seuil (v9.1) | Nouveau seuil (v9.2) |
|---|---|---|
| Confiance minimum | 7.0/10 (estimé) | **6.0/10** |
| Qualité minimum | 80/100 (estimé) | **70/100** |
| Lisibilité requise | LISIBLE uniquement | **LISIBLE ou COMPLEXE (avec malus)** |

---

## MODULE 4 — FILTRAGE OUTSIDERS HAUTE COTE

### Problème

Un outsider peut cocher quelques cases sans être vraiment jouable. Le mode outsider est trop permissif.

### Règles à ajouter pour les outsiders

1. **Course LISIBLE obligatoire** — jamais d'outsider en course complexe ou loterie
2. **Au moins 1 signal de marché OU 1 signal forme forte** (variation de cote, montée en puissance récente)
3. **Pas de pari gagnant** — seulement placé ou mini mise
4. **Maximum 1 outsider par réunion** — limiter l'exposition

---

## MODULE 5 — DEUXIÈME PASSE PRÉ-COURSE (NOUVEAU)

> ⚠️ **C'est la fonctionnalité la plus importante à ajouter.**

### Concept

L'algo fait actuellement UNE seule analyse le matin. Mais entre le matin et le départ, les cotes évoluent énormément (argent des pros, non-partants, changements de ferrure, etc.). Il faut ajouter une **DEUXIÈME PASSE automatique 10 minutes avant chaque course**.

### Fonctionnement

#### Étape 1 : Déclenchement automatique T-10min

Pour chaque course en surveillance ou validée, déclencher un re-scan automatique 10 minutes avant le départ.

#### Étape 2 : Récupérer les données fraîches

- **Cotes PMU en temps réel** (via API PMU ou scraping)
- **Non-partants déclarés** (un NP peut changer toute la dynamique)
- **Variations de cote significatives** (baisse = argent des pros, hausse = doute)
- **Changements de ferrure** (déferré/plaqué de dernière minute)

#### Étape 3 : Analyse des variations de cote

```javascript
// Calculer la variation entre cote du matin et cote T-10min
variation = (cote_actuelle - cote_matin) / cote_matin * 100

si variation < -20% => SIGNAL FORT (pros misent dessus)
                    => bonus confiance +1.0

si variation > +30% => SIGNAL NÉGATIF (abandon du marché)
                    => malus confiance -1.5
                    => retirer de la validation
```

#### Étape 4 : Alerte Telegram mise à jour

Envoyer un message Telegram mis à jour 10 min avant la course :

```
🔄 MISE À JOUR T-10min — R3C5 CHARTRES

N12 JOYEUX DU LANDRET
Cote matin: 8.5 => Cote actuelle: 5.2 (-39%)
⚠️ SIGNAL FORT : cote en forte baisse
Confiance ajustée: 6.5 => 7.5/10

Decision: ✅ VALIDÉ => JOUER PLACE
```

---

## MODULE 6 — AUTO-APPRENTISSAGE POST-COURSE (NOUVEAU)

### Concept

Après chaque course, l'algo doit automatiquement comparer sa prédiction au résultat réel et en tirer des leçons pour s'améliorer.

### Fonctionnement

#### Étape A : Logger chaque prédiction

Pour CHAQUE course analysée (validée, surveillance, ou rejetée), stocker en base de données :

```json
{
  "date": "...",
  "reunion": "...",
  "course": "...",
  "hippodrome": "...",
  "cheval_predit": "...",
  "numero": "...",
  "score_cheval": "...",
  "confiance": "...",
  "qualite": "...",
  "lisibilite": "...",
  "value": "...",
  "cote_matin": "...",
  "cote_depart": "...",
  "decision": "valide | surveillance | rejet",
  "resultat_place": "...",
  "rapport_place": "...",
  "rapport_gagnant": "...",
  "roi_simule": "..."
}
```

#### Étape B : Calculer le ROI réel par catégorie

Toutes les semaines, calculer automatiquement :

- **ROI par type de décision** (validé vs surveillance vs rejet)
- **ROI par niveau de confiance** (6-7, 7-8, 8+)
- **ROI par type de course** (lisible vs complexe)
- **ROI par hippodrome** (certains hippodromes sont plus prévisibles)
- **Taux de réussite des surveillances** (pour savoir si le filtre final est trop strict)

#### Étape C : Auto-ajustement des poids

Si, après 100 courses loggées, un pattern apparaît clairement :

```
// Exemple : les surveillances gagnent à 25%
// mais les validées ne gagnent qu'à 15%
// => Le filtre final est CONTRE-PRODUCTIF
// => Baisser le seuil automatiquement
```

#### Étape D : Rapport hebdomadaire Telegram

Chaque dimanche soir, envoyer un rapport automatique sur Telegram :

```
📊 BILAN HEBDO PMU AI v9.2 — Sem. 11

Courses analysées: 238
Validées: 12 | Surveillances: 28 | Rejetées: 198
ROI validées: +8.3% | ROI surveillances: +4.1%
Meilleur hippodrome: Vincennes (ROI +22%)
Signal T-10min: 5 alertes dont 3 gagnantes (60%)
```

---

## MODULE 7 — BASE DE DONNÉES CHEVAUX FAUTIFS

### Problème

Certains chevaux ont du talent mais fautent régulièrement (ex: Mystic des Thuyas, disqualifié à Laval le 04/02/2026). L'algo ne prend pas en compte l'historique de fautes.

### Solution

1. **Créer un champ `taux_faute`** = nombre de Da (disqualifié) sur les 10 dernières courses
2. **Si `taux_faute` > 30%** => appliquer un malus de confiance de **-1.5**
3. **Si `taux_faute` > 50%** => exclure automatiquement de la validation

---

## ORDRE DE PRIORITÉ D'IMPLÉMENTATION

Philippe, voici l'ordre dans lequel j'aimerais que tu implémentes les changements :

| # | Module | Priorité | Difficulté |
|---|---|---|---|
| **1** | Seuils de validation (M3) | 🔴 URGENTE | Facile (config) |
| **2** | Score final pari (M1) | 🔴 URGENTE | Moyen (logique) |
| **3** | Calibration value (M2) | 🟡 HAUTE | Moyen |
| **4** | Chevaux fautifs (M7) | 🟡 HAUTE | Facile |
| **5** | 2ème passe T-10min (M5) | 🟢 MOYENNE | Difficile (API/cron) |
| **6** | Outsiders (M4) | 🟢 MOYENNE | Moyen |
| **7** | Auto-apprentissage (M6) | 🟢 MOYENNE | Difficile (BDD) |

---

## RÉSUMÉ RAPIDE POUR PHILIPPE

**En une phrase par module :**

1. **M1 :** Séparer le score du cheval et la lisibilité de la course, les multiplier ensemble
2. **M2 :** Plafonner la value à 5x, la diviser par 2 en complexe, l'ignorer en loterie
3. **M3 :** Baisser les seuils : confiance 6.0 au lieu de 7.0, qualité 70 au lieu de 80
4. **M4 :** Outsiders uniquement en course lisible, 1 max par réunion, placé uniquement
5. **M5 :** Ajouter une 2ème analyse 10 min avant la course avec cotes en temps réel
6. **M6 :** Logger chaque prédiction vs résultat, calculer le ROI, auto-ajuster les poids
7. **M7 :** Créer un taux de faute par cheval, pénaliser les fautifs récurrents
