-- Additive, isolated test rounds. Existing entries, inventory and rules are untouched.
create table beta_fantasy.lineup_configurations(version text primary key, configuration jsonb not null, created_at timestamptz not null default clock_timestamp());
create trigger immutable before update or delete on beta_fantasy.lineup_configurations for each row execute function beta_fantasy.immutable();
create table beta_fantasy.round_drafts(competition_id uuid references beta_fantasy.competitions,user_id uuid references beta_fantasy.members,revision integer not null check(revision>0),selections jsonb not null,updated_at timestamptz not null default clock_timestamp(),primary key(competition_id,user_id));
alter table beta_fantasy.entries add column lineup_revision integer not null default 0;
create unique index nfl_weekly_mode on beta_fantasy.competitions(sport,season,round,(rules->>'mode')) where rules->>'lineup_version' is not null;
create table beta_fantasy.entry_revisions(id bigint generated always as identity primary key,competition_id uuid not null references beta_fantasy.competitions,user_id uuid not null,revision integer not null,action text not null,snapshot jsonb not null,actor uuid not null,recorded_at timestamptz not null default clock_timestamp(),unique(competition_id,user_id,revision));
create table beta_fantasy.slot_locks(competition_id uuid references beta_fantasy.competitions,user_id uuid not null,slot text not null,snapshot jsonb not null,locked_at timestamptz not null,observed_at timestamptz not null default clock_timestamp(),primary key(competition_id,user_id,slot));
create table beta_fantasy.round_controls(competition_id uuid primary key references beta_fantasy.competitions,enabled boolean not null default true,standings_visible boolean not null default true,revision integer not null default 0);
create trigger immutable before update or delete on beta_fantasy.entry_revisions for each row execute function beta_fantasy.immutable();
create trigger immutable before update or delete on beta_fantasy.slot_locks for each row execute function beta_fantasy.immutable();
do $$declare t text;begin foreach t in array array['lineup_configurations','round_drafts','entry_revisions','slot_locks','round_controls'] loop
 execute format('alter table beta_fantasy.%I enable row level security',t);
 execute format('revoke all on beta_fantasy.%I from public,anon,authenticated,service_role,docked_beta_app',t);
 end loop;end$$;

