# PMU Gagnant

Application Next.js de pronostics PMU orientée décision, avec moteur de scoring, sélection des meilleures courses du jour, pipeline cron et stockage Supabase.

## Positionnement

Le projet sert à :

- analyser le programme PMU du jour à partir des données courses et participants ;
- calculer une lisibilité de course et un score de confiance exploitable ;
- mettre en avant les réunions et courses les plus jouables ;
- proposer un ticket principal et des angles de jeu simples à lire ;
- synchroniser les résultats officiels et suivre la performance dans Supabase ;
- diffuser des alertes via Telegram ;
- monétiser l’accès premium via Stripe.

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase
- Vercel
- GitHub Actions
- Telegram Bot API
- Stripe
- Resend pour les emails transactionnels

## Fonctionnalités principales

### Front produit

- page d’accueil avec radar du jour ;
- top 3 des courses jouables ;
- bloc de tickets prioritaires ;
- programme trié par heure, score, urgence ou enjeux ;
- pages détail course avec verdict, value, bankroll, top 5 et débrief officiel.

### Moteur PMU

- scoring cheval multi-signaux ;
- lisibilité de course : `LISIBLE`, `COMPLEXE`, `LOTERIE` ;
- décision course : `VALIDE`, `SURVEILLANCE`, `REJET` ;
- gestion des outsiders ;
- calcul de value bet et mise type Kelly ;
- seconde passe pré-course à T-10 ;
- règlement post-course à partir des rapports officiels.

### Exécution automatique

- scan matinal ;
- mise à jour pré-course ;
- synchronisation des résultats ;
- rapport hebdomadaire avec ajustements automatiques des paramètres.

## Arborescence utile

- `src/app/page.tsx` : page d’accueil et expérience principale.
- `src/app/course/[reunion]/[course]/page.tsx` : détail d’une course.
- `src/app/api/races/route.ts` : programme du jour.
- `src/app/api/races/scores/route.ts` : scores, tickets et déverrouillage premium.
- `src/app/api/cron/route.ts` : dispatcher cron unifié.
- `src/lib/predictions.ts` : moteur de scoring et de recommandation.
- `src/lib/prediction-pipeline.ts` : pipeline matin, T-10 et résultats.
- `src/lib/prediction-store.ts` : persistance Supabase.
- `src/lib/pmu-api.ts` : intégration PMU.
- `src/lib/weekly-reports.ts` : bilan hebdomadaire et recalibrage.
- `supabase-setup.sql` : schéma initial.

## Installation locale

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configurer l’environnement

Copier `.env.local.example` vers `.env.local`, puis renseigner :

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
NEXT_PUBLIC_SITE_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
SUPPORT_EMAIL=
```

### 3. Initialiser Supabase

Exécuter le script :

```bash
supabase-setup.sql
```

Puis appliquer les migrations de `supabase/migrations/` dans l'ordre :

```bash
002_user_streaks.sql
003_referral.sql
004_push_subscriptions.sql
20260401120000_community_picks_and_quinte_cache.sql
20260408143000_billing_and_access_hardening.sql
```

Il crée notamment les tables suivantes :

- `profiles`
- `bets`
- `parametres`
- `param_history`
- `chevaux`
- `courses`
- `predictions`
- `weekly_reports`
- `push_subscriptions`
- `community_picks`

### 4. Lancer l’application

```bash
npm run dev
```

## Scripts utiles

```bash
npm run lint
npm run build
npm run test
npm run cron:morning
npm run cron:prerace
npm run cron:results
npm run cron:weekly
npm run cron:backtest
npm run cron:calibration
```

Exemples :

```bash
npm run cron:prerace -- --date=18032026 --reunion=3 --course=1
npm run cron:weekly -- --date=2026-03-22
```

## Cron et automatisation

Le projet expose un dispatcher principal :

- `/api/cron`

Ce dispatcher décide quoi lancer selon l’heure de Paris :

- matin vers `07:00` ;
- pré-course toutes les 5 minutes ;
- résultats toutes les 10 minutes ;
- hebdomadaire le dimanche vers `19:00`.

### Configuration recommandée sur Vercel Hobby

Le plan Hobby de Vercel ne permet pas les crons fréquents toutes les 5 minutes.

Le montage recommandé est donc :

- Vercel pour l’hébergement de l’application ;
- GitHub Actions pour appeler les routes cron fréquentes.

Workflow déjà présent :

- `.github/workflows/cron-jobs.yml`

### Configuration cron-job.org

Les routes cron sont protegees par `CRON_SECRET`. Pour cron-job.org, utiliser
un secret sans caracteres speciaux, par exemple `TurfEdge2026PMUSecret123`, puis
configurer les appels avec une des deux options :

- URL : `https://votre-domaine.com/api/cron/morning?token=TurfEdge2026PMUSecret123`
- Header : `Authorization: Bearer TurfEdge2026PMUSecret123`

