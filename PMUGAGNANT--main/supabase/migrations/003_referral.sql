alter table profiles add column if not exists referral_code text unique;
alter table profiles add column if not exists referred_by uuid references profiles(id);
alter table profiles add column if not exists referral_count integer default 0;
alter table profiles add column if not exists referral_premium_days integer default 0;

create or replace function generate_referral_code()
returns trigger as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(substr(md5(random()::text), 1, 8));
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_referral_code on profiles;

create trigger set_referral_code
  before insert on profiles
  for each row
  execute function generate_referral_code();

update profiles
set referral_code = upper(substr(md5(random()::text), 1, 8))
where referral_code is null;
