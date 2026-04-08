create table if not exists public.race_engine_runs (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  reunion integer not null,
  course integer not null,
  stage text not null check (stage in ('MATIN', 'T10', 'RESULTAT')),
  segment_key text not null,
  engine_version text not null,
  config_version text not null,
  lisibilite text check (lisibilite in ('LISIBLE', 'COMPLEXE', 'LOTERIE')),
  score_lisibilite numeric,
  decision_course text check (decision_course in ('VALIDE', 'SURVEILLANCE', 'REJET')),
  runner_count integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'RUNNING' check (status in ('RUNNING', 'COMPLETED', 'FAILED')),
  error_message text,
  created_at timestamptz not null default now()
);

create unique index if not exists race_engine_runs_unique_idx
  on public.race_engine_runs (date, reunion, course, stage, engine_version);

create index if not exists race_engine_runs_status_idx
  on public.race_engine_runs (status, created_at desc);

create table if not exists public.runner_feature_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.race_engine_runs(id) on delete cascade,
  date date not null,
  reunion integer not null,
  course integer not null,
  stage text not null check (stage in ('MATIN', 'T10', 'RESULTAT')),
  segment_key text not null,
  cheval_num integer not null,
  cheval_nom text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists runner_feature_snapshots_unique_idx
  on public.runner_feature_snapshots (run_id, cheval_num);

create index if not exists runner_feature_snapshots_segment_idx
  on public.runner_feature_snapshots (segment_key, stage, created_at desc);

create table if not exists public.runner_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.race_engine_runs(id) on delete cascade,
  cheval_num integer not null,
  score_expert numeric not null,
  score_lisibilite_adjusted numeric not null,
  proba_raw numeric,
  proba_calibrated numeric,
  market_edge numeric,
  confidence_score numeric,
  value_index numeric,
  decision text not null check (decision in ('VALIDE', 'SURVEILLANCE', 'REJET')),
  bet_type text not null check (bet_type in ('GAGNANT', 'PLACE')),
  stake_base numeric not null default 0,
  stake_final numeric not null default 0,
  blend_payload jsonb not null default '{}'::jsonb,
  reason_codes text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create unique index if not exists runner_score_snapshots_unique_idx
  on public.runner_score_snapshots (run_id, cheval_num);

create table if not exists public.runner_market_snapshots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  reunion integer not null,
  course integer not null,
  cheval_num integer not null,
  snapshot_stage text not null check (snapshot_stage in ('MATIN', 'T10', 'RESULTAT')),
  cote numeric,
  cote_reference numeric,
  variation_pct numeric,
  signal_variation text,
  ferrure text,
  created_at timestamptz not null default now()
);

create unique index if not exists runner_market_snapshots_unique_idx
  on public.runner_market_snapshots (date, reunion, course, cheval_num, snapshot_stage);

create index if not exists runner_market_snapshots_stage_idx
  on public.runner_market_snapshots (snapshot_stage, created_at desc);

create table if not exists public.runner_outcomes (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  reunion integer not null,
  course integer not null,
  cheval_num integer not null,
  ordre_arrivee integer,
  resultat_gagnant boolean not null default false,
  resultat_place boolean not null default false,
  rapport_gagnant numeric,
  rapport_place numeric,
  non_partant boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists runner_outcomes_unique_idx
  on public.runner_outcomes (date, reunion, course, cheval_num);

create table if not exists public.segment_calibrations (
  id uuid primary key default gen_random_uuid(),
  segment_key text not null,
  stage text not null check (stage in ('MATIN', 'T10', 'RESULTAT')),
  engine_version text not null,
  bin_definition jsonb not null default '{}'::jsonb,
  calibration_payload jsonb not null default '{}'::jsonb,
  sample_size integer not null default 0,
  brier_score numeric,
  log_loss numeric,
  roi_30d numeric,
  created_at timestamptz not null default now(),
  is_active boolean not null default false
);

create index if not exists segment_calibrations_lookup_idx
  on public.segment_calibrations (segment_key, stage, engine_version, created_at desc);

create unique index if not exists segment_calibrations_active_unique_idx
  on public.segment_calibrations (segment_key, stage)
  where is_active = true;

create table if not exists public.segment_performance_daily (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  segment_key text not null,
  stage text not null check (stage in ('MATIN', 'T10', 'RESULTAT')),
  bet_type text not null,
  predictions_count integer not null default 0,
  bets_count integer not null default 0,
  wins_count integer not null default 0,
  places_count integer not null default 0,
  roi numeric not null default 0,
  avg_confidence numeric,
  avg_edge numeric,
  created_at timestamptz not null default now()
);

create unique index if not exists segment_performance_daily_unique_idx
  on public.segment_performance_daily (date, segment_key, stage, bet_type);

create table if not exists public.portfolio_runs (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  engine_version text not null,
  bankroll_base numeric not null default 0,
  risk_budget numeric not null default 0,
  selected_bets_count integer not null default 0,
  rejected_bets_count integer not null default 0,
  expected_edge numeric,
  realized_roi numeric,
  status text not null default 'RUNNING',
  created_at timestamptz not null default now()
);

create unique index if not exists portfolio_runs_unique_idx
  on public.portfolio_runs (date, engine_version);

create table if not exists public.portfolio_entries (
  id uuid primary key default gen_random_uuid(),
  portfolio_run_id uuid not null references public.portfolio_runs(id) on delete cascade,
  run_id uuid not null references public.race_engine_runs(id) on delete cascade,
  cheval_num integer not null,
  decision text not null,
  bet_type text not null,
  stake numeric not null default 0,
  expected_value numeric,
  risk_score numeric,
  selection_reason text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create unique index if not exists portfolio_entries_unique_idx
  on public.portfolio_entries (portfolio_run_id, run_id, cheval_num);

alter table public.race_engine_runs enable row level security;
alter table public.runner_feature_snapshots enable row level security;
alter table public.runner_score_snapshots enable row level security;
alter table public.runner_market_snapshots enable row level security;
alter table public.runner_outcomes enable row level security;
alter table public.segment_calibrations enable row level security;
alter table public.segment_performance_daily enable row level security;
alter table public.portfolio_runs enable row level security;
alter table public.portfolio_entries enable row level security;
