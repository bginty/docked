-- No live sport activation, catalogue issuance, pricing or scoring changes.
-- Reuse the reviewed slot command, immutable entry snapshots and draft tables.
insert into beta_fantasy.sports(id,positions,team_size) values('afl','{"DEF":6,"MID":8,"FWD":6,"RUC":2}',22) on conflict do nothing;
create table sports_feed.sport_rounds(
 competition_id uuid primary key references beta_fantasy.competitions,
 sport text not null check(sport in ('afl')),
 fixtures jsonb not null check(jsonb_typeof(fixtures)='array'),
 sandbox boolean not null default true check(sandbox),
 created_at timestamptz not null default clock_timestamp()
);
create table sports_feed.sport_sandbox_access(user_id uuid primary key references auth.users);
create table sports_feed.sport_sandbox_inventory(
 user_id uuid not null references sports_feed.sport_sandbox_access,
 sport text not null check(sport in ('afl')),
 cards jsonb not null check(jsonb_typeof(cards)='array'),primary key(user_id,sport)
);
do $$declare t text;begin foreach t in array array['sport_rounds','sport_sandbox_access','sport_sandbox_inventory'] loop
 execute format('alter table sports_feed.%I enable row level security',t);
 execute format('revoke all on sports_feed.%I from public,anon,authenticated,service_role,docked_beta_app',t);
end loop;end$$;

