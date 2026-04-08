alter table public.profiles
  add column if not exists premium_access_expires_at timestamptz;

update public.profiles
set premium_access_expires_at = now() + make_interval(days => referral_premium_days)
where premium_access_expires_at is null
  and coalesce(referral_premium_days, 0) > 0;

with duplicate_bets as (
  select
    id,
    row_number() over (
      partition by user_id, date_str, reunion, course
      order by created_at asc, id asc
    ) as row_num
  from public.bets
)
delete from public.bets
where id in (
  select id
  from duplicate_bets
  where row_num > 1
);

create unique index if not exists bets_user_race_unique_idx
  on public.bets (user_id, date_str, reunion, course);

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own bets" on public.bets;
drop policy if exists "Users can update own bets" on public.bets;

create or replace function public.place_user_bet(
  p_date_str text,
  p_reunion integer,
  p_course integer,
  p_hippodrome text,
  p_heure_depart text,
  p_cheval_num integer,
  p_cheval_nom text,
  p_type_pari text,
  p_mise integer,
  p_cote numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_solde integer;
  v_bet_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_date_str is null or p_date_str !~ '^\d{8}$' then
    raise exception 'INVALID_DATE';
  end if;

  if p_reunion is null or p_reunion <= 0 then
    raise exception 'INVALID_REUNION';
  end if;

  if p_course is null or p_course <= 0 then
    raise exception 'INVALID_COURSE';
  end if;

  if p_cheval_num is null or p_cheval_num <= 0 then
    raise exception 'INVALID_HORSE';
  end if;

  if p_cheval_nom is null or btrim(p_cheval_nom) = '' then
    raise exception 'INVALID_HORSE_NAME';
  end if;

  if p_type_pari is null or upper(btrim(p_type_pari)) not in ('GAGNANT', 'PLACE') then
    raise exception 'INVALID_BET_TYPE';
  end if;

  if p_mise is null or p_mise < 1 or p_mise > 50 then
    raise exception 'INVALID_STAKE';
  end if;

  if p_cote is null or p_cote <= 1 or p_cote > 200 then
    raise exception 'INVALID_ODDS';
  end if;

  update public.profiles
  set solde = coalesce(solde, 1000) - p_mise
  where id = v_user_id
    and coalesce(solde, 1000) >= p_mise
  returning solde into v_solde;

  if not found then
    if exists(select 1 from public.profiles where id = v_user_id) then
      raise exception 'INSUFFICIENT_FUNDS';
    end if;

    raise exception 'PROFILE_NOT_FOUND';
  end if;

  insert into public.bets (
    user_id,
    date_str,
    reunion,
    course,
    hippodrome,
    heure_depart,
    cheval_num,
    cheval_nom,
    type_pari,
    mise,
    cote,
    statut,
    gain
  )
  values (
    v_user_id,
    p_date_str,
    p_reunion,
    p_course,
    coalesce(p_hippodrome, ''),
    coalesce(p_heure_depart, ''),
    p_cheval_num,
    btrim(p_cheval_nom),
    upper(btrim(p_type_pari)),
    p_mise,
    p_cote,
    'EN_ATTENTE',
    null
  )
  returning id into v_bet_id;

  return jsonb_build_object(
    'bet_id', v_bet_id,
    'solde', v_solde
  );
exception
  when unique_violation then
    raise exception 'BET_ALREADY_EXISTS';
end;
$$;

revoke all on function public.place_user_bet(
  text,
  integer,
  integer,
  text,
  text,
  integer,
  text,
  text,
  integer,
  numeric
) from public;

grant execute on function public.place_user_bet(
  text,
  integer,
  integer,
  text,
  text,
  integer,
  text,
  text,
  integer,
  numeric
) to authenticated;
