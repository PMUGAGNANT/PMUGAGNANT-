create table if not exists public.cron_logs (
  id uuid default gen_random_uuid() primary key,
  route text not null,
  status text not null,
  duration_ms integer,
  courses_processed integer default 0,
  errors text,
  created_at timestamptz default now()
);

create index if not exists idx_cron_logs_route_created_at
  on public.cron_logs (route, created_at desc);

create index if not exists idx_cron_logs_status_created_at
  on public.cron_logs (status, created_at desc);

alter table public.cron_logs enable row level security;

create table if not exists public.runners (
  id uuid default gen_random_uuid() primary key,
  race_date date not null,
  date_str text not null,
  reunion integer not null,
  course integer not null,
  cheval_num integer not null,
  cheval_nom text not null,
  jockey text,
  driver text,
  entraineur text,
  age integer,
  sexe text,
  cote numeric,
  cote_matin numeric,
  musique text,
  statut text,
  non_partant boolean not null default false,
  updated_at timestamptz default now()
);

create unique index if not exists idx_runners_unique_runner
  on public.runners (race_date, reunion, course, cheval_num);

create index if not exists idx_runners_race_lookup
  on public.runners (race_date, reunion, course);

alter table public.runners enable row level security;

create table if not exists public.bet_results (
  id uuid default gen_random_uuid() primary key,
  race_date date not null,
  reunion integer not null,
  course integer not null,
  cheval_num integer not null,
  cheval_nom text not null,
  prediction_decision text not null,
  bet_type text,
  stake numeric not null default 0,
  odds numeric,
  result_position integer,
  result_status text not null,
  gain numeric not null default 0,
  profit numeric not null default 0,
  roi numeric not null default 0,
  updated_at timestamptz default now()
);

create unique index if not exists idx_bet_results_unique_prediction
  on public.bet_results (race_date, reunion, course, cheval_num);

create index if not exists idx_bet_results_race_date
  on public.bet_results (race_date desc);

alter table public.bet_results enable row level security;
