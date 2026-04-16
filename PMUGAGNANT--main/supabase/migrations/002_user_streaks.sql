create table if not exists user_streaks (
  user_id uuid references profiles(id) on delete cascade primary key,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  total_followed integer not null default 0,
  total_won integer not null default 0,
  last_bet_date date,
  badge text default 'DEBUTANT',
  updated_at timestamptz default now()
);

alter table user_streaks enable row level security;

drop policy if exists "Users can view own streaks" on user_streaks;

create policy "Users can view own streaks"
  on user_streaks for select using (auth.uid() = user_id);
