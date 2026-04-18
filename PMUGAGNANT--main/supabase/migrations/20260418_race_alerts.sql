create table if not exists public.race_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  phone text,
  date_str text not null,
  reunion integer not null,
  course integer not null,
  hippodrome text not null,
  heure_depart text not null,
  cheval_num integer not null,
  cheval_nom text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create index if not exists race_alerts_race_idx
  on public.race_alerts (date_str, reunion, course, status);

create index if not exists race_alerts_user_idx
  on public.race_alerts (user_id, created_at desc);

create unique index if not exists race_alerts_phone_race_unique_idx
  on public.race_alerts (user_id, phone, date_str, reunion, course);

alter table public.race_alerts enable row level security;

drop policy if exists "Users can view own race alerts" on public.race_alerts;
create policy "Users can view own race alerts"
  on public.race_alerts for select
  using (auth.uid() = user_id);
