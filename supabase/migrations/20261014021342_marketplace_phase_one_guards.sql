-- Prepared LOCAL ONLY. Extends the existing aggregate and shared competition lock.
-- No data cleanup, asset grants or hosted execution.
create function credits_sandbox.marketplace_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare item record; prior jsonb; l jsonb; cid text;begin
 perform pg_advisory_xact_lock(71820342);
 if exists(select 1 from jsonb_each(new.document->'listings') x where x.value->>'status'='OPEN' group by x.value->>'card' having count(*)>1) then raise exception 'One active listing per card';end if;
 for item in select key,value from jsonb_each(old.document->'requests') loop
  if new.document->'requests'->item.key is distinct from item.value then raise exception 'Transaction identity and receipt immutable';end if;
 end loop;
 for item in select key,value from jsonb_each(new.document->'listings') loop
  l:=item.value;prior:=old.document->'listings'->item.key;
  if jsonb_typeof(l->'price') is distinct from 'number' or (l->>'price')::numeric not between 1 and 1000000000 or trunc((l->>'price')::numeric)<>(l->>'price')::numeric then raise exception 'Positive integer credit price required';end if;
  if l->>'status' is null or l->>'status' not in('OPEN','SOLD','CANCELLED') then raise exception 'Invalid listing status';end if;
  if prior is not null and ((prior-array['status','buyer','receipt','cancelledAt']) is distinct from (l-array['status','buyer','receipt','cancelledAt']) or (prior->>'status'<>'OPEN' and prior is distinct from l)) then raise exception 'Listing terms and closed history immutable';end if;
  if l->>'status'='OPEN' and (new.document#>>array['commerce','cards',l->>'card','owner'] is distinct from l->>'member' or new.document#>>array['cards',l->>'card','version'] is distinct from l->>'version') then raise exception 'Listing ownership/version required';end if;
  if prior is null then
   if l->>'status'<>'OPEN' or new.document#>>array['commerce','cards',l->>'card','tier']='CORE' then raise exception 'Eligible limited test card required';end if;
   if sports_feed.card_entry_reserved((l->>'card')::uuid) then raise exception 'Card used by an unlocked submitted team';end if;
   if exists(select 1 from jsonb_each(new.document->'swaps') x where x.value->>'status'='OPEN' and (x.value->>'expires')::numeric>extract(epoch from clock_timestamp())*1000 and ((x.value->'give')||(x.value->'take')) ? (l->>'card')) then raise exception 'Card reserved by active swap';end if;
  end if;
  if l->>'status'='SOLD' and prior->>'status'='OPEN' then
   if jsonb_typeof(l->'receipt') is distinct from 'object' or not (l->'receipt') ?& array['reference','at','price','fee','net'] or (l->'receipt'->>'price')::bigint<>(l->>'price')::bigint or (l->'receipt'->>'fee')::bigint<>round((l->>'price')::numeric*0.075) or (l->'receipt'->>'net')::bigint<>(l->>'price')::bigint-(l->'receipt'->>'fee')::bigint then raise exception 'Exact sale receipt required';end if;
   if new.document#>>array['commerce','cards',l->>'card','owner'] is distinct from l->>'buyer' or l->>'buyer'=l->>'member' then raise exception 'Sale ownership required';end if;
   if not exists(select 1 from credits_sandbox.journal j where j.id=l->'receipt'->>'reference') then raise exception 'Sale journal required';end if;
  end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(old.document->'listings') k where not (new.document->'listings') ? k) then raise exception 'Listing history cannot be removed';end if;
 for item in select key,value from jsonb_each(new.document->'swaps') where value->>'status'='OPEN' and (value->>'expires')::numeric>extract(epoch from clock_timestamp())*1000 loop
  if old.document->'swaps'->item.key is null then
   for cid in select jsonb_array_elements_text((item.value->'give')||(item.value->'take')) loop
    if sports_feed.card_entry_reserved(cid::uuid) then raise exception 'Card used by an unlocked submitted team';end if;
   end loop;
  end if;
 end loop;
 return new;
end$$;
create trigger marketplace_guard before update on credits_sandbox.state for each row execute function credits_sandbox.marketplace_guard();
revoke all on function credits_sandbox.marketplace_guard() from public,anon,authenticated,service_role,docked_beta_app;

-- Both draft/entry validation already reject listed inventory. Include effective
-- swap reservations in that existing eligibility path (expired offers excluded).
alter function sports_feed.seven_inventory(uuid) rename to seven_inventory_before_marketplace;
create function sports_feed.seven_inventory(u uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(c||jsonb_build_object('listed',coalesce((c->>'listed')::boolean,false) or exists(select 1 from credits_sandbox.state s,jsonb_each(s.document->'swaps') x where x.value->>'status'='OPEN' and (x.value->>'expires')::numeric>extract(epoch from clock_timestamp())*1000 and ((x.value->'give')||(x.value->'take')) ? (c->>'id')))),'[]') from jsonb_array_elements(sports_feed.seven_inventory_before_marketplace(u)) c
$$;
revoke all on function sports_feed.seven_inventory_before_marketplace(uuid),sports_feed.seven_inventory(uuid) from public,anon,authenticated,service_role,docked_beta_app;

