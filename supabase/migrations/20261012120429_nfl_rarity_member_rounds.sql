-- Additive bridge only. No grants, holdings, old entries or scoring rules changed.
-- Private helper: never expose another member's inventory via a callable API.
create function sports_feed.rarity_inventory(u uuid) returns jsonb language sql stable security definer set search_path='' as $$
with state as (select document s from credits_sandbox.state where id), limited as (
 select jsonb_build_object('id',i.id,'edition_id',i.definition,'owner_id',u,'serial',i.serial,
 'tradeable',true,'created_at',to_timestamp((i.document->>'mintedAt')::numeric/1000),'acquired_at',to_timestamp((i.document->>'mintedAt')::numeric/1000),
 'name',p.identity->>'name','position',r.position,'tier',d.rarity,'season','lifetime','kind','regular',
 'max_supply',d.lifetime_cap,'player_id',p.id,'team',r.team,'edition_team',i.document->>'printedTeam','provider_id',p.provider_id,
 'colour','#1677FF','shirt',1,'sport','nfl','inventory_scope','invited-nfl-test-v2',
 'status',case when r.status='ACT' and r.checked_at>clock_timestamp()-interval '72 hours' then 'active' else 'unavailable' end,
 'listed',exists(select 1 from jsonb_each(s->'listings') l where l.value->>'card'=i.id::text and l.value->>'status'='OPEN'),
 'multiplier',(rc.document->'rarities'->d.rarity->>'multiplierTenths')::numeric/10,
 'multiplierTenths',(rc.document->'rarities'->d.rarity->>'multiplierTenths')::int,'rarityVersion',d.rarity_version) card
 from state join credits_sandbox.card_instances i on s->'commerce'->'cards'->i.id::text->>'owner'=u::text
 join credits_sandbox.card_definitions d on d.id=i.definition join credits_sandbox.permanent_players p on p.id=d.player_id
 join credits_sandbox.current_player_status r on r.id=p.id join credits_sandbox.rarity_configuration rc on rc.version=d.rarity_version
 where s->'economy'->>'id'='invited-nfl-test-v2' and (s->'economy'->>'enabled')::boolean
 and s->'economy'->'packs'->(i.document->>'source')->>'openedAt' is not null
 and exists(select 1 from credits_sandbox.access where user_id=u and enabled)
) select coalesce(jsonb_agg(card),'[]') from limited
$$;
revoke all on function sports_feed.rarity_inventory(uuid) from public,anon,authenticated,service_role,docked_beta_app;