Les alias `?secret=`, `?cron_secret=`, `x-cron-secret` et `x-api-key` sont aussi
acceptes pour eviter les erreurs de configuration. Si un ancien secret contient
un `+`, il faut l'encoder en `%2B` dans l'URL ou le remplacer par un secret
lettres/chiffres.

## Déploiement Vercel

### Variables à définir dans Vercel

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPPORT_EMAIL`

### Étapes

1. Importer le dépôt GitHub dans Vercel.
2. Renseigner les variables d’environnement.
3. Déployer.
4. Configurer les secrets GitHub Actions si les crons fréquents sont utilisés.
5. Vérifier le bon fonctionnement en production.

### Stripe live

- `NEXT_PUBLIC_SITE_URL` doit pointer vers l'URL publique de production.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` doit commencer par `pk_live_`.
- `STRIPE_SECRET_KEY` doit commencer par `sk_live_`.
- `STRIPE_PRICE_ID` doit venir du produit live Stripe.
- `STRIPE_WEBHOOK_SECRET` doit être celui du webhook live sur `/api/stripe/webhook`.

### Secrets GitHub Actions requis

- `APP_URL`
- `CRON_SECRET`

## Emails et délivrabilité

Pour les confirmations d’abonnement :

- `RESEND_FROM_EMAIL` peut être par exemple `TurfEdge <no-reply@turfedge.fr>` ;
- `SUPPORT_EMAIL` peut être par exemple `support@turfedge.fr` ;
- le domaine d’envoi doit être vérifié dans Resend avec SPF, DKIM et DMARC.

Sur un domaine neuf, Gmail peut classer les premiers messages en spam pendant un temps. Pour limiter cela :

- garder un expéditeur stable ;
- utiliser une vraie adresse support en reply-to ;
- éviter les objets trop promotionnels ;
- marquer les premiers emails comme `Not spam` dans Gmail.

## Encodage et hygiène du dépôt

Le dépôt est désormais cadré pour éviter les retours de faux mojibake ou de fichiers mélangés :

- encodage texte en UTF-8 via `.editorconfig` ;
- fins de ligne LF via `.editorconfig` et `.gitattributes` ;
- fichiers binaires explicitement marqués dans `.gitattributes`.

Si un terminal Windows affiche encore mal les accents, le problème vient en général de la console et non des fichiers du projet.

## Vérifications avant mise en ligne

```bash
npm run lint
npm run build
npm run test
```

## État actuel

Le projet couvre déjà :

- sélection des meilleures courses jouables ;
- tickets prioritaires et radar du jour ;
- pipeline matin, pré-course et résultats ;
- mode premium avec Stripe ;
- compatibilité Vercel Hobby + GitHub Actions ;
- gestion fiable des dates sur `Europe/Paris`.

## Suite recommandée

- renforcer les tests autour du moteur TypeScript moderne ;
- ajouter un vrai tableau de bord d’analyse de performance ;
- consolider la documentation produit et opérationnelle ;
- finaliser le monitoring de production.
