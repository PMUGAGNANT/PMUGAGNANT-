-- Tables optionnelles : exécuter une fois dans Supabase SQL Editor.
-- RLS : à activer selon ta politique (ou utiliser service role côté API comme le projet).

create table if not exists public.community_picks (
  id uuid primary key default gen_random_uuid(),
  race_id text not null,
  cheval_num int not null,
  user_id uuid references auth.users (id) on delete set null,
  voter_id text,
  created_at timestamptz not null default now()
);

create index if not exists community_picks_race_id_idx on public.community_picks (race_id);

create table if not exists public.quinte_ai_cache (
  race_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null
);
