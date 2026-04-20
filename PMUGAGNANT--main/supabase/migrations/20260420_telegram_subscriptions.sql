create table if not exists public.telegram_subscriptions (
  chat_id text primary key,
  username text,
  first_name text,
  last_name text,
  is_active boolean not null default true,
  subscribed_at timestamptz not null default now(),
  stopped_at timestamptz,
  last_command text,
  updated_at timestamptz not null default now()
);

create index if not exists telegram_subscriptions_active_idx
  on public.telegram_subscriptions (is_active);

alter table public.telegram_subscriptions enable row level security;
