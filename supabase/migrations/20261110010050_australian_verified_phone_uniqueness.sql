-- Preserve all Auth records; stop on canonical duplicates instead of choosing an owner.
do $$begin
 if to_regprocedure('private.public_phone_verified(uuid)')is null then raise exception 'Prior public phone guard required';end if;
 if exists(select 1 from auth.users where phone_confirmed_at is not null and phone~'^\+?[1-9][0-9]{7,14}$'
  group by regexp_replace(phone,'^\+','')having count(*)>1)then raise exception 'Canonical verified phone conflict: founder review required';end if;
end$$;
create unique index if not exists docked_verified_phone_canonical on auth.users((regexp_replace(phone,'^\+','')))
 where phone_confirmed_at is not null and phone~'^\+?[1-9][0-9]{7,14}$';
create or replace function private.public_phone_verified(u uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users a where a.id=u and a.phone~'^\+?614[0-9]{8}$'
  and a.phone_confirmed_at is not null and a.phone_confirmed_at<=clock_timestamp()
  and a.email_confirmed_at is not null and not coalesce(a.is_anonymous,false)
  and (a.banned_until is null or a.banned_until<=clock_timestamp()))
$$;
revoke all on function private.public_phone_verified(uuid)from public,anon,authenticated,service_role;
grant execute on function private.public_phone_verified(uuid)to docked_app;
-- No Auth permission, OTP bypass, new user, phone copy, activation or phone change.
