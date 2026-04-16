# PMU Engine V6 Roadmap

## Objectif

Faire evoluer le moteur actuel d'un moteur expert a regles vers un moteur hybride :

- moteur expert turf
- calibration statistique
- segmentation par type de course
- lecture du marche
- gestion portefeuille / bankroll
- explication humaine

Le but de la V6 n'est pas de supprimer le moteur actuel.
Le but est de le garder comme socle expert, puis de lui ajouter des couches mesurables.

## Etat actuel

Le moteur actuel vit principalement dans :

- `src/lib/predictions.ts`
- `src/lib/prediction-pipeline.ts`
- `src/lib/prediction-store.ts`
- `src/lib/config.ts`
- `src/app/api/races/scores/route.ts`
- `src/lib/client-race-scoring.ts`

Ce que le systeme fait deja bien :

- construit des signaux cheval
- calcule un score cheval
- calcule la lisibilite de la course
- produit une confiance, une value, une decision, un type de pari
- fait une passe `MATIN`, `T10`, `RESULTAT`
- stocke les predictions finales dans Supabase

Ce qui manque pour une vraie V6 :

- snapshots complets des features
- labels reels par cheval
- calibration probabiliste historique
- segmentation du moteur par famille de course
- moteur portefeuille
- blend entre score expert et score appris
- monitoring scientifique du moteur

## Vision cible

```text
PMU API
+ historique interne
+ variations de cotes
+ resultats reels
-> feature store
-> expert engine
-> segment engine
-> calibration engine
-> market engine
-> portfolio engine
-> blend engine
-> api / ui / reporting
```

## Architecture cible

### Couches

1. `Data ingestion`
   Recupere les courses, participants, cotes, ferrures, resultats.

2. `Feature store`
   Sauvegarde les features par cheval, course et stade.

3. `Expert engine`
   Version modularisee du moteur actuel a regles.

4. `Segment engine`
   Regles et calibrations specialisees par segment.

5. `Calibration engine`
   Convertit un score en probas fiables.

6. `Market engine`
   Mesure si le marche confirme, contredit ou sur-reacte.

7. `Portfolio engine`
   Decide combien de tickets jouer, combien miser, quoi refuser.

8. `Blend engine`
   Produit le score final hybride.

9. `Explainability engine`
   Produit les raisons humaines pour la UI et les audits.

## Segments cibles

La V6 ne doit plus raisonner avec un seul moteur global.

Segments minimum :

- `TROT_ATTELE`
- `TROT_MONTE`
- `PLAT_SPRINT`
- `PLAT_MILE`
- `PLAT_LONG`
- `OBSTACLE`
- `QUINTE`

Segments complementaires utiles plus tard :

- `2_ANS`
- `FEMELLES`
- `HANDICAP`
- `PETIT_PELOTON`
- `GRAND_PELOTON`

## Tables SQL a creer

Les tables actuelles `predictions` et `courses` doivent rester.
La V6 ajoute un vrai magasin de features et de labels.

### 1. `race_engine_runs`

But :
suivre chaque execution du moteur pour une course et un stade.

Colonnes :

- `id uuid primary key`
- `date date not null`
- `reunion int not null`
- `course int not null`
- `stage text not null`
- `segment_key text not null`
- `engine_version text not null`
- `config_version text not null`
- `lisibilite text`
- `score_lisibilite numeric`
- `decision_course text`
- `runner_count int not null`
- `started_at timestamptz not null`
- `finished_at timestamptz`
- `status text not null`
- `error_message text`
- `created_at timestamptz not null default now()`

Index :

- unique `(date, reunion, course, stage, engine_version)`

### 2. `runner_feature_snapshots`

But :
stocker toutes les features utilisees pour scorer un cheval.

Colonnes :

- `id uuid primary key`
- `run_id uuid not null references race_engine_runs(id) on delete cascade`
- `date date not null`
- `reunion int not null`
- `course int not null`
- `stage text not null`
- `segment_key text not null`
- `cheval_num int not null`
- `cheval_nom text not null`
- `payload jsonb not null`
- `created_at timestamptz not null default now()`

