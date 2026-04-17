-- Indexes dashboard / historique TurfEdge.
-- Objectif: accelerer les vues Bilan, le recalcul ROI et le rapprochement RESULTAT.

create index if not exists idx_predictions_date_stage_decision
  on public.predictions (date, stage, decision);

create index if not exists idx_predictions_date_bet_type
  on public.predictions (date, pari_conseille);

create index if not exists idx_predictions_race_lookup
  on public.predictions (date, reunion, course, cheval_num);

create index if not exists idx_predictions_hippodrome_date
  on public.predictions (hippodrome, date);

create index if not exists idx_courses_date_race
  on public.courses (date, reunion, course);

create index if not exists idx_courses_hippodrome_date
  on public.courses (hippodrome, date);

create index if not exists idx_courses_distance_date
  on public.courses (distance, date);

create index if not exists idx_bets_user_created_at
  on public.bets (user_id, created_at desc);
