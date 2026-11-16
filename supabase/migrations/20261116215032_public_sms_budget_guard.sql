-- INACTIVE until a separately approved window and signed Auth hook are configured.
-- No phone number, OTP, credentials or customer balance is stored here.
create schema sms_delivery;
revoke all on schema sms_delivery from public, anon, authenticated, service_role;
create table sms_delivery.windows (
 id text primary key,
 enabled boolean not null default false,
 starts_at timestamptz not null,
 expires_at timestamptz not null,
 budget_aud_cents integer not null check (budget_aud_cents between 100 and 5000),
 reserved_aud_cents integer not null default 0 check (reserved_aud_cents >= 0 and reserved_aud_cents <= budget_aud_cents),
 allowlist uuid[], -- null means separately authorised public use, empty denies all
 authority_reference text not null check (length(authority_reference) >= 32),
 price_evidence_reference text not null check (length(price_evidence_reference) >= 32),
 check (expires_at > starts_at and expires_at <= starts_at + interval '7 days')
);
create table sms_delivery.attempts (
 window_id text not null references sms_delivery.windows(id),
 fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
 user_id uuid not null,
 reserved_at timestamptz not null default clock_timestamp(),
 state text not null default 'pending' check (state in ('pending','accepted','uncertain')),
 finished_at timestamptz,
 primary key (window_id, fingerprint)
);
create index sms_attempt_member_time on sms_delivery.attempts(window_id,user_id,reserved_at desc);
alter table sms_delivery.windows enable row level security;
alter table sms_delivery.attempts enable row level security;
revoke all on all tables in schema sms_delivery from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create function sms_delivery.reserve(w text, f text, u uuid) returns text
 language plpgsql security definer set search_path='' as $$
declare win sms_delivery.windows; previous sms_delivery.attempts; n timestamptz := clock_timestamp();
begin
 if f !~ '^[a-f0-9]{64}$' or u is null then return 'denied'; end if;
 select * into win from sms_delivery.windows where id=w for update;
 -- Lock contention must not reuse a pre-wait time after the window expires.
 n := clock_timestamp();
 if not found or not win.enabled or n<win.starts_at or n>=win.expires_at then return 'denied';end if;
 if win.allowlist is not null and not (u=any(win.allowlist)) then return 'denied';end if;
 if not exists(select 1 from auth.users where id=u and email_confirmed_at is not null
  and not coalesce(is_anonymous,false) and (banned_until is null or banned_until<=n)) then return 'denied';end if;
 select * into previous from sms_delivery.attempts where window_id=w and fingerprint=f;
 if found then
  if previous.user_id<>u then return 'denied';end if;
  return previous.state;
 end if;
 -- Reserve A$1 per single-segment AU attempt. Activation requires verified total
 -- provider cost, FX and tax ceiling <= A$1. Unknown delivery NEVER releases it.
 if win.reserved_aud_cents+100>win.budget_aud_cents then return 'denied';end if;
 if exists(select 1 from sms_delivery.attempts where window_id=w and user_id=u and reserved_at>n-interval '60 seconds')
 or (select count(*) from sms_delivery.attempts where window_id=w and user_id=u and reserved_at>n-interval '1 hour')>=3
 or (select count(*) from sms_delivery.attempts where window_id=w and reserved_at>n-interval '1 hour')>=30 then return 'denied';end if;
 insert into sms_delivery.attempts(window_id,fingerprint,user_id) values(w,f,u);
 update sms_delivery.windows set reserved_aud_cents=reserved_aud_cents+100 where id=w;
 return 'send';
end $$;
create function sms_delivery.finish(w text, f text, accepted boolean) returns void
 language sql security definer set search_path='' as $$
 update sms_delivery.attempts set state=case when accepted then 'accepted' else 'uncertain' end,
 finished_at=clock_timestamp() where window_id=w and fingerprint=f and state='pending';
$$;
revoke all on all functions in schema sms_delivery from public,anon,authenticated,service_role;
grant usage on schema sms_delivery to docked_app;
grant execute on function sms_delivery.reserve(text,text,uuid), sms_delivery.finish(text,text,boolean) to docked_app;
-- No runtime table writes, window creation/extension, replenishment or refunds.
-- No window rows, runtime credentials, provider settings or sends are created.