Le `payload` doit inclure au minimum :

- musique parsee
- signaux expert
- cotes
- stats humains
- stats piste / distance / terrain
- flags outsider / non partant
- features derivees de lisibilite

Index :

- unique `(date, reunion, course, stage, cheval_num, run_id)`
- index `(segment_key, stage)`

### 3. `runner_score_snapshots`

But :
garder la decomposition du score avant la prediction finale.

Colonnes :

- `id uuid primary key`
- `run_id uuid not null references race_engine_runs(id) on delete cascade`
- `cheval_num int not null`
- `score_expert numeric not null`
- `score_lisibilite_adjusted numeric not null`
- `proba_raw numeric`
- `proba_calibrated numeric`
- `market_edge numeric`
- `confidence_score numeric`
- `value_index numeric`
- `decision text not null`
- `bet_type text not null`
- `stake_base numeric not null`
- `stake_final numeric not null`
- `blend_payload jsonb not null`
- `reason_codes text[] not null default '{}'::text[]`
- `created_at timestamptz not null default now()`

Index :

- unique `(run_id, cheval_num)`

### 4. `runner_market_snapshots`

But :
stocker les infos marche au fil du temps.

Colonnes :

- `id uuid primary key`
- `date date not null`
- `reunion int not null`
- `course int not null`
- `cheval_num int not null`
- `snapshot_stage text not null`
- `cote numeric`
- `cote_reference numeric`
- `variation_pct numeric`
- `signal_variation text`
- `ferrure text`
- `created_at timestamptz not null default now()`

Index :

- unique `(date, reunion, course, cheval_num, snapshot_stage)`

### 5. `runner_outcomes`

But :
stocker les labels reels.

Colonnes :

- `id uuid primary key`
- `date date not null`
- `reunion int not null`
- `course int not null`
- `cheval_num int not null`
- `ordre_arrivee int`
- `resultat_gagnant bool not null default false`
- `resultat_place bool not null default false`
- `rapport_gagnant numeric`
- `rapport_place numeric`
- `non_partant bool not null default false`
- `created_at timestamptz not null default now()`

Index :

- unique `(date, reunion, course, cheval_num)`

### 6. `segment_calibrations`

But :
conserver les reglages calibres par segment et par stade.

Colonnes :

- `id uuid primary key`
- `segment_key text not null`
- `stage text not null`
- `engine_version text not null`
- `bin_definition jsonb not null`
- `calibration_payload jsonb not null`
- `sample_size int not null`
- `brier_score numeric`
- `log_loss numeric`
- `roi_30d numeric`
- `created_at timestamptz not null default now()`
- `is_active bool not null default false`

Index :

- unique `(segment_key, stage, engine_version, created_at)`
- partial unique active calibration per segment/stage

### 7. `segment_performance_daily`

But :
suivre le ROI par segment et type de pari.

Colonnes :

- `id uuid primary key`
- `date date not null`
- `segment_key text not null`
- `stage text not null`
- `bet_type text not null`
- `predictions_count int not null`
- `bets_count int not null`
- `wins_count int not null`
- `places_count int not null`
- `roi numeric not null`
- `avg_confidence numeric`
- `avg_edge numeric`
- `created_at timestamptz not null default now()`

Index :

- unique `(date, segment_key, stage, bet_type)`

### 8. `portfolio_runs`

But :
stocker la decision portefeuille pour une journee.

Colonnes :

- `id uuid primary key`
- `date date not null`
- `engine_version text not null`
- `bankroll_base numeric not null`
- `risk_budget numeric not null`
- `selected_bets_count int not null`
- `rejected_bets_count int not null`
- `expected_edge numeric`
- `realized_roi numeric`
- `status text not null`
- `created_at timestamptz not null default now()`

Index :