create function sports_feed.lineup_scope_allowed(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when c.sport='nfl' then c.rules->>'inventory_scope'='invited-nfl-test-v2'
 else current_setting('docked.multi_sport',true)='isolated-preview'
  and c.rules->>'inventory_scope'='isolated-multi-sport-v1'
  and c.rules->>'lock_policy'='round-wide-v1'
  and exists(select 1 from sports_feed.sport_sandbox_access where user_id=auth.uid())
  and exists(select 1 from sports_feed.sport_rounds r where r.competition_id=c.id and r.sport=c.sport and r.sandbox)
  and exists(select 1 from beta_fantasy.lineup_configurations f where f.version=c.rules->>'lineup_version' and f.configuration->>'sport'=c.sport)
 end from beta_fantasy.competitions c where c.id=cid
$$;
create function sports_feed.lineup_inventory(u uuid,cid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sport_id text;begin
 select sport into sport_id from beta_fantasy.competitions where id=cid;
 if sport_id='nfl' then return sports_feed.seven_inventory(u);end if;
 if u is distinct from auth.uid() or sports_feed.lineup_scope_allowed(cid) is distinct from true then raise exception 'Isolated sport access required';end if;
 return coalesce((select cards from sports_feed.sport_sandbox_inventory where user_id=u and sport=sport_id),'[]');
end$$;
create function sports_feed.lineup_fixtures(cid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select fixtures from sports_feed.nfl_rounds where competition_id=cid),
  (select fixtures from sports_feed.sport_rounds where competition_id=cid and sports_feed.lineup_scope_allowed(cid)), '[]')
$$;
create function sports_feed.lineup_position_eligible(card jsonb,slot jsonb) returns boolean language sql immutable set search_path='' as $$
 select exists(select 1 from jsonb_array_elements_text(coalesce(card->'eligible_positions',jsonb_build_array(card->>'position'))) p where slot->'positions' ? p)
$$;

-- Patch the existing implementation rather than introducing another save engine.
do $$declare b text;begin
 b:=pg_get_functiondef('sports_feed.round_wide_registration_guard()'::regprocedure);
 b:=replace(b,'new.sport<>''nfl''','(new.sport<>''nfl'' and not (current_setting(''docked.multi_sport'',true)=''isolated-preview'' and new.rules->>''inventory_scope''=''isolated-multi-sport-v1'' and new.sport=''afl''))');
 execute b;
end$$;
do $$declare b text;begin
 b:=pg_get_functiondef('sports_feed.seven_command(text,jsonb,uuid)'::regprocedure);
 if position('inv:=sports_feed.seven_inventory(u);' in b)=0 then raise exception 'Unexpected lineup engine version';end if;
 b:=replace(b,'c.rules->>''inventory_scope''<>''invited-nfl-test-v2''','sports_feed.lineup_scope_allowed(c.id) is distinct from true');
 b:=replace(b,'inv:=sports_feed.seven_inventory(u);','inv:=sports_feed.lineup_inventory(u,c.id);');
 b:=replace(b,'not(slot->''positions'' ? (card->>''position''))','not sports_feed.lineup_position_eligible(card,slot) or (c.sport<>''nfl'' and (card->>''sport'' is distinct from c.sport or card->>''owner_id'' is distinct from u::text))');
 b:=replace(b,'from sports_feed.nfl_rounds nr,jsonb_array_elements(nr.fixtures) x where nr.competition_id=c.id and','from jsonb_array_elements(sports_feed.lineup_fixtures(c.id)) x where');
 b:=replace(b,'from sports_feed.nfl_rounds nr,jsonb_array_elements(nr.fixtures)x where nr.competition_id=c.id and','from jsonb_array_elements(sports_feed.lineup_fixtures(c.id)) x where');
 b:=replace(b,'raise exception ''Entry requires exactly seven slots; draft may be incomplete'';','if c.sport=''nfl'' then raise exception ''Entry requires exactly seven slots; draft may be incomplete''; else raise exception ''Entry must fill every configured slot; draft may be incomplete'';end if;');
 execute b;
end$$;

-- Extend the same rollover implementation to isolated sport rounds. Immutable
-- revisions still define established teams; no recommendation is performed.
do $$declare b text;begin
 b:=pg_get_functiondef('sports_feed.seven_continue_teams()'::regprocedure);
 b:=replace(b,'join beta_fantasy.production_rounds pr on pr.competition_id=c.id','left join beta_fantasy.production_rounds pr on pr.competition_id=c.id');
 b:=replace(b,'join sports_feed.nfl_rounds nr on nr.competition_id=c.id','left join sports_feed.nfl_rounds nr on nr.competition_id=c.id');
 b:=replace(b,'where c.sport=''nfl'' and','where');
 b:=replace(b,'c.rules->>''inventory_scope''=''invited-nfl-test-v2''','sports_feed.lineup_scope_allowed(c.id)');
 b:=replace(b,'pr.release_channel=beta_fantasy.production_channel() and nr.purpose=''member''','((c.sport=''nfl'' and pr.release_channel=beta_fantasy.production_channel() and nr.purpose=''member'') or (c.sport<>''nfl'' and sports_feed.lineup_scope_allowed(c.id)))');
 b:=replace(b,'and pr.release_channel=beta_fantasy.production_channel()','and (pr.release_channel=beta_fantasy.production_channel() or (c.sport<>''nfl'' and sports_feed.lineup_scope_allowed(c.id)))');
 b:=replace(b,'if inv is null then inv:=sports_feed.seven_inventory(u);end if;','inv:=sports_feed.lineup_inventory(u,target.id);');
 b:=replace(b,'not(slot->''positions'' ? (card->>''position''))','not sports_feed.lineup_position_eligible(card,slot)');
 b:=replace(b,'from sports_feed.nfl_rounds n,jsonb_array_elements(n.fixtures)f where n.competition_id=target.id and','from jsonb_array_elements(sports_feed.lineup_fixtures(target.id)) f where');
 execute b;
end$$;

create function sports_feed.sport_sandbox_state(sport_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;continuity jsonb;begin
 u:=beta_fantasy.production_eligible();
 if auth.jwt()->>'aal' is distinct from 'aal2' or current_setting('docked.multi_sport',true) is distinct from 'isolated-preview' or not beta_private.active_member_session()
 or not exists(select 1 from sports_feed.sport_sandbox_access where user_id=u) then raise exception 'Isolated sport access required';end if;
 continuity:=sports_feed.seven_continue_teams();
 perform sports_feed.seven_lock_due();
 return jsonb_build_object('user_id',u,'sport',sport_id,'server_time',clock_timestamp(),'continuity',continuity,
 'cards',coalesce((select cards from sports_feed.sport_sandbox_inventory where user_id=u and sport=sport_id),'[]'),
 'configurations',coalesce((select jsonb_object_agg(version,configuration) from beta_fantasy.lineup_configurations where configuration->>'sport'=sport_id),'{}'),
 'competitions',coalesce((select jsonb_agg(to_jsonb(c)) from beta_fantasy.competitions c join sports_feed.sport_rounds r on r.competition_id=c.id where c.sport=sport_id and sports_feed.lineup_scope_allowed(c.id)),'[]'),
 'drafts',coalesce((select jsonb_agg(to_jsonb(d)-'user_id') from beta_fantasy.round_drafts d join sports_feed.sport_rounds r on r.competition_id=d.competition_id where d.user_id=u and r.sport=sport_id),'[]'),
 'entries',coalesce((select jsonb_agg(jsonb_build_object('competition_id',e.competition_id,'user_id',e.user_id,'snapshot',e.snapshot,'revision',e.lineup_revision,'updated_at',e.updated_at)) from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id join sports_feed.sport_rounds r on r.competition_id=c.id
 where r.sport=sport_id and (e.user_id=u or (c.locks_at<=clock_timestamp() and exists(select 1 from beta_fantasy.entries own where own.competition_id=c.id and own.user_id=u)))),'[]'));
end$$;
revoke all on function sports_feed.lineup_scope_allowed(uuid),sports_feed.lineup_inventory(uuid,uuid),sports_feed.lineup_fixtures(uuid),sports_feed.lineup_position_eligible(jsonb,jsonb),sports_feed.sport_sandbox_state(text) from public,anon,authenticated,service_role,docked_beta_app;
grant execute on function sports_feed.sport_sandbox_state(text) to docked_beta_app;

-- App role may execute only this scope-bound wrapper, not the private save engine.
create function sports_feed.sport_sandbox_command(action text,p jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.jwt()->>'aal' is distinct from 'aal2' or current_setting('docked.multi_sport',true) is distinct from 'isolated-preview'
 or not exists(select 1 from sports_feed.sport_rounds where competition_id=(p->>'competition_id')::uuid)
 or sports_feed.lineup_scope_allowed((p->>'competition_id')::uuid) is distinct from true then raise exception 'Isolated staff MFA required';end if;
 return sports_feed.seven_command(action,p,request_id);
end$$;
revoke all on function sports_feed.sport_sandbox_command(text,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function sports_feed.sport_sandbox_command(text,jsonb,uuid) to docked_beta_app;
