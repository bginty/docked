-- Reviewed immutable season membership, separate from live participation and
-- collection permission. Empty until the separately hashed adoption is approved.
create schema season_catalogue;
revoke all on schema season_catalogue from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_nfl_worker,docked_commercial_app;
create table season_catalogue.rights(
 id text primary key, sport text not null check(sport in('nfl','afl','nrl')),
 season text not null, scope text not null check(scope in('free_weekly','commercial')),
 valid_from timestamptz not null, valid_until timestamptz,
 evidence jsonb not null check(jsonb_typeof(evidence)='object'),
 approval_reference text not null check(length(approval_reference)>20),
 check(valid_until is null or valid_until>valid_from), unique(id,sport,season,scope)
);
create table season_catalogue.members(
 sport text not null, season text not null, player_id uuid not null,
 scope text not null, rights_id text not null, provider text not null, provider_id text not null,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'), edition_id uuid,
 evidence jsonb not null check(jsonb_typeof(evidence)='object'),
 evidence_sha256 text not null check(evidence_sha256~'^[a-f0-9]{64}$'),
 approval_reference text not null check(length(approval_reference)>20),
 primary key(sport,season,player_id,scope), unique(sport,season,provider,provider_id,scope),
 foreign key(rights_id,sport,season,scope) references season_catalogue.rights(id,sport,season,scope)
);
-- Append-only explicit rights/identity decisions. A fresh observation can never
-- lift a restriction. Rights revocation is separate from collection expiry.
create table season_catalogue.decisions(
 id bigint generated always as identity primary key, rights_id text not null references season_catalogue.rights,
 player_id uuid, blocked boolean not null, reason text not null check(length(reason)>10),
 authority_reference text not null check(length(authority_reference)>20),
 recorded_at timestamptz not null default clock_timestamp()
);
create index season_decision_lookup on season_catalogue.decisions(rights_id,player_id,id desc);
create function season_catalogue.serialize_decision() returns trigger language plpgsql set search_path='' as $$begin
 perform pg_advisory_xact_lock(71820342); return new;
end$$;
create trigger serialize_decision before insert on season_catalogue.decisions for each row execute function season_catalogue.serialize_decision();
create function season_catalogue.can_issue(s text,y text,p uuid,kind text) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from season_catalogue.members m join season_catalogue.rights r on r.id=m.rights_id
 where m.sport=s and m.season=y and m.player_id=p and m.scope=kind
 and r.valid_from<=statement_timestamp() and (r.valid_until is null or r.valid_until>statement_timestamp())
 and not coalesce((select d.blocked from season_catalogue.decisions d where d.rights_id=r.id and d.player_id is null order by d.id desc limit 1),false)
 and not coalesce((select d.blocked from season_catalogue.decisions d where d.rights_id=r.id and d.player_id=p order by d.id desc limit 1),false))
$$;
do $$declare t text;begin
 foreach t in array array['rights','members','decisions'] loop
  execute format('alter table season_catalogue.%I enable row level security',t);
  execute format('revoke all on season_catalogue.%I from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_nfl_worker,docked_commercial_app',t);
  execute format('create trigger immutable before update or delete on season_catalogue.%I for each row execute function commercial_billing.immutable()',t);
  execute format('create trigger no_truncate before truncate on season_catalogue.%I for each statement execute function commercial_billing.immutable()',t);
 end loop;
end$$;
revoke all on all sequences in schema season_catalogue from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_nfl_worker,docked_commercial_app;
revoke all on all functions in schema season_catalogue from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_nfl_worker,docked_commercial_app;
