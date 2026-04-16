create table if not exists public.engine_candidates (
  id uuid primary key default gen_random_uuid(),
  segment_key text not null,
  stage text not null check (stage in ('MATIN', 'T10', 'RESULTAT')),
  engine_version text not null,
  parent_version text not null,
  candidate_type text not null check (candidate_type in ('CALIBRATION', 'THRESHOLD', 'WEIGHT', 'BLEND')),
  status text not null default 'SHADOW' check (status in ('DRAFT', 'SHADOW', 'PROMOTED', 'REJECTED')),
  config_patch jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  promoted_at timestamptz
);

create unique index if not exists engine_candidates_unique_idx
  on public.engine_candidates (segment_key, stage, engine_version);

create index if not exists engine_candidates_status_idx
  on public.engine_candidates (status, created_at desc);

create table if not exists public.engine_candidate_metrics (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.engine_candidates(id) on delete cascade,
  window_start date not null,
  window_end date not null,
  sample_size integer not null default 0,
  roi numeric,
  hit_rate numeric,
  false_positive_rate numeric,
  calibration_error numeric,
  drawdown numeric,
  created_at timestamptz not null default now()
);

create unique index if not exists engine_candidate_metrics_unique_idx
  on public.engine_candidate_metrics (candidate_id, window_start, window_end);

create table if not exists public.engine_promotions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.engine_candidates(id) on delete cascade,
  decision text not null check (decision in ('PROMOTED', 'REJECTED')),
  reason text not null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists engine_promotions_candidate_idx
  on public.engine_promotions (candidate_id, decided_at desc);

create table if not exists public.segment_learning_state (
  segment_key text not null,
  stage text not null check (stage in ('MATIN', 'T10', 'RESULTAT')),
  stable_version text not null,
  challenger_version text,
  active_calibration_version text,
  last_learning_run_at timestamptz,
  last_promotion_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (segment_key, stage)
);

alter table public.engine_candidates enable row level security;
alter table public.engine_candidate_metrics enable row level security;
alter table public.engine_promotions enable row level security;
alter table public.segment_learning_state enable row level security;
