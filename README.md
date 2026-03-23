# PMU AI v9.2

Version 9.2 du moteur de pronostics PMU pour Next.js + TypeScript + Supabase.

Cette version corrige la logique trop restrictive de la v9.1 en separant la
qualite intrinsique d'un cheval de la lisibilite reelle d'une course, puis en
pilotant les validations, les outsiders, la seconde passe T-10 et
l'auto-apprentissage depuis Supabase.

## Stack

- Next.js App Router
- TypeScript
- Supabase PostgreSQL
- Vercel Cron
- Telegram Bot API

## Dossiers principaux

- `src/lib/pmu-api.ts`
  - scraping / collecte des donnees PMU
  - partants
  - cotes matinales / depart
  - rapports definitifs
- `src/lib/predictions.ts`
  - moteur v9.2 de calcul
  - score cheval
  - lisibilite
  - value
  - filtrage outsiders
- `src/lib/prediction-store.ts`
  - lecture / ecriture Supabase
  - tables `courses`, `predictions`
  - persistance `terrain / meteo`
- `src/lib/prediction-pipeline.ts`
  - pipeline complet du jour
  - analyse matinale
  - seconde passe T-10
  - sync resultats
- `src/lib/weekly-reports.ts`
  - calcul ROI hebdomadaire
  - auto-ajustement des parametres
- `src/lib/horse-faults.ts`
  - suivi des chevaux fautifs
- `src/lib/config.ts`
  - chargement des seuils et coefficients depuis Supabase
- `src/lib/telegram.ts`
  - alertes Telegram
- `src/app/api/cron/*`
  - routes cron Vercel

## Modules v9.2 implementes

### M1 - Score final de pari

Le moteur separe:

- `score_cheval`
- `score_lisibilite`

Puis calcule:

`score_final_pari = score_cheval * coefficient_lisibilite`

Lisibilite possible:

- `LISIBLE`
- `COMPLEXE`
- `LOTERIE`

La fonction de determination est dans `src/lib/predictions.ts`.

### M2 - Value plafonnee et calibree

Le moteur calcule:

`value_calculee = (proba_estimee * cote_PMU) - 1`

Puis applique:

- un plafond `maxCap`
- un coefficient selon la lisibilite
- un usage uniquement si la confiance est suffisante

Tous les seuils sont parametres dans Supabase via `parametres`.

### M3 - Seuils de validation

Les seuils ne sont pas hardcodes dans le front:

- confiance minimale
- qualite minimale
- lisibilites acceptees

Ils sont charges via `loadAlgoParameters()` depuis la table `parametres`.

### M4 - Filtrage outsiders

Un outsider est traite avec des regles dediees:

- cote PMU > seuil outsider
- course obligatoirement lisible
- signal de marche ou signal de forme
- pari conseille en `PLACE`
- mise reduite
- maximum 1 outsider par reunion

### M5 - Seconde passe T-10

Route cron:

- `GET /api/cron/prerace`

Cette passe:

- recupere la cote du moment
- recupere les non-partants
- compare la ferrure si disponible
- calcule la variation de cote
- ajuste la confiance
- peut retirer la validation
- envoie une alerte Telegram

### M6 - Auto-apprentissage post-course

Tables:

- `predictions`
- `weekly_reports`
- `param_history`
- `courses`

Pipeline:

1. analyse matinale
2. mise a jour T-10
3. resultats officiels
4. rapport hebdo
5. ajustement des seuils / coefficients selon le ROI observe

Le rapport hebdomadaire segmente aussi le ROI par:

- decision
- lisibilite
- hippodrome
- discipline
- palier de confiance
- type de pari (`GAGNANT` / `PLACE`)

### M7 - Chevaux fautifs

Le moteur suit le taux de faute des chevaux:

- malus si `taux_faute > 30%`
- rejet si `taux_faute > 50%`

La table utilisee est `chevaux`.

## Installation

### 1. Dependencies

```bash
npm install
```

### 2. Variables d'environnement

Copier `.env.local.example` vers `.env.local` puis renseigner:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

### 3. Supabase

Executer le fichier SQL:

- `supabase-setup.sql`

Depuis:

- Supabase > SQL Editor > Run

Ce script cree:

- `profiles`
- `bets`
- `parametres`
- `param_history`
- `chevaux`
- `courses`
- `predictions`
- `weekly_reports`

### 4. Lancer le projet

```bash
npm run dev
```

## Scripts CLI

### Analyse matinale

```bash
npm run cron:morning
npm run cron:morning -- --date=18032026
```

### Seconde passe T-10

```bash
npm run cron:prerace
npm run cron:prerace -- --date=18032026 --reunion=3 --course=1
```

### Synchronisation des resultats

```bash
npm run cron:results
npm run cron:results -- --date=18032026
```

### Rapport hebdomadaire

```bash
npm run cron:weekly
npm run cron:weekly -- --date=2026-03-22
```

## Routes cron

- `/api/cron/morning`
- `/api/cron/prerace`
- `/api/cron/results`
- `/api/cron/weekly`

En local:

- sans `CRON_SECRET`, elles passent en dev

En production:

- Vercel Cron est autorise via le header `x-vercel-cron`
- un bearer token manuel est aussi possible si `CRON_SECRET` est defini

## Vercel

Le fichier `vercel.json` active 4 cron jobs:

- `morning` a `07:00 UTC`
- `prerace` toutes les 5 minutes
- `results` toutes les 10 minutes
- `weekly` le dimanche a `19:00 UTC`

Important:

- les crons Vercel sont en UTC
- si tu veux un horaire strict Paris ete/hiver, il faut ajuster la schedule
  selon la saison ou utiliser un worker externe

## Notes sur les donnees PMU

Le projet utilise des fonctions serveur dans `src/lib/pmu-api.ts`.

Les donnees cherchees sont:

- partants
- discipline
- allocation
- terrain
- meteo
- cotes
- musique
- stalle / corde
- poids
- ferrure
- rapports definitifs

Les scrapes doivent rester defensifs:

- timeouts
- reponses vides
- champs manquants
- fallback soft sans casser l'API publique

La seconde passe T-10 enregistre un `signal_variation` normalise:

- `FORTE_BAISSE`
- `BAISSE`
- `STABLE`
- `HAUSSE`
- `FORTE_HAUSSE`
- `DONNEE_INDISPONIBLE`

## Parametrage sans recompilation

Tous les seuils importants sont stockes dans Supabase:

- validation
- coefficients de lisibilite
- plafond value
- seuil outsider
- seuils T-10
- seuils fautifs

La table source est `parametres`.

## Validation technique

Avant deployment:

```bash
npm run lint
npm run build
```

## Suite conseillee

Pour rendre v9.2 encore plus forte:

- brancher terrain / meteo reellement dans le scoring
- historiser l'apprentissage sur plusieurs mois
- exposer un dashboard admin des `weekly_reports`
- ajouter des tests unitaires sur:
  - lisibilite
  - value
  - outsiders
  - T-10
  - chevaux fautifs
