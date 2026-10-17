-- Additional acquisition gate only. Original counts, random draw, fees,
-- eligibility, admission, idempotency, supply and historical receipts remain intact.
create or replace function sports_feed.nfl_allocate(u uuid) returns jsonb language plpgsql set search_path='' as $$
declare existing sports_feed.nfl_allocations; item record; chosen uuid[]:='{}'; granted uuid[]:='{}'; preserved uuid[]; raw bigint; ref uuid:=gen_random_uuid(); pos text; needed integer;begin
 perform pg_advisory_xact_lock(71820342);
 select * into existing from sports_feed.nfl_allocations where user_id=u;
 if found then return jsonb_build_object('card_ids',existing.card_ids,'already_claimed',true);end if;
 insert into beta_fantasy.members(user_id,expires_at) values(u,'infinity') on conflict do nothing;
 select coalesce(array_agg(id),'{}') into preserved from beta_fantasy.cards where owner_id=u;
 -- Equal free starter entitlement. No paid-tier advantage or production supply.
 foreach pos in array array['QB','RB','WR','TE'] loop
 needed:=case when pos in('RB','WR') then 3 else 2 end;
 for item in select np.*,p.position from sports_feed.nfl_players np join beta_fantasy.players p on p.id=np.player_id
 join beta_fantasy.editions e on e.id=np.edition_id
 where p.position=pos and nfl_roster.can_issue(p.id::text,p.position) and np.source_status='ACT' and np.observed_at>clock_timestamp()-interval '72 hours'
 and exists(select 1 from sports_feed.nfl_rounds nr join beta_fantasy.competitions co on co.id=nr.competition_id,jsonb_array_elements(nr.fixtures) f where nr.purpose='member' and co.locks_at>clock_timestamp() and f->'playerIds' ? p.id::text)
 and e.issued<e.max_supply order by np.provider_id limit needed loop
 chosen:=array_append(chosen,item.edition_id);raw:=item.roster_raw_id;
 end loop;
 if cardinality(chosen)<>(case pos when 'QB' then 2 when 'RB' then 5 when 'WR' then 8 else 10 end) then raise exception 'Fresh complete NFL starter inventory unavailable';end if;
 end loop;
 foreach ref in array chosen loop
 granted:=array_append(granted,beta_fantasy.mint(ref,u,true,'free-beta-real-nfl-allocation',u));
 end loop;
 insert into sports_feed.nfl_allocations values(u,granted,preserved,raw,'Separate current-player free-beta entitlement; original fictional cards and history preserved',clock_timestamp());
 return jsonb_build_object('card_ids',granted,'already_claimed',false);
end$$;
create or replace function sports_feed.open_weekly_core(pack_id uuid,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;p sports_feed.weekly_core_packs;prior beta_fantasy.requests;item record;cid uuid;cards jsonb:='[]';answer jsonb;now_at timestamptz;payload jsonb;begin
 perform pg_advisory_xact_lock(71820342);
 u:=beta_fantasy.production_eligible();
 if u is null or not beta_private.active_member_session() or not sports_feed.weekly_core_allowed(u) then raise exception 'Weekly pack access unavailable';end if;
 if request_id is null or pack_id is null then raise exception 'Pack and request required';end if;
 payload:=jsonb_build_object('pack_id',pack_id);
 select * into prior from beta_fantasy.requests q where q.user_id=u and q.request_id=open_weekly_core.request_id;
 if found then if prior.action<>'open_weekly_core' or prior.payload<>payload then raise exception 'Request ID reused';end if;return prior.result;end if;
 select * into p from sports_feed.weekly_core_packs q where q.id=pack_id and q.user_id=u for update;
 if not found then raise exception 'Pack unavailable';end if;
 if p.receipt is not null then
  insert into beta_fantasy.requests values(u,request_id,'open_weekly_core',payload,p.receipt);
  return p.receipt;
 end if;
 insert into beta_fantasy.members(user_id,expires_at) values(u,'infinity') on conflict do nothing;
 now_at:=clock_timestamp();
 -- Each canonical roster identity appears once. Random UUID keys are generated on
 -- the server, using PostgreSQL's cryptographic UUID generator, never random().
 -- Existing Core edition limits/serial guards remain authoritative.
 for item in select np.edition_id,np.current_team,np.edition_team,pl.* from sports_feed.nfl_players np
 join beta_fantasy.players pl on pl.id=np.player_id join beta_fantasy.editions e on e.id=np.edition_id
 where pl.sport='nfl' and pl.position in('QB','RB','WR','TE') and pl.status not in('retired','delisted')
 and nfl_roster.can_issue(pl.id::text,pl.position) and np.source_status='ACT' and np.observed_at<=now_at and np.observed_at>now_at-interval '72 hours'
 and e.tier='CORE' and e.status='launched' and e.launch_at<=now_at and e.issued<e.max_supply
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
