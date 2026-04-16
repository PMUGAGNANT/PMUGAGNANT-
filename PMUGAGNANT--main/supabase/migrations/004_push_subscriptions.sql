create table if not exists push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  endpoint text not null unique,
  keys_p256dh text not null,
  keys_auth text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "Users manage own push subs" on push_subscriptions;

create policy "Users manage own push subs"
  on push_subscriptions for all using (auth.uid() = user_id);
