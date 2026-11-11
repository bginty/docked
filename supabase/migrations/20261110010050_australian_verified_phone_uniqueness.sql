-- Supabase owns auth.users: enforce canonical uniqueness in a private registry.
-- The migration and trigger never change an existing Auth identity or phone.
-- This table lock and trigger installation share the reviewed outer transaction.
lock table auth.users in share row exclusive mode;
do $$begin
 if to_regprocedure('private.public_phone_verified(uuid)')is null then raise exception 'Prior public phone guard required';end if;
 if exists(select 1 from auth.users where phone_confirmed_at is not null and phone~'^\+?[1-9][0-9]{7,14}$'
  group by regexp_replace(phone,'^\+','')having count(*)>1)then raise exception 'Canonical verified phone conflict: founder review required';end if;
end$$;
create table if not exists private.verified_phone_claims(
 canonical_phone text not null constraint docked_verified_phone_canonical primary key
  check(canonical_phone~'^[1-9][0-9]{7,14}$'),
 user_id uuid not null unique
);
alter table private.verified_phone_claims enable row level security;
revoke all on private.verified_phone_claims from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
create or replace function private.sync_verified_phone_claim()returns trigger
language plpgsql security definer set search_path='' as $$begin
 if tg_op='DELETE'then
  delete from private.verified_phone_claims where user_id=old.id;
  return old;
 end if;
 if tg_op='UPDATE'then
  if new.id is distinct from old.id then raise exception 'Auth identity changes require separate review';end if;
  delete from private.verified_phone_claims where user_id=old.id;
 end if;
 if new.phone_confirmed_at is not null and new.phone~'^\+?[1-9][0-9]{7,14}$'then
  insert into private.verified_phone_claims(canonical_phone,user_id)
   values(regexp_replace(new.phone,'^\+',''),new.id);
 end if;
 return new;
end$$;
revoke all on function private.sync_verified_phone_claim()from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
do $$declare expected_attributes text;begin
 select string_agg(a.attnum::text,' 'order by x.ordinality)into expected_attributes
 from unnest(array['id','phone','phone_confirmed_at'])with ordinality x(name,ordinality)
 join pg_attribute a on a.attrelid='auth.users'::regclass and a.attname=x.name;
 if exists(select 1 from pg_trigger t where t.tgrelid='auth.users'::regclass and t.tgname='docked_verified_phone_claim')then
  if exists(select 1 from pg_trigger t where t.tgrelid='auth.users'::regclass and t.tgname='docked_verified_phone_claim'
   and(t.tgfoid<>'private.sync_verified_phone_claim()'::regprocedure or t.tgtype<>31 or t.tgenabled<>'O'
    or t.tgattr::text<>expected_attributes or t.tgqual is not null or t.tgargs<>''::bytea or t.tgconstraint<>0))then
   raise exception 'Verified phone trigger drift requires review';end if;
 else
  create trigger docked_verified_phone_claim before insert or delete or update of id,phone,phone_confirmed_at on auth.users
   for each row execute function private.sync_verified_phone_claim();
 end if;
end$$;
insert into private.verified_phone_claims(canonical_phone,user_id)
 select regexp_replace(phone,'^\+',''),id from auth.users
 where phone_confirmed_at is not null and phone~'^\+?[1-9][0-9]{7,14}$'
 on conflict(canonical_phone)do nothing;
do $$begin
 if exists(select 1 from private.verified_phone_claims c full join
  (select regexp_replace(phone,'^\+','')canonical_phone,id from auth.users
   where phone_confirmed_at is not null and phone~'^\+?[1-9][0-9]{7,14}$')a
  on a.canonical_phone=c.canonical_phone and a.id=c.user_id
  where a.id is null or c.user_id is null)then
  raise exception 'Verified phone claims differ from Auth; no automatic ownership correction';end if;
end$$;
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