alter function beta_fantasy.production_command(text,jsonb,uuid) rename to production_command_before_rarity;
-- PL/pgSQL parameter qualification follows the function name, not its OID.
do $$begin execute replace(pg_get_functiondef('beta_fantasy.production_command_before_rarity(text,jsonb,uuid)'::regprocedure),'production_command.request_id','production_command_before_rarity.request_id');end$$;
revoke all on function beta_fantasy.production_command_before_rarity(text,jsonb,uuid) from public,anon,authenticated,service_role,docked_beta_app;
create function beta_fantasy.production_command(action text,p jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; c beta_fantasy.competitions; prior beta_fantasy.requests; ids uuid[]; snap jsonb; inventory jsonb; answer jsonb; cfg jsonb; rules_hash text;begin
 if action<>'save_lineup' or not exists(select 1 from beta_fantasy.competitions where id=(p->>'competition_id')::uuid and rules->>'inventory_scope'='invited-nfl-test-v2') then
 return beta_fantasy.production_command_before_rarity(action,p,request_id);end if;
 perform pg_advisory_xact_lock(71820342);
 u:=beta_fantasy.production_eligible();
 if not beta_private.active_member_session() or not exists(select 1 from credits_sandbox.access where user_id=u and enabled) then raise exception 'Test competition admission required';end if;
 -- Identical ordering to financial transactions: lineup lock, then aggregate.
 perform 1 from credits_sandbox.state where id for update;
 select * into strict c from beta_fantasy.competitions where id=(p->>'competition_id')::uuid;
 select * into prior from beta_fantasy.requests q where q.user_id=u and q.request_id=production_command.request_id;
 if found then if prior.action<>action or prior.payload<>p then raise exception 'Request ID reused';end if;return prior.result;end if;
 if request_id is null or (select count(*) from jsonb_object_keys(p))<>2 or jsonb_typeof(p->'cards')<>'array' then raise exception 'Exact lineup payload required';end if;
 if c.locks_at<=clock_timestamp() or c.opens_at>clock_timestamp() or c.scored_at is not null then raise exception 'Lineup locked';end if;
 if not exists(select 1 from sports_feed.nfl_rounds where competition_id=c.id and purpose='member' and locked_at is null) then raise exception 'Member round required';end if;
 select body->'period'->'rules',body->'audits'->0->>'payloadHash' into cfg,rules_hash from sports_feed.journal where stream_id=(select stream_id from sports_feed.nfl_rounds where competition_id=c.id) order by revision desc limit 1;
 if cfg->>'version'<>'docked-nfl-rarity-test-v1' or cfg->>'rarityVersion' is distinct from c.rules->>'rarity_version' then raise exception 'Registered rarity rules required';end if;
 select array_agg(value::uuid) into ids from jsonb_array_elements_text(p->'cards');
 if cardinality(ids)<>7 or (select count(distinct x) from unnest(ids)x)<>7 then raise exception 'Seven distinct owned cards required';end if;
 inventory:=sports_feed.rarity_inventory(u);
 -- Free Core is optional position coverage, never a paid allocation or reroll.
 select inventory||coalesce(jsonb_agg(jsonb_build_object('id',a.id,'card_id',a.id,'edition_id',e.id,'owner_id',u,'player_id',pl.id,'tier','CORE','position',pl.position,'season',e.season,'kind',e.kind,'provider_id',np.provider_id,'name',pl.name,'team',np.current_team,'sport','nfl','status','active','listed',false,'serial',a.serial,'max_supply',0,'tradeable',a.tradeable,'colour',pl.colour,'shirt',pl.shirt,'created_at',a.created_at,'acquired_at',a.created_at,'multiplier',1,'multiplierTenths',10,'rarityVersion',cfg->>'rarityVersion')),'[]') into inventory
 from beta_fantasy.cards a join beta_fantasy.editions e on e.id=a.edition_id join beta_fantasy.players pl on pl.id=e.player_id join sports_feed.nfl_players np on np.player_id=pl.id
 where a.owner_id=u and e.tier='CORE' and np.source_status='ACT' and np.observed_at>clock_timestamp()-interval '72 hours' and not exists(select 1 from beta_fantasy.listings where card_id=a.id and state='active');
 select jsonb_agg(v||jsonb_build_object('card_id',v->>'id','rules_version',cfg->>'version') order by v->>'id') into snap from jsonb_array_elements(inventory)v
 where (v->>'id')::uuid=any(ids) and v->>'status'='active' and not (v->>'listed')::boolean
 and exists(select 1 from sports_feed.nfl_rounds nr,jsonb_array_elements(nr.fixtures) f where nr.competition_id=c.id and f->'playerIds' ? (v->>'player_id'));
 if coalesce(jsonb_array_length(snap),0)<>7 or (select count(distinct v->>'player_id') from jsonb_array_elements(snap)v)<>7
 or (select count(*) from jsonb_array_elements(snap)v where v->>'position'='QB')<>1
 or (select count(*) from jsonb_array_elements(snap)v where v->>'position'='RB')<2
 or (select count(*) from jsonb_array_elements(snap)v where v->>'position'='WR')<2
 or (select count(*) from jsonb_array_elements(snap)v where v->>'position'='TE')<1
 or exists(select 1 from jsonb_array_elements(snap)v where v->>'position' not in('QB','RB','WR','TE')) then
 raise exception 'Choose owned, opened, unlisted cards: QB, 2 RB, 2 WR, TE and RB/WR/TE FLEX; one card per mapped player';end if;
 insert into beta_fantasy.entries(competition_id,user_id,cards,snapshot) values(c.id,u,ids,snap) on conflict(competition_id,user_id) do update set cards=excluded.cards,snapshot=excluded.snapshot,updated_at=clock_timestamp();
 insert into sports_feed.stream_members(stream_id,user_id) select stream_id,u from sports_feed.nfl_rounds where competition_id=c.id on conflict do nothing;
 answer:=jsonb_build_object('saved',true,'competition_id',c.id);
 insert into beta_fantasy.requests values(u,request_id,action,p,answer);
 insert into beta_private.audit_events(actor,action,subject,details) values(u::text,'rarity_team_saved',c.id::text,jsonb_build_object('cards',ids,'rules_version',cfg->>'version','request',request_id));
 return answer;
end$$;
revoke all on function beta_fantasy.production_command(text,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function beta_fantasy.production_command(text,jsonb,uuid) to docked_beta_app;

-- Defense in depth across every financial transfer path, including concurrent offers.
create function sports_feed.rarity_transfer_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(71820342);
 if exists(select 1 from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id,
 unnest(e.cards) card where c.scored_at is null and c.rules->>'inventory_scope'='invited-nfl-test-v2'
 and old.document->'commerce'->'cards'->card::text->>'owner' is distinct from new.document->'commerce'->'cards'->card::text->>'owner') then
 raise exception 'Card committed to an unsettled team. Remove it before the deadline, or wait for finalisation';end if;
 return new;
end$$;
create trigger rarity_lineup_transfer before update on credits_sandbox.state for each row execute function sports_feed.rarity_transfer_guard();
revoke all on function sports_feed.rarity_transfer_guard() from public,anon,authenticated,service_role,docked_beta_app;

alter function beta_fantasy.production_read_state() rename to production_read_state_before_rarity;
revoke all on function beta_fantasy.production_read_state_before_rarity() from public,anon,authenticated,service_role,docked_beta_app;
create function beta_fantasy.production_read_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb; u uuid; details jsonb;begin
 s:=beta_fantasy.production_read_state_before_rarity();u:=(s->>'user_id')::uuid;
 if not coalesce((s->>'nfl_beta')::boolean,false) then return s;end if;
 select coalesce(jsonb_agg(jsonb_build_object('competition_id',n.competition_id,'cards',e.snapshot,'scores',coalesce((select jsonb_agg(jsonb_build_object('player_id',p->>'playerId','score',(p->>'centipoints')::numeric/100,'base_score',(p->>'baseCentipoints')::numeric/100,'multiplier',p->'multiplier','stats','{}'::jsonb,'scoring_version',j.calculated->>'rulesVersion','rules','{}'::jsonb,'matches',p->'matches')) from jsonb_array_elements(r->'players')p),'[]'))),'[]') into details
 from sports_feed.nfl_rounds n join beta_fantasy.entries e on e.competition_id=n.competition_id and e.user_id=u
 join beta_fantasy.competitions c on c.id=n.competition_id
 join lateral(select calculated from sports_feed.journal where stream_id=n.stream_id order by revision desc limit 1)j on true
 left join lateral(select value r from jsonb_array_elements(j.calculated->'rows') where value->>'member'=u::text) row on true
 where c.rules->>'inventory_scope'='invited-nfl-test-v2';
 return s||jsonb_build_object('cards',(s->'cards')||sports_feed.rarity_inventory(u),
 'competitions',coalesce((select jsonb_agg(c||jsonb_build_object('eligible_player_ids',coalesce((select jsonb_agg(distinct p) from sports_feed.nfl_rounds nr,jsonb_array_elements(nr.fixtures) f,jsonb_array_elements(f->'playerIds')p where nr.competition_id=(c->>'id')::uuid),'[]'))) from jsonb_array_elements(s->'competitions')c where c->'rules'->>'inventory_scope' is distinct from 'invited-nfl-test-v2' or exists(select 1 from credits_sandbox.access where user_id=u and enabled)),'[]'),
 'round_details',coalesce((select jsonb_agg(v) from jsonb_array_elements(s->'round_details')v where not exists(select 1 from beta_fantasy.competitions c where c.id=(v->>'competition_id')::uuid and c.rules->>'inventory_scope'='invited-nfl-test-v2')),'[]')||details);
end$$;
revoke all on function beta_fantasy.production_read_state() from public,anon,authenticated,service_role;
grant execute on function beta_fantasy.production_read_state() to docked_beta_app;
