-- Stable catalogue draws only. Existing admission, scheduler, request IDs,
-- ownership, serial locking, immutable receipts and rollback boundaries retained.
-- No source refresh or catalogue insertion and no paid feature activation.
-- The insert trigger also enforced the old live-roster gate. Use season rights
-- only for non-transferable NFL Core; old limited/transferable mint paths keep
-- their existing controls. This grants no new mint entry point or entitlement.
create or replace function nfl_roster.guard_mint() returns trigger language plpgsql security invoker set search_path='' as $$
declare pid text; pos text; sport text; tier text; season text;begin
 if tg_table_schema='credits_sandbox' then
  select p.id,p.identity->>'position',p.sport into pid,pos,sport from credits_sandbox.card_definitions d join credits_sandbox.permanent_players p on p.id=d.player_id where d.id=new.definition;
 else
  select p.id::text,p.position,p.sport,e.tier,e.season into pid,pos,sport,tier,season from beta_fantasy.editions e join beta_fantasy.players p on p.id=e.player_id where e.id=new.edition_id;
  if sport='nfl' and tier='CORE' and not new.tradeable then
   if not season_catalogue.can_issue(sport,season,pid::uuid,'free_weekly') then raise exception 'Approved season catalogue and source-use rights required';end if;
   return new;
  end if;
 end if;
 if sport='nfl' and not nfl_roster.can_issue(pid,pos) then raise exception 'Official NFL roster eligibility required; no cards issued';end if;
 return new;
end$$;
-- Core has no business supply cap. Limited editions keep the exact prior bound.
alter table beta_fantasy.editions drop constraint editions_check;
alter table beta_fantasy.editions add constraint editions_check check(issued>=0 and (tier='CORE' or issued<=max_supply));
create or replace function beta_fantasy.card_guard() returns trigger language plpgsql set search_path='' as $$ declare e beta_fantasy.editions; begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-'owner_id') is distinct from (to_jsonb(old)-'owner_id') then raise exception 'Card identity immutable'; end if;
 else
  select * into strict e from beta_fantasy.editions where id=new.edition_id for update;
  if e.status<>'launched' or e.launch_at>clock_timestamp() or new.serial<>e.issued+1 or (e.tier<>'CORE' and new.serial>e.max_supply) then raise exception 'Edition supply exhausted or invalid serial'; end if;
  update beta_fantasy.editions set issued=new.serial,locked_at=coalesce(locked_at,clock_timestamp()) where id=e.id;
 end if; return new; end $$;
