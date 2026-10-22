-- Invitation-only, synthetic gameplay extension. No issuance, credits, pricing,
-- provider activation or public access. Existing NBA identities remain canonical.
create table sports_feed.private_beta_sports (
 sport text primary key check(sport in ('afl','nrl')),
 enabled boolean not null default false,
 authority text not null,
 updated_at timestamptz not null default clock_timestamp()
);
create table sports_feed.private_beta_sport_audit (
 id bigint generated always as identity primary key,
 sport text not null, previous jsonb, current jsonb not null,
 actor text not null default current_user, recorded_at timestamptz not null default clock_timestamp()
);
alter table sports_feed.private_beta_sports enable row level security;
alter table sports_feed.private_beta_sport_audit enable row level security;
revoke all on sports_feed.private_beta_sports,sports_feed.private_beta_sport_audit from public,anon,authenticated,service_role,docked_beta_app;
create function sports_feed.audit_private_beta_sport() returns trigger language plpgsql security invoker set search_path='' as $$begin
 insert into sports_feed.private_beta_sport_audit(sport,previous,current) values(new.sport,to_jsonb(old),to_jsonb(new));return new;
end$$;
create trigger audit after insert or update on sports_feed.private_beta_sports for each row execute function sports_feed.audit_private_beta_sport();
create trigger immutable before update or delete on sports_feed.private_beta_sport_audit for each row execute function credits_sandbox.immutable();
create trigger no_truncate before truncate on sports_feed.private_beta_sport_audit for each statement execute function credits_sandbox.immutable();
insert into sports_feed.private_beta_sports(sport,authority) values
 ('afl','Disabled preparation; owner-authorised isolated private testing only'),
 ('nrl','Disabled preparation; provisional isolated private testing only');

create function sports_feed.private_beta_sport() returns text language sql stable set search_path='' as $$
 select coalesce(nullif(current_setting('docked.private_beta_sport',true),''),'basketball')
$$;
create function sports_feed.private_beta_sport_identity() returns uuid language plpgsql stable security definer set search_path='' as $$
declare u uuid; s text:=sports_feed.private_beta_sport();begin
 u:=sports_feed.nba_beta_identity();
 if s not in ('basketball','afl','nrl') or (s<>'basketball' and
  (current_setting('docked.sports_private_beta',true) is distinct from 'enabled'
   or not exists(select 1 from sports_feed.private_beta_sports where sport=s and enabled)))
 then raise exception 'Sport private beta access required';end if;
 return u;
end$$;
create function sports_feed.private_beta_sport_capability() returns boolean language plpgsql stable security definer set search_path='' as $$begin
 perform sports_feed.private_beta_sport_identity();return true;
end$$;
revoke all on function sports_feed.audit_private_beta_sport(),sports_feed.private_beta_sport(),sports_feed.private_beta_sport_identity(),sports_feed.private_beta_sport_capability() from public,anon,authenticated,service_role,docked_beta_app;
grant execute on function sports_feed.private_beta_sport_capability() to docked_beta_app;

do $$declare b text;needle text;begin
 b:=pg_get_functiondef('sports_feed.sandbox_identity()'::regprocedure);
 needle:='return sports_feed.nba_beta_identity();';
 if position(needle in b)=0 then raise exception 'Unexpected NBA identity guard';end if;
 execute replace(b,needle,'return sports_feed.private_beta_sport_identity();');
 b:=pg_get_functiondef('sports_feed.lineup_scope_allowed(uuid)'::regprocedure);
 needle:='(c.sport=''basketball'' and c.rules->>''nba_beta_scope''=''private-test-v1'' and c.rules->>''lineup_version''=''docked-nba-weekly-lineup-proposal-v1'')';
 if position(needle in b)=0 then raise exception 'Unexpected NBA competition scope';end if;
 execute replace(b,needle,'(c.sport=sports_feed.private_beta_sport() and ((c.sport=''basketball'' and c.rules->>''nba_beta_scope''=''private-test-v1'' and c.rules->>''lineup_version''=''docked-nba-weekly-lineup-proposal-v1'') or (c.sport in (''afl'',''nrl'') and c.rules->>''sport_beta_scope''=''private-test-v1'' and current_setting(''docked.sports_private_beta'',true)=''enabled'' and exists(select 1 from sports_feed.private_beta_sports s where s.sport=c.sport and s.enabled))))');
 b:=pg_get_functiondef('sports_feed.sport_sandbox_state(text)'::regprocedure);
 needle:='u:=sports_feed.sandbox_identity();';
 if position(needle in b)=0 then raise exception 'Unexpected isolated state identity';end if;
 b:=replace(b,needle,needle||' if current_setting(''docked.nba_private_beta'',true)=''enabled'' and sport_id is distinct from sports_feed.private_beta_sport() then raise exception ''Sport context mismatch'';end if;');
 b:=replace(b,'where d.user_id=u and r.sport=sport_id','where d.user_id=u and r.sport=sport_id and sports_feed.lineup_scope_allowed(d.competition_id)');
 b:=replace(b,'where r.sport=sport_id and (e.user_id=u','where r.sport=sport_id and sports_feed.lineup_scope_allowed(c.id) and (e.user_id=u');
 execute b;
end$$;
