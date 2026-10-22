-- Owner-authorised, fictional NBA testing on the existing private beta host.
-- No roster/limited issuance, credits, settlement, provider or scheduled-job changes.
create table sports_feed.nba_beta_control (
 id boolean primary key default true check(id), enabled boolean not null default false,
 authority text not null, updated_at timestamptz not null default clock_timestamp()
);
create table sports_feed.nba_beta_access (
 user_id uuid primary key references auth.users, enabled boolean not null default false,
 authority text not null, expires_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table sports_feed.nba_beta_control enable row level security;
alter table sports_feed.nba_beta_access enable row level security;
revoke all on sports_feed.nba_beta_control,sports_feed.nba_beta_access from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create function sports_feed.nba_beta_identity() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if current_setting('docked.nba_private_beta',true) is distinct from 'enabled'
 or current_setting('docked.multi_sport',true) is distinct from 'isolated-preview'
 or not exists(select 1 from sports_feed.nba_beta_control where enabled)
 or not exists(select 1 from sports_feed.nba_beta_access where user_id=u and enabled and expires_at>clock_timestamp())
 or not exists(select 1 from sports_feed.sport_sandbox_access where user_id=u)
 or not beta_private.active_member_session()
 or not beta_private.beta_gameplay_identity(u)
 or not exists(select 1 from auth.users a join auth.sessions s on s.user_id=a.id
   where a.id=u and s.id=nullif(auth.jwt()->>'session_id','')::uuid
   and (s.not_after is null or s.not_after>clock_timestamp())
   and a.email_confirmed_at is not null and not coalesce(a.is_anonymous,false)
   and coalesce(a.banned_until,'-infinity')<=clock_timestamp())
 or (beta_private.gameplay_mfa_required(u) and auth.jwt()->>'aal' is distinct from 'aal2')
 then raise exception 'Verified NBA beta access required';end if;
 return u;
end$$;
create function sports_feed.nba_beta_capability() returns boolean
language plpgsql stable security definer set search_path='' as $$begin
 perform sports_feed.nba_beta_identity();return true;
end$$;
revoke all on function sports_feed.nba_beta_identity(),sports_feed.nba_beta_capability() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function sports_feed.nba_beta_capability() to docked_beta_app;

-- Reuse the existing isolated inventory and lineup implementation, with the
-- existing member MFA policy. The original Preview still requires AAL2 for all.
do $$declare b text;needle text;sig text;begin
 b:=pg_get_functiondef('sports_feed.sandbox_identity()'::regprocedure);
 needle:='declare u uuid:=auth.uid();begin';
 if position(needle in b)=0 then raise exception 'Unexpected sandbox identity';end if;
 b:=replace(b,needle,needle||' if current_setting(''docked.nba_private_beta'',true)=''enabled'' then return sports_feed.nba_beta_identity();end if;');execute b;
 b:=pg_get_functiondef('sports_feed.lineup_scope_allowed(uuid)'::regprocedure);
 needle:='else current_setting(''docked.multi_sport'',true)=''isolated-preview''';
 if position(needle in b)=0 then raise exception 'Unexpected scope guard';end if;
 b:=replace(b,needle,needle||' and (coalesce(current_setting(''docked.nba_private_beta'',true),'''')<>''enabled'' or (c.sport=''basketball'' and c.rules->>''nba_beta_scope''=''private-test-v1'' and c.rules->>''lineup_version''=''docked-nba-weekly-lineup-proposal-v1''))');execute b;
 foreach sig in array array['sports_feed.sport_sandbox_state(text)','sports_feed.sport_sandbox_command(text,jsonb,uuid)'] loop
  b:=pg_get_functiondef(sig::regprocedure);
  needle:='auth.jwt()->>''aal'' is distinct from ''aal2''';
  if position(needle in b)=0 then raise exception 'Unexpected sandbox MFA guard';end if;
  b:=replace(b,needle,'(auth.jwt()->>''aal'' is distinct from ''aal2'' and coalesce(current_setting(''docked.nba_private_beta'',true),'''')<>''enabled'')');
  -- Identity must be independently checked for writes as well as reads.
  if sig='sports_feed.sport_sandbox_command(text,jsonb,uuid)' then
   b:=replace(b,'begin','begin perform sports_feed.sandbox_identity();');
  end if;
  execute b;
 end loop;
end$$;