- unique `(date, engine_version)`

### 9. `portfolio_entries`

But :
liste des tickets retenus ou refuses par le portefeuille.

Colonnes :

- `id uuid primary key`
- `portfolio_run_id uuid not null references portfolio_runs(id) on delete cascade`
- `run_id uuid not null references race_engine_runs(id) on delete cascade`
- `cheval_num int not null`
- `decision text not null`
- `bet_type text not null`
- `stake numeric not null`
- `expected_value numeric`
- `risk_score numeric`
- `selection_reason text[] not null default '{}'::text[]`
- `created_at timestamptz not null default now()`

Index :

- unique `(portfolio_run_id, run_id, cheval_num)`

## Propositions de migrations

Ordre conseille :

1. `20260408200000_engine_v6_feature_store.sql`
2. `20260408201000_engine_v6_market_snapshots.sql`
3. `20260408202000_engine_v6_outcomes_and_calibration.sql`
4. `20260408203000_engine_v6_portfolio.sql`
5. `20260408204000_engine_v6_views_and_indexes.sql`

## Arborescence code cible

```text
src/lib/engine/
  index.ts
  version.ts
  segments.ts
  types.ts
  feature-snapshot.ts
  score-breakdown.ts
  explainability.ts
  expert/
    music.ts
    signals.ts
    horse-score.ts
    readability.ts
    decision.ts
    profiles.ts
    value.ts
    betting-plan.ts
  calibration/
    bins.ts
    probability.ts
    loaders.ts
    trainers.ts
  market/
    snapshots.ts
    moves.ts
    ferrure.ts
    drift.ts
  portfolio/
    risk-budget.ts
    selection.ts
    staking.ts
  pipeline/
    morning.ts
    prerace.ts
    results.ts
    persist.ts
  storage/
    feature-store.ts
    calibration-store.ts
    portfolio-store.ts
```

## Ce qu'on garde

Fichiers a garder comme facade ou compatibilite :

- `src/lib/analysis.ts`
- `src/lib/prediction-pipeline.ts`
- `src/lib/prediction-store.ts`
- `src/lib/config.ts`

Ils peuvent devenir des points d'entree qui deleguent vers `src/lib/engine/*`.

## Decoupage du fichier `predictions.ts`

Le fichier actuel est trop central.
Il faut le scinder sans changer le comportement au debut.

### A deplacer vers `src/lib/engine/expert/music.ts`

- `parseMusic`

### A deplacer vers `src/lib/engine/expert/signals.ts`

- `buildSignals`
- les fonctions `get*Signal`
- `getRiskPenalty`

### A deplacer vers `src/lib/engine/expert/horse-score.ts`

- `computeBaseHorseScore`
- `computeTop3Potential`
- `computeTop5Potential`
- `determineObjective`

### A deplacer vers `src/lib/engine/expert/readability.ts`

- `determineRaceReadabilityScore`
- `determinerLisibilite`

### A deplacer vers `src/lib/engine/expert/decision.ts`

- `determineHorseDecision`
- `buildRecommendation`
- `buildRecommendationRefined`
- `buildConfidenceScore`

### A deplacer vers `src/lib/engine/expert/value.ts`

- `buildPredictedOdds`
- `buildValue`
- `kellyFraction`
- calibration hooks

### A deplacer vers `src/lib/engine/expert/profiles.ts`

- `buildTopFactors`
- `buildFavoriteSolidity`
- `buildProfiles`
- `buildDaySignal`
- `buildRaceAlerts`

### A deplacer vers `src/lib/engine/expert/betting-plan.ts`

- `buildBettingPlan`
- `buildCompositeBetPlan`

### A deplacer vers `src/lib/engine/index.ts`

- `analyzeRaceWithParameters`
- `analyzeRace`

## Evolution de `config.ts`

Le fichier [config.ts](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/lib/config.ts) doit passer d'un schema global a un schema mixte :

- `global`
- `segments`
- `calibration`
- `portfolio`

