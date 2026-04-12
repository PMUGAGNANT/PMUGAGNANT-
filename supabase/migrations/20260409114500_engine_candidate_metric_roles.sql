alter table public.engine_candidate_metrics
  add column if not exists dataset_role text not null default 'TRAIN'
  check (dataset_role in ('TRAIN', 'TEST', 'VALIDATION'));

drop index if exists public.engine_candidate_metrics_unique_idx;

create unique index if not exists engine_candidate_metrics_unique_idx
  on public.engine_candidate_metrics (candidate_id, dataset_role, window_start, window_end);

create index if not exists engine_candidate_metrics_role_idx
  on public.engine_candidate_metrics (dataset_role, created_at desc);
