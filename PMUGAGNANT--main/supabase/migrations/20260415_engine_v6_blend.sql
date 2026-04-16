alter table public.predictions
  add column if not exists score_blended numeric(5,2);

create index if not exists idx_predictions_score_blended
  on public.predictions(score_blended);