Schema cible :

```ts
type EngineConfig = {
  version: string;
  global: { ... };
  segments: Record<string, SegmentConfig>;
  calibration: {
    activeVersion: string;
    minSampleSize: number;
  };
  portfolio: {
    dailyRiskBudgetPct: number;
    maxTicketsPerDay: number;
    maxExposurePerRacePct: number;
    maxExposurePerReunionPct: number;
  };
};
```

## Evolution de `types.ts`

Ajouter :

```ts
export type SegmentKey =
  | "TROT_ATTELE"
  | "TROT_MONTE"
  | "PLAT_SPRINT"
  | "PLAT_MILE"
  | "PLAT_LONG"
  | "OBSTACLE"
  | "QUINTE";

export interface RunnerFeatureSnapshot {
  courseKey: string;
  stage: ScoreStage;
  segmentKey: SegmentKey;
  chevalNum: number;
  features: Record<string, number | string | boolean | null>;
}

export interface BlendBreakdown {
  expertScore: number;
  calibratedProbability: number;
  marketScore: number;
  riskScore: number;
  portfolioScore: number;
  finalScore: number;
}
```

## Evolution du pipeline

Le pipeline actuel :

- `runMorningAnalysis`
- `runPreRaceSecondPass`
- `runResultSync`

doit devenir :

1. `buildRaceRunContext`
2. `snapshotMarketState`
3. `snapshotRunnerFeatures`
4. `runExpertEngine`
5. `runCalibrationLayer`
6. `runBlendEngine`
7. `runPortfolioLayer`
8. `persistRunOutputs`
9. `persistOutcomes`

## Evolution de l'API scores

La route [route.ts](/C:/Users/asus/Desktop/PMUGAGNANT-mainpush/src/app/api/races/scores/route.ts) doit continuer a sortir le format actuel pour la compatibilite.

Mais elle doit aussi etre capable de renvoyer plus tard :

- `scoreExpert`
- `scoreCalibrated`
- `probabilityRaw`
- `probabilityCalibrated`
- `marketEdge`
- `portfolioApproved`
- `blendBreakdown`
- `reasonCodes`
- `engineVersion`

Option de compatibilite :

- query param `?v=2`
- ou `Accept-Version: 2`

## Evolution de la UI

Le front peut rester stable au debut.
Puis on ajoute progressivement :

- badge `Expert`
- badge `Calibre`
- badge `Marche`
- details `Pourquoi valide`
- details `Pourquoi rejete`
- details `Pourquoi place plutot que gagnant`

Fichiers touches ensuite :

- `src/lib/client-race-scoring.ts`
- `src/components/ui/CourseCard.tsx`
- `src/components/ui/PronoHero.tsx`
- `src/components/ui/RadarHero.tsx`
- `src/app/course/[reunion]/[course]/page.tsx`

## Roadmap d'implementation

### Phase 0 - Instrumentation

But :
ne rien changer au moteur, seulement mesurer.

Livrables :

- nouvelles tables V6
- snapshot des features
- snapshot du marche
- snapshot des scores intermediaires

Impact code :

- `prediction-pipeline.ts`
- `prediction-store.ts`
- nouvelles tables Supabase

Definition of done :

- chaque run `MATIN`, `T10`, `RESULTAT` cree un `race_engine_run`
- chaque cheval a son `runner_feature_snapshot`
- chaque cheval a son `runner_score_snapshot`

### Phase 1 - Refactor moteur expert

But :
sortir la logique de `predictions.ts` en modules sans changer les sorties.

Livrables :

- nouveau dossier `src/lib/engine`
- `predictions.ts` devient facade legacy

Definition of done :

- comportement identique
- tests de non regression sur sorties top5 / lisibilite / decision

### Phase 2 - Calibration

But :
transformer les scores en probabilites credibles.

Livrables :

- job de calcul calibration hebdo
- chargement de calibration active
- nouvelle colonne `proba_calibrated`

