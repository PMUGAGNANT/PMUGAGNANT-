create table if not exists public.push_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_key text not null unique,
  campaign text not null,
  audience text not null default 'all',
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists push_notification_deliveries_campaign_idx
  on public.push_notification_deliveries (campaign, created_at desc);
