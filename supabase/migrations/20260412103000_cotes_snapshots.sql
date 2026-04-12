create table if not exists public.cotes_snapshots (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  reunion int not null,
  course int not null,
  cheval_num int not null,
  cote numeric(6,2) not null,
  captured_at timestamptz not null default now()
);

create index if not exists cotes_snapshots_race_time_idx
  on public.cotes_snapshots(date, reunion, course, captured_at);

create index if not exists cotes_snapshots_horse_idx
  on public.cotes_snapshots(date, reunion, course, cheval_num, captured_at);

alter table public.cotes_snapshots enable row level security;