-- One snapshot configuration is installed by the reviewed operator registration script.
-- All member-facing salaries and slot definitions are read from that same immutable row.
create function sports_feed.seven_inventory(u uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select sports_feed.rarity_inventory(u)||coalesce(jsonb_agg(jsonb_build_object(
 'id',a.id,'card_id',a.id,'owner_id',u,'edition_id',e.id,'player_id',permanent.id,'canonical_player_id',permanent.id,
 'tier','CORE','position',pl.position,'name',pl.name,'team',np.current_team,'sport','nfl',
 'status',case when np.source_status='ACT' and np.observed_at>clock_timestamp()-interval '72 hours' then 'active' else 'unavailable' end,
 'listed',exists(select 1 from beta_fantasy.listings where card_id=a.id and state='active'),
 'serial',a.serial,'max_supply',0,'multiplier',1,'multiplierTenths',10,'rarityVersion',rc.version,
 'colour',pl.colour,'shirt',pl.shirt,'tradeable',a.tradeable,'season',e.season,'kind',e.kind,
 'created_at',a.created_at,'acquired_at',a.created_at,'provider_id',np.provider_id,'inventory_scope','invited-nfl-test-v2')),'[]')
 from beta_fantasy.cards a join beta_fantasy.editions e on e.id=a.edition_id
 join beta_fantasy.players pl on pl.id=e.player_id join sports_feed.nfl_players np on np.player_id=pl.id
 join credits_sandbox.permanent_players permanent on permanent.provider_id=np.provider_id
 join credits_sandbox.rarity_configuration rc on rc.version=(select document->'economy'->>'rarityVersion' from credits_sandbox.state where id)
 where a.owner_id=u and e.tier='CORE'
$$;

create function sports_feed.seven_lock_due() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;begin
 perform pg_advisory_xact_lock(71820342);
 insert into beta_fantasy.slot_locks(competition_id,user_id,slot,snapshot,locked_at)
 select e.competition_id,e.user_id,s->>'slot',s,(s->>'kickoff')::timestamptz
 from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id,jsonb_array_elements(e.snapshot)s
 where c.rules->>'lineup_version' is not null and (s->>'kickoff')::timestamptz<=clock_timestamp()
 on conflict do nothing;
 get diagnostics n=row_count;
 update sports_feed.nfl_rounds nr set locked_snapshot='[]',locked_at=c.locks_at
 from beta_fantasy.competitions c where c.id=nr.competition_id and c.rules->>'lineup_version' is not null and nr.locked_at is null and c.locks_at<=clock_timestamp();
 return n;
end$$;

-- Existing scheduler is reused; legacy whole-round snapshots exclude rolling modes.
alter function sports_feed.nfl_lock_due() rename to nfl_lock_due_before_seven;
do $$declare b text;begin b:=pg_get_functiondef('sports_feed.nfl_lock_due_before_seven()'::regprocedure);b:=replace(b,'where nr.locked_at is null and c.locks_at','where c.rules->>''lineup_version'' is null and nr.locked_at is null and c.locks_at');execute b;end$$;
create function sports_feed.nfl_lock_due() returns integer language plpgsql security definer set search_path='' as $$begin return sports_feed.seven_lock_due()+sports_feed.nfl_lock_due_before_seven();end$$;

-- Drafts never reserve ownership. Submitted unlocked cards do; locked entitlement survives transfer.
create function sports_feed.card_entry_reserved(cid uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 perform sports_feed.seven_lock_due();
 return exists(select 1 from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id where cid=any(e.cards) and c.scored_at is null and
 (c.rules->>'lineup_version' is null or not exists(select 1 from beta_fantasy.slot_locks l where l.competition_id=e.competition_id and l.user_id=e.user_id and l.snapshot->>'card_id'=cid::text)));
end$$;
create or replace function sports_feed.rarity_transfer_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(71820342);
 if exists(select 1 from jsonb_each(old.document->'commerce'->'cards') a where a.value->>'owner' is distinct from new.document->'commerce'->'cards'->a.key->>'owner' and sports_feed.card_entry_reserved(a.key::uuid)) then
 raise exception 'Card is in an unlocked submitted team. Replace it, or withdraw before entries close';end if;
 return new;
end$$;
do $$declare sig text;b text;begin foreach sig in array array['beta_fantasy.transferable(uuid,uuid)','beta_fantasy.swap_card(uuid,uuid)'] loop
 b:=pg_get_functiondef(sig::regprocedure);
 b:=replace(b,'exists(select 1 from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id where cid=any(e.cards) and c.scored_at is null)','sports_feed.card_entry_reserved(cid)');execute b;
 end loop;end$$;
-- Defense in depth for every direct Core ownership update, without changing transfer permissions.
create function sports_feed.seven_core_transfer_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.owner_id is distinct from old.owner_id and sports_feed.card_entry_reserved(old.id) then raise exception 'Card reserved by submitted lineup';end if;return new;end$$;
create trigger seven_core_transfer before update of owner_id on beta_fantasy.cards for each row execute function sports_feed.seven_core_transfer_guard();

create function sports_feed.seven_command(action text,p jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;c beta_fantasy.competitions;cfg jsonb;inv jsonb;item jsonb;card jsonb;slot jsonb;locked jsonb;f jsonb;
 prior beta_fantasy.requests;e beta_fantasy.entries;d beta_fantasy.round_drafts;
 snap jsonb:='[]';ids uuid[]:='{}';players text[]:='{}';slots text[]:='{}';total bigint:=0;rev integer;answer jsonb;now_at timestamptz;
begin
 perform pg_advisory_xact_lock(71820342);
 u:=beta_fantasy.production_eligible();
 if not beta_private.active_member_session() or not exists(select 1 from credits_sandbox.access where user_id=u and enabled) then raise exception 'Invited test member required';end if;
 perform 1 from credits_sandbox.state where id for update;
 perform sports_feed.seven_lock_due();now_at:=clock_timestamp();
 if action not in('seven_draft','seven_enter','seven_withdraw') or request_id is null or jsonb_typeof(p)<>'object' then raise exception 'Invalid lineup command';end if;
 select * into prior from beta_fantasy.requests q where q.user_id=u and q.request_id=seven_command.request_id;
 if found then if prior.action<>action or prior.payload<>p then raise exception 'Request ID reused';end if;return prior.result;end if;
 if (select count(*) from jsonb_object_keys(p))<>3 or not p ?& array['competition_id','revision','selections'] or jsonb_typeof(p->'selections')<>'array' or (p->>'revision')!~'^[0-9]+$' then raise exception 'Exact versioned selection payload required';end if;
 select * into strict c from beta_fantasy.competitions where id=(p->>'competition_id')::uuid;
 select configuration into cfg from beta_fantasy.lineup_configurations where version=c.rules->>'lineup_version';
 if cfg is null or c.rules->>'mode' not in('SALARY_CAP','OPEN') or c.rules->>'inventory_scope'<>'invited-nfl-test-v2' or c.scored_at is not null or c.opens_at>now_at or exists(select 1 from beta_fantasy.round_controls where competition_id=c.id and not enabled) then raise exception 'Competition unavailable';end if;
 select * into e from beta_fantasy.entries where competition_id=c.id and user_id=u for update;
 select * into d from beta_fantasy.round_drafts where competition_id=c.id and user_id=u for update;
 if (action='seven_draft' and coalesce(d.revision,0)<>(p->>'revision')::int) or (action<>'seven_draft' and coalesce(e.lineup_revision,0)<>(p->>'revision')::int) then raise exception 'Team changed in another window. Refresh before saving';end if;
 if c.locks_at<=now_at and (e.id is null or action='seven_withdraw') then raise exception 'New entries and withdrawals closed at first kickoff';end if;
 if action='seven_withdraw' then
 if p->'selections'<>'[]' then raise exception 'Empty withdrawal selections required';end if;
 select coalesce(max(revision),0)+1 into rev from beta_fantasy.entry_revisions where competition_id=c.id and user_id=u;
 insert into beta_fantasy.entry_revisions(competition_id,user_id,revision,action,snapshot,actor) values(c.id,u,rev,action,coalesce(e.snapshot,'[]'),u);
 delete from beta_fantasy.entries where competition_id=c.id and user_id=u;
 answer:=jsonb_build_object('withdrawn',true,'competition_id',c.id);
 else
 if jsonb_array_length(p->'selections')>jsonb_array_length(cfg->'slots') or (action='seven_enter' and jsonb_array_length(p->'selections')<>jsonb_array_length(cfg->'slots')) then raise exception 'Entry requires exactly seven slots; draft may be incomplete';end if;
 inv:=sports_feed.seven_inventory(u);
 for item in select value from jsonb_array_elements(p->'selections') loop
 if (select count(*) from jsonb_object_keys(item))<>2 or not item ?& array['slot','card'] then raise exception 'Only slot and card ID accepted';end if;
 select value into slot from jsonb_array_elements(cfg->'slots') where value->>'id'=item->>'slot';
 if slot is null or item->>'slot'=any(slots) then raise exception 'Invalid or repeated slot';end if;
 select snapshot into locked from beta_fantasy.slot_locks where competition_id=c.id and user_id=u and beta_fantasy.slot_locks.slot=item->>'slot';
 if locked is not null then
 if locked->>'card_id'<>item->>'card' then raise exception 'Started player cannot be replaced or moved';end if;card:=locked;
 else
 select value into card from jsonb_array_elements(inv) where value->>'id'=item->>'card';
 if card is null or card->>'status'<>'active' or (card->>'listed')::boolean or not(slot->'positions' ? (card->>'position')) then raise exception 'Owned, opened, unlisted eligible card required for this position';end if;
 if (select count(*) from sports_feed.nfl_rounds nr,jsonb_array_elements(nr.fixtures) x where nr.competition_id=c.id and x->'playerIds' ? (card->>'player_id'))<>1 then raise exception 'Reliable unique fixture mapping required';end if;
 select x into f from sports_feed.nfl_rounds nr,jsonb_array_elements(nr.fixtures)x where nr.competition_id=c.id and x->'playerIds' ? (card->>'player_id');
 if f->>'scheduledAt' is null or coalesce(f->>'status','scheduled')<>'scheduled' then raise exception 'Fixture time unavailable or schedule under review';end if;
 if (f->>'scheduledAt')::timestamptz<=now_at then raise exception 'A player whose game started cannot be added';end if;
 card:=card||jsonb_build_object('card_id',card->>'id','slot',item->>'slot','kickoff',f->>'scheduledAt','fixture_id',f->>'fixtureId','salary',cfg->'salaries'->(card->>'tier'),'lineup_version',cfg->>'version','rules_version',c.rules->>'scoring_version');
 end if;
 if card->>'player_id'=any(players) then raise exception 'Only one card of each underlying player';end if;
 if card->>'salary' is null or card->>'multiplierTenths' is null then raise exception 'Authoritative card configuration unavailable';end if;
 total:=total+(card->>'salary')::bigint;snap:=snap||jsonb_build_array(card);ids:=array_append(ids,(card->>'card_id')::uuid);players:=array_append(players,card->>'player_id');slots:=array_append(slots,item->>'slot');
 end loop;
 if exists(select 1 from beta_fantasy.slot_locks where competition_id=c.id and user_id=u and not(beta_fantasy.slot_locks.slot=any(slots))) then raise exception 'Locked slots must remain in their original position';end if;
 if c.rules->>'mode'='SALARY_CAP' and total>(cfg->>'salaryCap')::bigint then raise exception 'Salary cap exceeded: attempted %, cap %',total,cfg->>'salaryCap';end if;
 if action='seven_draft' then
 rev:=coalesce(d.revision,0)+1;
 insert into beta_fantasy.round_drafts values(c.id,u,rev,p->'selections',now_at) on conflict(competition_id,user_id) do update set revision=excluded.revision,selections=excluded.selections,updated_at=excluded.updated_at;
 else
 select coalesce(max(revision),0)+1 into rev from beta_fantasy.entry_revisions where competition_id=c.id and user_id=u;
 insert into beta_fantasy.entries(competition_id,user_id,cards,snapshot,lineup_revision) values(c.id,u,ids,snap,rev) on conflict(competition_id,user_id) do update set cards=excluded.cards,snapshot=excluded.snapshot,lineup_revision=excluded.lineup_revision,updated_at=now_at;
 insert into beta_fantasy.entry_revisions(competition_id,user_id,revision,action,snapshot,actor) values(c.id,u,rev,action,snap,u);
 insert into sports_feed.stream_members(stream_id,user_id) select stream_id,u from sports_feed.nfl_rounds where competition_id=c.id on conflict do nothing;
 end if;
 answer:=jsonb_build_object('saved',true,'entered',action='seven_enter','revision',rev,'salary',total,'competition_id',c.id);
 end if;
 insert into beta_fantasy.requests values(u,request_id,action,p,answer);
 insert into beta_private.audit_events(actor,action,subject,details) values(u::text,action,c.id::text,jsonb_build_object('revision',rev,'request',request_id,'previous',case when action='seven_draft' then d.selections else e.snapshot end,'result',answer));
 return answer;
end$$;

-- Block legacy save_lineup from bypassing the distinct draft/entry and rolling rules.
alter function beta_fantasy.production_command(text,jsonb,uuid) rename to production_command_before_seven;
do $$begin execute replace(pg_get_functiondef('beta_fantasy.production_command_before_seven(text,jsonb,uuid)'::regprocedure),'production_command.request_id','production_command_before_seven.request_id');end$$;
create function beta_fantasy.production_command(action text,p jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if action='seven_admin_control' then return sports_feed.seven_admin_control(p,request_id);end if;
 if action in('seven_draft','seven_enter','seven_withdraw') then return sports_feed.seven_command(action,p,request_id);end if;
 if action='save_lineup' and exists(select 1 from beta_fantasy.competitions where id=(p->>'competition_id')::uuid and rules->>'lineup_version' is not null) then raise exception 'Use explicit draft or competition entry';end if;
 return beta_fantasy.production_command_before_seven(action,p,request_id);
end$$;

alter function beta_fantasy.production_read_state() rename to production_read_state_before_seven;
create function beta_fantasy.production_read_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;u uuid;begin
 s:=beta_fantasy.production_read_state_before_seven();u:=(s->>'user_id')::uuid;
 if current_setting('docked.nfl_seven',true) is distinct from 'enabled' then
 return s||jsonb_build_object('competitions',coalesce((select jsonb_agg(v) from jsonb_array_elements(s->'competitions')v where v->'rules'->>'lineup_version' is null),'[]'));end if;
 return s||jsonb_build_object('competitions',coalesce((select jsonb_agg(v||jsonb_build_object('rules',(v->'rules')||jsonb_build_object('disabled',not coalesce(rc.enabled,true),'standings_visible',coalesce(rc.standings_visible,true),'control_revision',coalesce(rc.revision,0)))) from jsonb_array_elements(s->'competitions')v left join beta_fantasy.round_controls rc on rc.competition_id=(v->>'id')::uuid),'[]'),'seven',jsonb_build_object(
 'inventory',sports_feed.seven_inventory(u),
 'configurations',coalesce((select jsonb_object_agg(version,configuration) from beta_fantasy.lineup_configurations),'{}'),
 'drafts',coalesce((select jsonb_agg(to_jsonb(d)-'user_id') from beta_fantasy.round_drafts d where user_id=u),'[]'),
 'entries',coalesce((select jsonb_agg(jsonb_build_object('competition_id',e.competition_id,'revision',e.lineup_revision,'snapshot',e.snapshot,'updated_at',e.updated_at)) from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id where user_id=u and c.rules->>'lineup_version' is not null),'[]'),
 'locks',coalesce((select jsonb_agg(to_jsonb(l)-'user_id') from beta_fantasy.slot_locks l where user_id=u),'[]'),
 'fixtures',coalesce((select jsonb_object_agg(n.competition_id,n.fixtures) from sports_feed.nfl_rounds n join beta_fantasy.competitions c on c.id=n.competition_id where c.rules->>'lineup_version' is not null),'{}'),
 'server_time',clock_timestamp()));
end$$;

create function sports_feed.seven_admin_control(p jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;c uuid;old beta_fantasy.round_controls;answer jsonb;prior beta_fantasy.requests;begin
 perform pg_advisory_xact_lock(71820342);u:=beta_fantasy.production_eligible();
 if not beta_private.active_member_session() or auth.jwt()->>'aal' is distinct from 'aal2' or not exists(select 1 from beta_private.roles where user_id=u and role in('owner','admin')) then raise exception 'Owner/admin MFA required';end if;
 if request_id is null or (select count(*) from jsonb_object_keys(p))<>5 or not p ?& array['competition_id','revision','enabled','standings_visible','reason'] or jsonb_typeof(p->'enabled')<>'boolean' or jsonb_typeof(p->'standings_visible')<>'boolean' or length(trim(p->>'reason'))<12 then raise exception 'Explicit controls and reason required';end if;
 select * into prior from beta_fantasy.requests r where user_id=u and r.request_id=seven_admin_control.request_id;
 if found then if prior.action<>'seven_admin_control' or prior.payload<>p then raise exception 'Request ID reused';end if;return prior.result;end if;
 c:=(p->>'competition_id')::uuid;
 if not exists(select 1 from beta_fantasy.competitions where id=c and rules->>'lineup_version' is not null) then raise exception 'Seven-slot round required';end if;
 select * into old from beta_fantasy.round_controls where competition_id=c for update;
 if coalesce(old.revision,0)<>(p->>'revision')::int then raise exception 'Controls changed; refresh';end if;
 insert into beta_fantasy.round_controls values(c,(p->>'enabled')::boolean,(p->>'standings_visible')::boolean,coalesce(old.revision,0)+1) on conflict(competition_id) do update set enabled=excluded.enabled,standings_visible=excluded.standings_visible,revision=excluded.revision;
 answer:=jsonb_build_object('updated',true,'revision',coalesce(old.revision,0)+1);
 insert into beta_private.audit_events(actor,action,subject,details) values(u::text,'seven_round_control',c::text,jsonb_build_object('previous',to_jsonb(old),'result',p,'request',request_id));
 insert into beta_fantasy.requests values(u,request_id,'seven_admin_control',p,answer);return answer;
end$$;
-- Suppression concerns standings only; personal scoring entitlement remains accessible.
alter function sports_feed.nfl_standings() rename to nfl_standings_before_seven;
create function sports_feed.nfl_standings() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements(sports_feed.nfl_standings_before_seven())v where not exists(select 1 from beta_fantasy.round_controls where competition_id=(v->>'competitionId')::uuid and not standings_visible)
$$;
revoke all on function sports_feed.seven_admin_control(jsonb,uuid),sports_feed.nfl_standings_before_seven(),sports_feed.nfl_standings() from public,anon,authenticated,service_role,docked_beta_app;
grant execute on function sports_feed.nfl_standings() to docked_beta_app;

do $$declare f regprocedure;begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
 (n.nspname='sports_feed' and p.proname in('seven_inventory','seven_lock_due','nfl_lock_due','nfl_lock_due_before_seven','card_entry_reserved','seven_core_transfer_guard','seven_command')) or
 (n.nspname='beta_fantasy' and p.proname in('production_command','production_command_before_seven','production_read_state','production_read_state_before_seven')) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role,docked_beta_app',f);end loop;end$$;
grant execute on function beta_fantasy.production_command(text,jsonb,uuid),beta_fantasy.production_read_state() to docked_beta_app;
grant execute on function sports_feed.nfl_lock_due() to docked_nfl_worker;
grant select on beta_fantasy.slot_locks to docked_nfl_worker;
create policy worker_read on beta_fantasy.slot_locks for select to docked_nfl_worker using(true);

create or replace function beta_fantasy.entry_guard() returns trigger language plpgsql set search_path='' as $$
declare cid uuid;c beta_fantasy.competitions;u uuid;cfg jsonb;begin
 cid:=case when tg_op='INSERT' then new.competition_id else old.competition_id end;
 select * into strict c from beta_fantasy.competitions where id=cid;
 if c.rules->>'lineup_version' is null then
 if c.locks_at<=clock_timestamp() or c.opens_at>clock_timestamp() or c.scored_at is not null then raise exception 'Lineup locked';end if;
 else
 perform pg_advisory_xact_lock(71820342);perform sports_feed.seven_lock_due();
 u:=case when tg_op='INSERT' then new.user_id else old.user_id end;
 if c.opens_at>clock_timestamp() or c.scored_at is not null then raise exception 'Lineup locked';end if;
 if (tg_op='DELETE' or (tg_op='INSERT' and not exists(select 1 from beta_fantasy.entries where competition_id=cid and user_id=u))) and c.locks_at<=clock_timestamp() then raise exception 'New entries and withdrawals closed';end if;
 if tg_op='UPDATE' and (new.user_id<>old.user_id or new.competition_id<>old.competition_id or new.id<>old.id) then raise exception 'Entry identity immutable';end if;
 if tg_op<>'DELETE' then
 select configuration into strict cfg from beta_fantasy.lineup_configurations where version=c.rules->>'lineup_version';
 if jsonb_array_length(new.snapshot)<>jsonb_array_length(cfg->'slots') or cardinality(new.cards)<>jsonb_array_length(cfg->'slots') or
 (select count(distinct s->>'player_id') from jsonb_array_elements(new.snapshot)s)<>jsonb_array_length(cfg->'slots') or
 (select count(distinct s->>'slot') from jsonb_array_elements(new.snapshot)s)<>jsonb_array_length(cfg->'slots') then raise exception 'Complete unique seven-slot snapshot required';end if;
 if exists(select 1 from beta_fantasy.slot_locks l where l.competition_id=cid and l.user_id=u and l.snapshot is distinct from (select s from jsonb_array_elements(new.snapshot)s where s->>'slot'=l.slot)) then raise exception 'Locked slot immutable';end if;
 end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end$$;
create function sports_feed.seven_competition_guard() returns trigger language plpgsql set search_path='' as $$begin
 if old.rules->>'lineup_version' is not null and (new.rules is distinct from old.rules or new.scoring_id<>old.scoring_id or new.locks_at<>old.locks_at or new.opens_at<>old.opens_at or new.round<>old.round or new.season<>old.season) then raise exception 'Accepted seven-slot configuration frozen; create a future version';end if;return new;end$$;
create trigger seven_rules_frozen before update on beta_fantasy.competitions for each row execute function sports_feed.seven_competition_guard();
revoke all on function sports_feed.seven_competition_guard() from public,anon,authenticated,service_role,docked_beta_app;
-- The swap selector uses the same reservation rule as its transaction.
do $$declare b text;begin
 b:=pg_get_functiondef('beta_fantasy.swap_read_state()'::regprocedure);
 b:=replace(b,'exists(select 1 from beta_fantasy.entries en join beta_fantasy.competitions co on co.id=en.competition_id where c.id=any(en.cards) and co.scored_at is null)','sports_feed.card_entry_reserved(c.id)');execute b;
end$$;

