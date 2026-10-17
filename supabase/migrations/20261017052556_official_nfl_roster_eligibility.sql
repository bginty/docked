-- Prepared and tested locally only. No hosted activation or data cleanup here.
create schema nfl_roster;
revoke all on schema nfl_roster from public,anon,authenticated,service_role;
create table nfl_roster.control(id boolean primary key check(id),enabled boolean not null default false);
insert into nfl_roster.control values(true,false);
create table nfl_roster.observations(
 player_id text not null,provider_id text not null,team text not null,
 position text not null,status text not null check(status in('active','reserve','practice-squad','released','retired','unknown')),
 identity_verified boolean not null,source_url text not null check(source_url like 'https://%'),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),checked_at timestamptz not null,
 evidence jsonb not null,primary key(player_id,checked_at)
);
create index roster_latest on nfl_roster.observations(player_id,checked_at desc);
alter table nfl_roster.control enable row level security;
alter table nfl_roster.observations enable row level security;
create function nfl_roster.immutable() returns trigger language plpgsql security invoker set search_path='' as $$begin raise exception 'Roster evidence is append-only';end$$;
create trigger immutable before update or delete on nfl_roster.observations for each row execute function nfl_roster.immutable();
create trigger no_truncate before truncate on nfl_roster.observations for each statement execute function nfl_roster.immutable();
create view nfl_roster.current_evidence with(security_invoker=true) as
 select distinct on(player_id) * from nfl_roster.observations order by player_id,checked_at desc,source_hash;
-- Current roster is an additional acquisition gate, never a historical score edit.
create function nfl_roster.can_issue(pid text, fantasy_position text) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce(fantasy_position in('QB','RB','WR','TE') and (
 not exists(select 1 from nfl_roster.control where enabled)
 or exists(select 1 from nfl_roster.current_evidence r where r.player_id=pid and r.identity_verified
 and r.status='active' and r.checked_at<=statement_timestamp() and r.checked_at>statement_timestamp()-interval '72 hours'
 and (fantasy_position=any(string_to_array(r.position,'/')) or (fantasy_position='RB' and r.position in('FB','HB'))))),false)
$$;
create function nfl_roster.guard_mint() returns trigger language plpgsql security invoker set search_path='' as $$
declare pid text; pos text; sport text;begin
 if tg_table_schema='credits_sandbox' then
  select p.id,p.identity->>'position',p.sport into pid,pos,sport from credits_sandbox.card_definitions d join credits_sandbox.permanent_players p on p.id=d.player_id where d.id=new.definition;
 else
  select p.id::text,p.position,p.sport into pid,pos,sport from beta_fantasy.editions e join beta_fantasy.players p on p.id=e.player_id where e.id=new.edition_id;
 end if;
 if sport='nfl' and not nfl_roster.can_issue(pid,pos) then raise exception 'Official NFL roster eligibility required; no cards issued';end if;
 return new;
end$$;
create trigger nfl_roster_mint_guard before insert on credits_sandbox.card_instances for each row execute function nfl_roster.guard_mint();
create trigger nfl_roster_mint_guard before insert on beta_fantasy.cards for each row execute function nfl_roster.guard_mint();
revoke all on all tables in schema nfl_roster from public,anon,authenticated,service_role;
revoke all on all functions in schema nfl_roster from public,anon,authenticated,service_role;
grant usage on schema nfl_roster to docked_beta_app;
grant select on nfl_roster.control,nfl_roster.observations,nfl_roster.current_evidence to docked_beta_app;
create policy runtime_read on nfl_roster.control for select to docked_beta_app using(true);
create policy runtime_read on nfl_roster.observations for select to docked_beta_app using(true);
grant execute on function nfl_roster.can_issue(text,text),nfl_roster.guard_mint() to docked_beta_app;
