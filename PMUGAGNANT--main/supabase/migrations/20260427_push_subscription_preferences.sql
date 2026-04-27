alter table public.push_subscriptions
  add column if not exists morning_enabled boolean not null default true,
  add column if not exists prerace_enabled boolean not null default true,
  add column if not exists results_enabled boolean not null default true;
