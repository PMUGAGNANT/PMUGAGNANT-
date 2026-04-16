create table if not exists public.elite_performers (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('JOCKEY_FLAT', 'JOCKEY_TROT', 'TRAINER')),
  nom_normalise text not null,
  score integer not null check (score between 1 and 10),
  actif boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (type, nom_normalise)
);

create index if not exists elite_performers_active_idx
  on public.elite_performers (type, actif, score desc);

create or replace function public.touch_elite_performers_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists elite_performers_touch_updated_at on public.elite_performers;
create trigger elite_performers_touch_updated_at
  before update on public.elite_performers
  for each row
  execute function public.touch_elite_performers_updated_at();

alter table public.elite_performers enable row level security;

insert into public.elite_performers (type, nom_normalise, score, actif)
values
  ('JOCKEY_TROT', 'bazire', 10, true),
  ('JOCKEY_TROT', 'duvaldestin', 10, true),
  ('JOCKEY_TROT', 'abrivard', 9, true),
  ('JOCKEY_TROT', 'nivard', 9, true),
  ('JOCKEY_TROT', 'raffin', 9, true),
  ('JOCKEY_TROT', 'lagadeuc', 8, true),
  ('JOCKEY_TROT', 'thomain', 8, true),
  ('JOCKEY_FLAT', 'lemaire', 10, true),
  ('JOCKEY_FLAT', 'soumillon', 10, true),
  ('JOCKEY_FLAT', 'demuro', 9, true),
  ('JOCKEY_FLAT', 'guyon', 9, true),
  ('JOCKEY_FLAT', 'barzalona', 9, true),
  ('JOCKEY_FLAT', 'pasquier', 8, true),
  ('JOCKEY_FLAT', 'perrault', 7, true),
  ('JOCKEY_FLAT', 'purton', 9, true),
  ('JOCKEY_FLAT', 'moreira', 10, true),
  ('TRAINER', 'fabre', 10, true),
  ('TRAINER', 'graffard', 9, true),
  ('TRAINER', 'rohaut', 8, true),
  ('TRAINER', 'head', 8, true),
  ('TRAINER', 'brandt', 8, true),
  ('TRAINER', 'abrivard', 8, true),
  ('TRAINER', 'bazire', 8, true),
  ('TRAINER', 'duvaldestin', 8, true),
  ('TRAINER', 'bigeon', 7, true)
on conflict (type, nom_normalise) do update
set
  score = excluded.score,
  actif = excluded.actif,
  updated_at = now();