Definition of done :

- Brier score meilleur que le moteur brut
- bins calibres utilises en prod

### Phase 3 - Segmentation

But :
avoir des seuils et coefficients par famille de course.

Livrables :

- `segments.ts`
- mapping `RaceSummary -> SegmentKey`
- config segmentee

Definition of done :

- un `plat sprint` n'utilise plus les memes seuils qu'un `trot attele`

### Phase 4 - Market engine

But :
ne plus lire seulement la cote instantanee, mais sa dynamique.

Livrables :

- snapshots marche multi-stades
- score de confirmation marche
- flags `steam`, `drift`, `dead market`, `late support`

Definition of done :

- le moteur sait distinguer une bonne baisse de cote d'un simple bruit

### Phase 5 - Portfolio engine

But :
decider a l'echelle de la journee.

Livrables :

- budget de risque journalier
- limite d'exposition par reunion
- limite d'exposition par segment
- selection finale de tickets

Definition of done :

- le moteur peut refuser un ticket bon individuellement pour proteger le portefeuille

### Phase 6 - Blend hybride

But :
produire la sortie finale V6.

Livrables :

- blend expert + calibration + marche + risque
- score final unifie
- raison explicite

Definition of done :

- chaque prediction expose son `blendBreakdown`

## Ordre de livraison recommande

Ne pas essayer de livrer la V6 en un seul merge.

Ordre recommande :

1. schema SQL V6
2. instrumentation snapshots
3. refactor `predictions.ts`
4. calibration
5. segmentation
6. market engine
7. portfolio engine
8. blend hybride
9. UI explicative

## Tests a ajouter

### Unit tests

- parsing musique
- scoring expert
- lisibilite
- decision cheval
- value
- segmentation
- calibration bins
- portefeuille

### Integration tests

- pipeline `MATIN`
- pipeline `T10`
- pipeline `RESULTAT`
- persistence snapshots
- api `/api/races/scores`

### Backtests

- ROI global
- ROI par segment
- ROI par type de pari
- taux de faux positifs outsiders
- calibration error
- drawdown

## KPIs de pilotage

- `hit_rate_valides`
- `roi_valides`
- `roi_surveillance`
- `brier_score`
- `log_loss`
- `avg_market_edge`
- `drawdown_max_30d`
- `roi_by_segment`
- `roi_by_stage`
- `roi_by_bet_type`
- `outsider_false_positive_rate`

## Rollout prod

### Etape 1

Activer uniquement l'instrumentation.
Ne rien changer aux sorties utilisateurs.

### Etape 2

Activer la calibration en mode shadow.
Comparer score brut et score calibre sans changer l'UI.

### Etape 3

Activer segmentation en lecture seule.
Comparer les deltas par segment.

### Etape 4

Activer portefeuille en mode advisory.
Le moteur conseille mais ne bloque pas encore.

### Etape 5

Activer blend hybride comme source officielle.

## Risques a maitriser

- sur-ingenierie avant instrumentation
- calibration sur echantillon trop faible
- sur-optimisation historique
- conflit entre score expert et score UI
- hausse de cout CPU a `T10`
- schema trop pauvre pour expliquer les decisions

## Definition de done V6

La V6 est consideree livree si :

- toutes les predictions ont un snapshot de features
- chaque run a un suivi complet `MATIN / T10 / RESULTAT`
- les probabilites sont calibrees
- le moteur est segmente
- le portefeuille choisit l'exposition finale
- l'API expose un breakdown explicable
- le suivi ROI par segment existe
- la prod reste compatible avec l'UI actuelle

## Premier chantier concret recommande

Le meilleur premier chantier n'est pas le blend.

Le meilleur premier chantier est :

1. creer les tables V6
2. snapshotter toutes les features
3. snapshotter toutes les decisions intermediaires
4. relier chaque prediction a son resultat reel

Tant que ca n'existe pas, aucune V6 serieuse n'est possible.
