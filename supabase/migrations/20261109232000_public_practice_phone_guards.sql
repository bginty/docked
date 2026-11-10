-- Prepared only: existing beta sessions/rounds are not changed; no activation.
-- Auth owns phone verification and its unique phone index. No OTP, phone number
-- or additional phone hash is copied into profiles, analytics, logs or audit.
do $$begin
 if not exists(select 1 from pg_indexes where schemaname='auth' and tablename='users' and indexdef like 'CREATE UNIQUE INDEX% (phone)')
 then raise exception 'Auth unique phone index required'; end if;
 if exists(select 1 from public_gameplay.rounds where fixture_kind<>'practice')
 then raise exception 'Non-Practice binding requires separate rights review'; end if;
end$$;
create or replace function private.public_phone_verified(u uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users a where a.id=u and a.phone ~ '^\+?[1-9][0-9]{7,14}$'
  and a.phone_confirmed_at is not null and a.phone_confirmed_at<=clock_timestamp()
  and a.email_confirmed_at is not null and not coalesce(a.is_anonymous,false)
  and (a.banned_until is null or a.banned_until<=clock_timestamp()))
$$;
revoke all on function private.public_phone_verified(uuid) from public,anon,authenticated,service_role;
grant execute on function private.public_phone_verified(uuid) to docked_app;
do $$declare b text;begin
 b:=pg_get_functiondef('public_gameplay.identity()'::regprocedure);
 if position('private.public_phone_verified' in b)=0 then
  if position('return u;' in b)=0 then raise exception 'Unexpected identity function: review drift'; end if;
  execute replace(b,'return u;','if not private.public_phone_verified(u) then raise exception ''Verified phone required''; end if; return u;');
 end if;
end$$;
alter table public_gameplay.rounds drop constraint if exists public_practice_only;
alter table public_gameplay.rounds add constraint public_practice_only check(fixture_kind='practice');
create or replace function public_gameplay.practice_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare c beta_fantasy.competitions; f jsonb;
begin
 if tg_table_schema='public_gameplay' then
  select * into strict c from beta_fantasy.competitions where id=new.competition_id;
  if new.fixture_kind<>'practice' or exists(select 1 from jsonb_array_elements(new.fixtures) v where v->>'synthetic' is distinct from 'true')
   then raise exception 'Public release supports synthetic Practice fixtures only'; end if;
 else
  if not exists(select 1 from public_gameplay.rounds where competition_id=new.id) then return new; end if;
  c:=new;
 end if;
 if c.rules->>'synthetic' is distinct from 'true' or c.name not ilike '%Practice%'
  or c.awards<>'[]'::jsonb or c.prize<>'No cash prize'
  or c.rules->>'entry_fee_credits' is distinct from '0'
  or coalesce(c.rules->'round_reward_policy'->>'active','false')<>'false'
 then raise exception 'Public Practice label, free entry and no rewards required'; end if;
 return new;
end$$;
drop trigger if exists public_practice_guard on public_gameplay.rounds;
create trigger public_practice_guard before insert or update on public_gameplay.rounds for each row execute function public_gameplay.practice_guard();
drop trigger if exists public_practice_competition_guard on beta_fantasy.competitions;
create trigger public_practice_competition_guard before update on beta_fantasy.competitions for each row execute function public_gameplay.practice_guard();
revoke all on function public_gameplay.practice_guard() from public,anon,authenticated,service_role;
