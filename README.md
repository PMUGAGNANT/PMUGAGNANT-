# PMU Gagnant

Application Next.js de pronostics PMU avec moteur de scoring, suivi des meilleures courses du jour, pipeline cron et stockage Supabase.

## Ce que fait le projet

- analyse les courses du jour via les donnees PMU
- calcule un score de confiance et une lisibilite de course
- met en avant les 3 meilleures courses jouables du jour
- propose un resume "Mes 3 paris du jour"
- synchronise les resultats et suit la performance dans Supabase
- peut envoyer des alertes Telegram

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase
- Vercel
- GitHub Actions
- Telegram Bot API

## Fonctionnalites principales

- page d'accueil avec:
  - radar du jour
  - top 3 des courses jouables
  - mes 3 paris du jour
  - bouton de copie pour Telegram / WhatsApp
- moteur de prediction avec:
  - score cheval
  - lisibilite `LISIBLE`, `COMPLEXE`, `LOTERIE`
  - validation `VALIDE`, `SURVEILLANCE`, `REJET`
  - gestion outsiders
  - seconde passe T-10
- pipeline cron avec:
  - scan matinal
  - mise a jour pre-course
  - sync resultats
  - rapport hebdomadaire

## Arborescence utile

- `src/app/page.tsx`
  page d'accueil et experience principale
- `src/app/api/races/scores/route.ts`
  score des courses du jour et picks principaux
- `src/app/api/cron/route.ts`
  dispatcher cron unifie
- `src/lib/predictions.ts`
  moteur de scoring et recommandations
- `src/lib/prediction-pipeline.ts`
  pipeline complet matin / T-10 / resultats
- `src/lib/prediction-store.ts`
  persistance Supabase
- `src/lib/date-utils.ts`
  gestion fiable des dates Europe/Paris
- `supabase-setup.sql`
  schema de base de donnees

## Installation locale

### 1. Installer les dependances

```bash
npm install
```

### 2. Configurer l'environnement

Dupliquer `.env.local.example` en `.env.local` puis renseigner:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

### 3. Initialiser Supabase

Executer le script:

```bash
supabase-setup.sql
```

Il cree notamment les tables:

- `profiles`
- `bets`
- `parametres`
- `param_history`
- `chevaux`
- `courses`
- `predictions`
- `weekly_reports`

### 4. Lancer l'application

```bash
npm run dev
```

## Scripts utiles

```bash
npm run lint
npm run build
npm run cron:morning
npm run cron:prerace
npm run cron:results
npm run cron:weekly
```

Exemples:

```bash
npm run cron:prerace -- --date=18032026 --reunion=3 --course=1
npm run cron:weekly -- --date=2026-03-22
```

## Cron et automatisation

Le projet expose un dispatcher cron unifie:

- `/api/cron`

Le dispatcher decide ensuite quoi executer selon l'heure de Paris:

- matin vers `07:00`
- pre-course toutes les 5 minutes
- resultats toutes les 10 minutes
- hebdo le dimanche vers `19:00`

### Mode recommande en Vercel Hobby

Le plan Hobby Vercel ne permet pas les crons frequents toutes les 5 minutes.

La configuration recommandee est donc:

- Vercel pour heberger l'application
- GitHub Actions pour appeler les routes cron frequentes

Le workflow existe deja ici:

- `.github/workflows/cron-jobs.yml`

## Deploiement Vercel

### Variables a definir dans Vercel

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

### Etapes

1. importer le repo GitHub dans Vercel
2. renseigner les variables d'environnement
3. deployer
4. configurer les variables GitHub Actions si tu utilises les crons frequents
5. verifier que l'application repond bien en production

### Secrets GitHub Actions requis

- `APP_URL`
- `CRON_SECRET`

## Verifications avant mise en ligne

```bash
npm run lint
npm run build
```

## Etat actuel

Le projet est operationnel avec:

- top 3 des meilleures courses jouables
- bloc "Mes 3 paris du jour"
- bouton "Copier mes 3 paris"
- mode Vercel Hobby compatible avec GitHub Actions pour les crons
- correction des calculs de date sur fuseau `Europe/Paris`

## Suite recommandee

- ajout d'un bouton de partage Telegram
- tests unitaires sur le moteur de prediction
- dashboard admin de performance
- deploiement Vercel avec domaine et monitoring