create or replace function sports_feed.open_weekly_core(pack_id uuid,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;p sports_feed.weekly_core_packs;prior beta_fantasy.requests;item record;cid uuid;cards jsonb:='[]';answer jsonb;now_at timestamptz;payload jsonb;begin
 perform pg_advisory_xact_lock(71820342);
 u:=beta_fantasy.production_eligible();
 if u is null or not beta_private.active_member_session() or not sports_feed.weekly_core_allowed(u) then raise exception 'Weekly pack access unavailable';end if;
 if request_id is null or pack_id is null then raise exception 'Pack and request required';end if;
 payload:=jsonb_build_object('pack_id',pack_id);
 select * into prior from beta_fantasy.requests q where q.user_id=u and q.request_id=open_weekly_core.request_id;
 if found then if prior.action<>'open_weekly_core' or prior.payload<>payload then raise exception 'Request ID reused';end if;return prior.result;end if;
 select * into p from sports_feed.weekly_core_packs q where q.id=pack_id and q.user_id=u and q.sport='nfl' for update;
 if not found then raise exception 'Pack unavailable';end if;
 if p.receipt is not null then
  insert into beta_fantasy.requests values(u,request_id,'open_weekly_core',payload,p.receipt);
  return p.receipt;
 end if;
 insert into beta_fantasy.members(user_id,expires_at) values(u,'infinity') on conflict do nothing;
 now_at:=clock_timestamp();
 -- Fixed season identity snapshot; no provider call, status or freshness test.
 for item in select m.edition_id, m.player_id id, m.snapshot->>'name' name,
 m.snapshot->>'position' position,m.snapshot->>'currentTeam' current_team,m.snapshot->>'currentTeam' edition_team,
 m.snapshot->>'colour' colour,(m.snapshot->>'shirt')::int shirt,m.snapshot->>'status' status
 from season_catalogue.members m join beta_fantasy.editions e on e.id=m.edition_id
 where m.sport='nfl' and m.season='2026' and m.scope='free_weekly'
 and m.snapshot->>'position' in('QB','RB','WR','TE')
 and season_catalogue.can_issue(m.sport,m.season,m.player_id,m.scope)
 and e.player_id=m.player_id and e.season=m.season and e.tier='CORE' and e.status='launched' and e.launch_at<=now_at
 order by gen_random_uuid() limit 4 loop
  cid:=beta_fantasy.mint(item.edition_id,u,false,'weekly-core-free-reward',p.id);
  cards:=cards||(select jsonb_build_array(jsonb_build_object('id',c.id,'edition_id',e.id,'serial',c.serial,'name',item.name,'position',item.position,
   'tier','CORE','season',e.season,'kind',e.kind,'max_supply',0,'player_id',item.id,'team',item.current_team,'edition_team',item.edition_team,
   'colour',item.colour,'shirt',item.shirt,'status',item.status,'sport','nfl','tradeable',false)) from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id where c.id=cid);
 end loop;
 if jsonb_array_length(cards)<>4 then raise exception 'Four eligible Core players are not available. Your pack is still unopened.';end if;
 answer:=jsonb_build_object('id',p.id,'name','Weekly Core Pack','opened_at',now_at,'cards',cards);
 update sports_feed.weekly_core_packs set opened_at=now_at,receipt=answer where id=p.id;
 insert into beta_fantasy.requests values(u,request_id,'open_weekly_core',payload,answer);
 return answer;
end$$;

create or replace function sports_feed.open_weekly_core(pack_id uuid,request_id uuid,s text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;p sports_feed.weekly_core_packs;prior beta_fantasy.requests;item jsonb;cards jsonb:='[]';answer jsonb;payload jsonb;cid uuid;now_at timestamptz:=clock_timestamp();begin
 if s='nfl' then return sports_feed.open_weekly_core(pack_id,request_id);end if;
 perform pg_advisory_xact_lock(71820342);
 u:=beta_fantasy.production_eligible();
 if u is null or not beta_private.active_member_session() or sports_feed.private_beta_sport() is distinct from s or sports_feed.private_beta_sport_identity() is distinct from u or not sports_feed.weekly_core_allowed(u,s) then raise exception 'Weekly sport access unavailable';end if;
 if pack_id is null or request_id is null then raise exception 'Pack and request required';end if;
 payload:=jsonb_build_object('pack_id',pack_id,'sport',s);
 select * into prior from beta_fantasy.requests q where q.user_id=u and q.request_id=open_weekly_core.request_id;
 if found then if prior.action<>'open_weekly_sport_core' or prior.payload<>payload then raise exception 'Request ID reused';end if;return prior.result;end if;
 select * into p from sports_feed.weekly_core_packs q where q.id=pack_id and q.user_id=u and q.sport=s for update;
 if not found then raise exception 'Pack unavailable';end if;
 if p.receipt is not null then answer:=p.receipt;else
  for item in select m.snapshot from season_catalogue.members m where m.sport=s and m.season='2026' and m.scope='free_weekly'
   and season_catalogue.can_issue(m.sport,m.season,m.player_id,m.scope) order by gen_random_uuid() limit 4 loop
   cid:=gen_random_uuid();
   cards:=cards||jsonb_build_array(jsonb_build_object('id',cid,'card_id',cid,'owner_id',u,'player_id',item->>'fixturePlayerId','canonical_player_id',item->>'fixturePlayerId',
    'name',item->>'name','team',item->>'currentTeam','sport',s,'position',item->>'position','eligible_positions',coalesce(item->'eligiblePositions',jsonb_build_array(item->>'position')),
    'tier','CORE','serial',0,'max_supply',0,'multiplier',1,'multiplierTenths',10,'season','REAL PLAYER Â· BETA INVENTORY','status','active','listed',false,'tradeable',false,
    'kind','regular','colour','#1677FF','shirt',1,'verifiedJerseyNumber',item->'verifiedJerseyNumber','inventory_class','real-roster-beta-v1','inventory_source','weekly-core-beta-v1','roster_source',item->'rosterBeta'));
  end loop;
  if jsonb_array_length(cards)<>4 then raise exception 'Four verified Core players are not available. Your pack is still unopened.';end if;
  answer:=jsonb_build_object('id',p.id,'name','Weekly '||upper(s)||' Starter Pack','opened_at',now_at,'cards',cards);
  update sports_feed.weekly_core_packs set opened_at=now_at,receipt=answer where id=p.id;
 end if;
 insert into beta_fantasy.requests values(u,request_id,'open_weekly_sport_core',payload,answer);
 return answer;
end$$;
