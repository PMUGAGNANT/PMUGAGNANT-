-- =============================================
-- TurfEdge - SQL Setup v9.2 for Supabase
-- Run in Supabase > SQL Editor
-- Then apply every file in supabase/migrations/ to enable
-- the current premium, referral, push and hardening features.
-- =============================================

create extension if not exists pgcrypto;

-- =============================================
-- Core user tables
-- =============================================

create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  solde integer default 1000,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text default 'FREE',
  is_subscribed boolean default false,
  created_at timestamptz default now()
);

create table if not exists bets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  date_str text not null,
  reunion integer not null,
  course integer not null,
  hippodrome text default '',
  heure_depart text default '',
  cheval_num integer not null,
  cheval_nom text not null,
  cheval_num_2 integer,
  cheval_nom_2 text,
  type_pari text not null,
  mise integer not null check (mise >= 1 and mise <= 50),
  cote numeric,
  statut text default 'EN_ATTENTE' check (statut in ('EN_ATTENTE', 'GAGNE', 'PLACE', 'PERDU')),
  gain numeric,
  created_at timestamptz default now()
);

alter table bets drop constraint if exists bets_type_pari_check;
alter table bets
  add constraint bets_type_pari_check
  check (type_pari in ('GAGNANT', 'PLACE', 'COUPLE_GAGNANT', 'COUPLE_PLACE'));

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, solde)
  values (new.id, new.email, 1000)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

alter table profiles enable row level security;
alter table bets enable row level security;

alter table profiles add column if not exists stripe_customer_id text;
alter table profiles add column if not exists stripe_subscription_id text;
alter table profiles add column if not exists subscription_status text default 'FREE';
alter table profiles add column if not exists is_subscribed boolean default false;

drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can view own bets" on bets;
create policy "Users can view own bets"
  on bets for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own bets" on bets;
create policy "Users can insert own bets"
  on bets for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own bets" on bets;
create policy "Users can update own bets"
  on bets for update
  using (auth.uid() = user_id);

create index if not exists idx_bets_user_id on bets(user_id);
create index if not exists idx_bets_statut on bets(statut);
create index if not exists idx_bets_date on bets(date_str);

-- =============================================
-- Algo configuration and learning tables
-- =============================================

create table if not exists parametres (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists param_history (
  id uuid default gen_random_uuid() primary key,
  parameter_key text not null,
  previous_value text not null,
  next_value text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists chevaux (
  id uuid default gen_random_uuid() primary key,
  cheval_nom text not null unique,
  taux_faute numeric(6,4) not null default 0,
  dq_count integer not null default 0,
  sample_size integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists courses (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  reunion integer not null,
  course integer not null,
  hippodrome text not null,
  nom_course text not null,
  heure_depart text not null,
  discipline text not null,
  allocation numeric(10,2) not null default 0,
  distance integer not null default 0,
  nombre_partants integer not null default 0,
  terrain text,
  meteo text,
  lisibilite text check (lisibilite in ('LISIBLE', 'COMPLEXE', 'LOTERIE')),
  score_lisibilite numeric(5,2),
  coefficient_lisibilite numeric(4,2),
  decision_course text check (decision_course in ('VALIDE', 'SURVEILLANCE', 'REJET')),
  updated_at timestamptz not null default now(),
  unique (date, reunion, course)
);

create table if not exists predictions (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  reunion int not null,
  course int not null,
  hippodrome text not null,
  cheval_num int not null,
  cheval_nom text not null,
  score_cheval numeric(5,2),
  score_blended numeric(5,2),
  score_final_pari numeric(6,2),
  coefficient_lisibilite numeric(4,2),
  confiance numeric(3,1),
  qualite numeric(5,2),
  lisibilite text check (lisibilite in ('LISIBLE', 'COMPLEXE', 'LOTERIE')),
  value numeric(6,2),
  cote_matin numeric(6,2),
  cote_depart numeric(6,2),
  variation_cote numeric(6,2),
  signal_variation text,
  ferrure_ref text,
  ferrure_t10 text,
  non_partant boolean default false,
  decision text check (decision in ('VALIDE', 'SURVEILLANCE', 'REJET')),
  pari_conseille text check (pari_conseille in ('GAGNANT', 'PLACE')),
  outsider boolean default false,
  mise_simulee int default 10,
  resultat_place boolean,
  resultat_gagnant boolean,
  rapport_place numeric(6,2),
  rapport_gagnant numeric(6,2),
  gain_simule numeric(8,2),
  stage text check (stage in ('MATIN', 'T10', 'RESULTAT')) default 'MATIN',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (date, reunion, course, cheval_num)
);

create table if not exists weekly_reports (
  id uuid default gen_random_uuid() primary key,
  week_start date not null,
  week_end date not null,
  roi_total numeric(8,2) not null default 0,
  roi_by_decision jsonb not null default '{}'::jsonb,
  roi_by_lisibilite jsonb not null default '{}'::jsonb,
  roi_by_hippodrome jsonb not null default '{}'::jsonb,
  roi_by_discipline jsonb not null default '{}'::jsonb,
  roi_by_confiance jsonb not null default '{}'::jsonb,
  roi_by_pari jsonb not null default '{}'::jsonb,
  sample_size integer not null default 0,
  recommendations text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (week_start, week_end)
);

alter table courses add column if not exists terrain text;
alter table courses add column if not exists meteo text;
alter table predictions add column if not exists score_blended numeric(5,2);
alter table weekly_reports add column if not exists roi_by_pari jsonb not null default '{}'::jsonb;

create index if not exists idx_predictions_date on predictions(date);
create index if not exists idx_predictions_race on predictions(date, reunion, course);
create index if not exists idx_predictions_decision on predictions(decision);
create index if not exists idx_predictions_stage on predictions(stage);
create index if not exists idx_predictions_hippodrome on predictions(hippodrome);
create index if not exists idx_courses_date on courses(date);
create index if not exists idx_weekly_reports_week on weekly_reports(week_start, week_end);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists predictions_touch_updated_at on predictions;
create trigger predictions_touch_updated_at
  before update on predictions
  for each row
  execute function public.touch_updated_at();

drop trigger if exists courses_touch_updated_at on courses;
create trigger courses_touch_updated_at
  before update on courses
  for each row
  execute function public.touch_updated_at();

insert into parametres (key, value_json)
values
  (
    'validation',
    '{"confianceMin": 6, "qualiteMin": 70, "lisibilitesAcceptees": ["LISIBLE", "COMPLEXE"]}'::jsonb
  ),
  (
    'lisibilite',
    '{"coefficients": {"LISIBLE": 1, "COMPLEXE": 0.6, "LOTERIE": 0}, "valueCoefficients": {"LISIBLE": 1, "COMPLEXE": 0.5, "LOTERIE": 0}, "thresholds": {"readableMin": 66, "complexMin": 38}}'::jsonb
  ),
  (
    'value',
    '{"maxCap": 5, "confidenceMin": 6}'::jsonb
  ),
  (
    'outsiders',
    '{"coteMin": 8, "variationMinPct": -15, "miseReductionFactor": 0.5, "maxPerReunion": 1}'::jsonb
  ),
  (
    'preRace',
    '{"strongDropPct": -20, "negativeRisePct": 30, "strongBonus": 1, "riseMalus": 1.5, "retractDecisionBelowConfidence": 6}'::jsonb
  ),
  (
    'fautifs',
    '{"warningRate": 0.3, "rejectRate": 0.5, "warningMalus": 1.5}'::jsonb
  )
on conflict (key) do nothing;
