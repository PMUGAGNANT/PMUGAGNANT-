alter table public.profiles
  add column if not exists telegram_chat_id text;

create unique index if not exists profiles_telegram_chat_id_unique_idx
  on public.profiles (telegram_chat_id)
  where telegram_chat_id is not null;
