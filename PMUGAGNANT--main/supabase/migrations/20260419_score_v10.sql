alter table public.runner_score_snapshots
  add column if not exists score_v10 numeric;