-- Read context exposes only a reservation boolean/card ID for already public or
-- owned cards, no opponent selection, account identity or private lineup.
create function credits_sandbox.market_context(u uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not beta_private.admitted(u) or not exists(select 1 from credits_sandbox.access where user_id=u and enabled) then raise exception 'Admission required';end if;
 return jsonb_build_object('reserved',coalesce((select jsonb_agg(distinct s->>'card_id') from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id,jsonb_array_elements(e.snapshot)s where c.scored_at is null and (c.rules->>'lineup_version' is null or ((s->>'kickoff')::timestamptz>clock_timestamp() and not exists(select 1 from beta_fantasy.slot_locks l where l.competition_id=e.competition_id and l.user_id=e.user_id and l.slot=s->>'slot')))),'[]'),
 'ownerReservations',coalesce((select jsonb_agg(jsonb_build_object('card',s->>'card_id','competition',c.id,'name',c.name,'slot',coalesce(s->>'slot','Legacy selection'),'withdrawable',c.rules->>'lineup_version' is not null and c.locks_at>clock_timestamp())) from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id,jsonb_array_elements(e.snapshot)s where e.user_id=u and c.scored_at is null and (c.rules->>'lineup_version' is null or ((s->>'kickoff')::timestamptz>clock_timestamp() and not exists(select 1 from beta_fantasy.slot_locks l where l.competition_id=e.competition_id and l.user_id=e.user_id and l.slot=s->>'slot')))),'[]'),
 'freeSwaps',coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',case when state='pending' and expires_at<=clock_timestamp() then 'expired' else state end,'at',extract(epoch from coalesce(completed_at,expires_at))*1000,'give',give_card,'take',take_card)) from beta_fantasy.swaps where u in(sender,recipient) and (state<>'pending' or expires_at<=clock_timestamp())),'[]'),
 'rounds',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'configuration',(select configuration from beta_fantasy.lineup_configurations where version=c.rules->>'lineup_version'),'fixtures',n.fixtures)) from beta_fantasy.competitions c join sports_feed.nfl_rounds n on n.competition_id=c.id where c.rules->>'lineup_version' is not null and c.scored_at is null and not exists(select 1 from beta_fantasy.round_controls where competition_id=c.id and not enabled)),'[]'),
 'labels',coalesce((select jsonb_agg(jsonb_build_object('id',a.user_id,'label',coalesce(p.display_name,'Docked member'))) from credits_sandbox.access a left join beta_private.social_profiles p on p.user_id=a.user_id and p.status='active' and p.visibility='members' where a.enabled),'[]'));
end$$;
revoke all on function credits_sandbox.market_context(uuid) from public,anon,authenticated,service_role;
grant execute on function credits_sandbox.market_context(uuid) to docked_beta_app;

-- Free-card swaps retain their own fee and transfer rules, with truthful expiry.
alter table beta_fantasy.swaps drop constraint swaps_state_check;
alter table beta_fantasy.swaps add constraint swaps_state_check check(state in('pending','accepted','rejected','cancelled','expired'));
alter function beta_fantasy.swap_read_state() rename to swap_read_state_before_marketplace;
create function beta_fantasy.swap_read_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;u uuid;begin
 u:=beta_fantasy.swap_actor();
 perform pg_advisory_xact_lock(71820342);
 with expired as(update beta_fantasy.swaps set state='expired',completed_at=clock_timestamp() where state='pending' and expires_at<=clock_timestamp() and u in(sender,recipient) returning id,expires_at)
 insert into beta_private.audit_events(actor,action,subject,details) select u::text,'swap_expired',id::text,jsonb_build_object('previous','pending','result','expired','expires_at',expires_at,'reason','Server observed expiry; no transfer or fee') from expired;
 s:=beta_fantasy.swap_read_state_before_marketplace();return s;
end$$;
revoke all on function beta_fantasy.swap_read_state_before_marketplace(),beta_fantasy.swap_read_state() from public,anon,authenticated,service_role,docked_beta_app;
grant execute on function beta_fantasy.swap_read_state() to docked_beta_app;

-- Consistent ordering: free swaps acquire the shared competition lock BEFORE
-- selecting offer/card rows, preventing cleanup/entry/accept lock inversion.
do $$declare b text;sig text;begin
 foreach sig in array array['beta_fantasy.swap_command(text,jsonb,uuid)','beta_fantasy.swap_command_before_nfl(text,jsonb,uuid)'] loop
 b:=pg_get_functiondef(sig::regprocedure);
 b:=replace(b,'pg_advisory_xact_lock(71820341)','pg_advisory_xact_lock(71820342)');execute b;
 end loop;
end$$;
