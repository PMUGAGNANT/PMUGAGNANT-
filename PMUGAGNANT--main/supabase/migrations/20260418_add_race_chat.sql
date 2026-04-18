create table if not exists public.race_messages (
  id uuid primary key default gen_random_uuid(),
  race_id text not null,
  race_date date not null,
  user_id uuid references auth.users(id) on delete cascade,
  username text not null,
  avatar_initials text not null,
  is_pro boolean not null default false,
  win_rate numeric not null default 0,
  winning_streak integer not null default 0,
  content text not null check (char_length(content) <= 280),
  created_at timestamptz not null default now(),
  banned_until timestamptz
);

create index if not exists idx_race_messages_race
  on public.race_messages (race_id, race_date, created_at desc);

create index if not exists idx_race_messages_user_recent
  on public.race_messages (user_id, created_at desc);

create table if not exists public.race_message_reactions (
  message_id uuid not null references public.race_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('🔥', '👀', '❌')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists idx_race_message_reactions_message
  on public.race_message_reactions (message_id, emoji);

create table if not exists public.race_chat_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  banned_until timestamptz not null,
  reason text not null default 'RATE_LIMIT',
  updated_at timestamptz not null default now()
);

create or replace function public.enforce_race_message_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count integer;
  v_banned_until timestamptz;
begin
  if auth.uid() is null or auth.uid() <> new.user_id then
    raise exception 'CHAT_AUTH_REQUIRED';
  end if;

  new.content := btrim(new.content);
  new.username := btrim(new.username);
  new.avatar_initials := upper(left(regexp_replace(new.avatar_initials, '[^[:alnum:]]', '', 'g'), 3));

  if new.content = '' then
    raise exception 'CHAT_EMPTY_MESSAGE';
  end if;

  select banned_until
    into v_banned_until
  from public.race_chat_bans
  where user_id = new.user_id
    and banned_until > now();

  if v_banned_until is not null then
    new.banned_until := v_banned_until;
    raise exception 'CHAT_BANNED';
  end if;

  select count(*)
    into v_recent_count
  from public.race_messages
  where user_id = new.user_id
    and created_at > now() - interval '1 minute';

  if v_recent_count >= 5 then
    insert into public.race_chat_bans (user_id, banned_until, reason, updated_at)
    values (new.user_id, now() + interval '10 minutes', 'RATE_LIMIT', now())
    on conflict (user_id) do update
      set banned_until = excluded.banned_until,
          reason = excluded.reason,
          updated_at = now();

    new.banned_until := now() + interval '10 minutes';
    raise exception 'CHAT_RATE_LIMIT';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_race_message_limits on public.race_messages;
create trigger enforce_race_message_limits
  before insert on public.race_messages
  for each row
  execute function public.enforce_race_message_limits();

alter table public.race_messages enable row level security;
alter table public.race_message_reactions enable row level security;
alter table public.race_chat_bans enable row level security;

drop policy if exists "Lecture publique" on public.race_messages;
create policy "Lecture publique"
  on public.race_messages for select
  using (true);

drop policy if exists "Ecriture connectes" on public.race_messages;
create policy "Ecriture connectes"
  on public.race_messages for insert
  with check (auth.uid() = user_id);

drop policy if exists "Reactions lecture publique" on public.race_message_reactions;
create policy "Reactions lecture publique"
  on public.race_message_reactions for select
  using (true);

drop policy if exists "Reactions ecriture connectes" on public.race_message_reactions;
create policy "Reactions ecriture connectes"
  on public.race_message_reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Reactions suppression proprietaire" on public.race_message_reactions;
create policy "Reactions suppression proprietaire"
  on public.race_message_reactions for delete
  using (auth.uid() = user_id);

drop policy if exists "Bans lecture proprietaire" on public.race_chat_bans;
create policy "Bans lecture proprietaire"
  on public.race_chat_bans for select
  using (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.race_messages;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.race_message_reactions;
exception
  when duplicate_object then null;
end $$;
