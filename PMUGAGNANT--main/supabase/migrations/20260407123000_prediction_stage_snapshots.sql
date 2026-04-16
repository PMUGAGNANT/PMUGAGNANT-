create table if not exists public.prediction_stage_snapshots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  reunion integer not null,
  course integer not null,
  stage text not null check (stage in ('MATIN', 'T10', 'RESULTAT')),
  hippodrome text not null,
  lisibilite text,
  score_lisibilite double precision,
  coefficient_lisibilite double precision,
  decision_course text,
  selection_num integer,
  selection_nom text,
  selection_decision text,
  selection_confiance double precision,
  selection_pari text,
  selection_cote double precision,
  favori_num integer,
  favori_nom text,
  favori_cote double precision,
  market_favorite_num integer,
  market_favorite_nom text,
  market_favorite_cote double precision,
  notes jsonb,
  updated_at timestamptz not null default now(),
  unique (date, reunion, course, stage)
);

create index if not exists prediction_stage_snapshots_race_idx
  on public.prediction_stage_snapshots (date, reunion, course, updated_at);
