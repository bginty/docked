-- Additive roster-aware beta swaps; dormant until friends readiness AND swap policy are enabled.
create or replace function beta_fantasy.swap_actor() returns uuid language plpgsql set search_path='' as $$declare u uuid;begin
 u:=beta_fantasy.production_eligible();
 if not exists(select 1 from beta_fantasy.swap_policy where enabled) or not (exists(select 1 from beta_private.friends_control where enabled) or exists(select 1 from beta_private.two_person_control where tester_enabled and u in(owner_id,tester_id))) then raise exception 'Two-person sandbox unavailable';end if;
 return u;end$$;
create or replace function beta_fantasy.swap_window() returns jsonb language plpgsql set search_path='' as $$declare p beta_fantasy.swap_policy; n timestamptz:=clock_timestamp(); start_at timestamptz; boundary timestamptz; free boolean;begin
 if exists(select 1 from beta_private.friends_control where enabled) then return jsonb_build_object('free',true,'fee_cents',0,'revision',(select revision from beta_fantasy.swap_policy),'expires_at',n+interval '5 minutes','next_boundary',null,'server_time',n,'override_mode','friends-free');end if;
 select * into strict p from beta_fantasy.swap_policy where id;
 start_at:=p.epoch+floor(extract(epoch from(n-p.epoch))/2419200)*interval '28 days';
 free:=n<start_at+interval '48 hours';boundary:=case when free then start_at+interval '48 hours' else start_at+interval '28 days' end;
 if p.override_mode<>'scheduled' and p.override_until>n then free:=p.override_mode='free';boundary:=p.override_until;end if;
 return jsonb_build_object('free',free,'fee_cents',case when free then 0 else 250 end,'revision',p.revision,'expires_at',least(n+interval '5 minutes',boundary),'next_boundary',boundary,'server_time',n,'override_mode',case when p.override_until>n then p.override_mode else 'scheduled' end);
end$$;
create or replace function beta_fantasy.swap_command(a text,p jsonb,req uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid;peer uuid;s beta_fantasy.swaps; prior beta_fantasy.swap_requests;w jsonb;result jsonb;id uuid;g uuid;t uuid;gr bigint;tr bigint;fee integer;begin
 perform pg_advisory_xact_lock(71820341);u:=beta_fantasy.swap_actor();
 if req is null then raise exception 'Request identity required';end if;
 select * into prior from beta_fantasy.swap_requests where user_id=u and request_id=req;
 if found then if prior.action<>a or prior.payload<>p then raise exception 'Request identity reused with different fields';end if;return prior.result;end if;
 select case when owner_id=u then tester_id else owner_id end into peer from beta_private.two_person_control where two_person_control.id;
 if not exists(select 1 from beta_private.friends_control where enabled) and not beta_private.admitted(peer) then raise exception 'Other participant has not completed admission';end if;
 if exists(select 1 from beta_private.friends_control where enabled) and a in('fee_mode','practice_credit') then raise exception 'Friends card swaps have no fees or cash balances';end if;
 if a='fee_mode' then
 if coalesce(auth.jwt()->>'aal','')<>'aal2' or not exists(select 1 from beta_private.two_person_control where owner_id=u) then raise exception 'Owner MFA required';end if;
 if p->>'mode' not in('scheduled','free','paid') or p->>'mode' is null then raise exception 'Invalid fee mode';end if;
 update beta_fantasy.swap_policy set override_mode=p->>'mode',override_until=case when p->>'mode'='scheduled' then null else clock_timestamp()+interval '1 hour' end,revision=revision+1 where true;
 insert into beta_fantasy.swap_policy_events(actor,mode,revision,expires_at) select u,override_mode,revision,override_until from beta_fantasy.swap_policy;
 result:=jsonb_build_object('ok',true,'mode',p->>'mode');
 elsif a='offer' then
 g:=(p->>'give_card')::uuid;t:=(p->>'take_card')::uuid;
 if exists(select 1 from beta_private.friends_control where enabled) then select c.owner_id into peer from beta_fantasy.cards c where c.id=t;if peer is null or peer=u then raise exception 'Choose another admitted participant card';end if;end if;
 gr:=beta_fantasy.swap_card(g,u);tr:=beta_fantasy.swap_card(t,peer);w:=beta_fantasy.swap_window();fee:=(w->>'fee_cents')::int;
 if p->>'fee_cents' is distinct from fee::text or p->>'policy_revision' is distinct from w->>'revision' then raise exception 'Fee changed; review again';end if;
 insert into beta_fantasy.swaps(sender,recipient,give_card,take_card,give_revision,take_revision,fee_cents,policy_revision,expires_at)
 values(u,peer,g,t,gr,tr,fee,(w->>'revision')::bigint,(w->>'expires_at')::timestamptz) returning swaps.id into id;
 result:=jsonb_build_object('ok',true,'swap_id',id,'state','pending');
 elsif a in('accept','reject','cancel') then
 select * into s from beta_fantasy.swaps where swaps.id=(p->>'swap_id')::uuid for update;
 if not found or u not in(s.sender,s.recipient) then raise exception 'Swap unavailable';end if;
 if (a in('accept','reject') and u<>s.recipient) or (a='cancel' and u<>s.sender) then raise exception 'Swap permission denied';end if;
 if s.state<>'pending' then raise exception 'Swap already completed';end if;
 if a='accept' then
 w:=beta_fantasy.swap_window();
 if clock_timestamp()>=s.expires_at or s.policy_revision<>(w->>'revision')::bigint or s.fee_cents<>(w->>'fee_cents')::int then raise exception 'Offer expired; request a new offer';end if;
 if p->>'fee_cents' is distinct from s.fee_cents::text then raise exception 'Review the participant fee';end if;
 if beta_fantasy.swap_card(s.give_card,s.sender)<>s.give_revision or beta_fantasy.swap_card(s.take_card,s.recipient)<>s.take_revision then raise exception 'Stale card ownership; create a new offer';end if;
 if exists(select 1 from unnest(array[s.sender,s.recipient]) x where coalesce((select sum(amount_cents) from beta_fantasy.swap_ledger where user_id=x),0)<s.fee_cents) then raise exception 'Insufficient simulated balance';end if;
 update beta_fantasy.cards set owner_id=case when cards.id=s.give_card then s.recipient else s.sender end where cards.id in(s.give_card,s.take_card);
 insert into beta_fantasy.ownership_events(card_id,from_user,to_user,reason,reference,acquisition_price,prospect_rank)
 select c.id,case when c.id=s.give_card then s.sender else s.recipient end,c.owner_id,'two-person-sandbox-swap',s.id,null,pl.prospect_rank
 from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id join beta_fantasy.players pl on pl.id=e.player_id where c.id in(s.give_card,s.take_card);
 insert into beta_fantasy.swap_ledger(user_id,kind,amount_cents,reference) values(s.sender,'swap_fee',-s.fee_cents,s.id),(s.recipient,'swap_fee',-s.fee_cents,s.id);
 update beta_fantasy.listings set state='cancelled' where card_id in(s.give_card,s.take_card) and state='active';
 end if;
 update beta_fantasy.swaps set state=case a when 'accept' then 'accepted' when 'reject' then 'rejected' else 'cancelled' end,completed_at=clock_timestamp() where swaps.id=s.id returning * into s;
 result:=jsonb_build_object('ok',true,'swap_id',s.id,'state',s.state,'fee_cents',s.fee_cents);
 elsif a='reserve_pack' then
 select pack_id into id from beta_fantasy.swap_reserve_packs where user_id=u;
 if not found then
 id:=beta_fantasy.production_pack((select starter_definition from beta_fantasy.production_catalog),u);
 insert into beta_fantasy.swap_reserve_packs(user_id,pack_id) values(u,id);
 end if;
 result:=jsonb_build_object('ok',true,'pack_id',id,'beta_reserves_only',true);
 elsif a='practice_credit' then
 insert into beta_fantasy.swap_ledger(user_id,kind,amount_cents,reference) values(u,'practice_credit',10000,u) on conflict do nothing;
 result:=jsonb_build_object('ok',true,'practice_currency_only',true);
 else raise exception 'Unsupported sandbox action';end if;
 insert into beta_fantasy.swap_requests values(u,req,a,p,result);return result;
end$$;
create or replace function beta_fantasy.swap_read_state() returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid;peer uuid;cards jsonb;history jsonb;begin
 u:=beta_fantasy.swap_actor();select case when owner_id=u then tester_id else owner_id end into peer from beta_private.two_person_control where id;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'owner_id',c.owner_id,'name',pl.name,'position',pl.position,'serial',c.serial,'rarity',e.tier,
 'in_lineup',exists(select 1 from beta_fantasy.entries en join beta_fantasy.competitions co on co.id=en.competition_id where c.id=any(en.cards) and co.scored_at is null),
 'unopened',exists(select 1 from beta_fantasy.pack_items i join beta_fantasy.packs pa on pa.id=i.pack_id where i.card_id=c.id and pa.opened_at is null))), '[]') into cards
 from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id join beta_fantasy.players pl on pl.id=e.player_id
 where c.owner_id=u or ((c.owner_id=peer or exists(select 1 from beta_private.friends_control where enabled)) and beta_private.admitted(c.owner_id) and beta_private.beta_gameplay_identity(c.owner_id));
 select coalesce(jsonb_agg(to_jsonb(s) order by created_at desc),'[]') into history from beta_fantasy.swaps s where u in(s.sender,s.recipient);
 return jsonb_build_object('mode',case when exists(select 1 from beta_private.friends_control where enabled) then 'FRIENDS_CARD_SWAP' else 'TWO_PERSON_SIMULATED' end,'user_id',u,'peer_id',peer,'owner',exists(select 1 from beta_private.two_person_control where owner_id=u),
 'window',beta_fantasy.swap_window(),'balance_cents',coalesce((select sum(amount_cents) from beta_fantasy.swap_ledger where user_id=u),0),
 'reserves_granted',exists(select 1 from beta_fantasy.swap_reserve_packs where user_id=u),'credited',exists(select 1 from beta_fantasy.swap_ledger where user_id=u and kind='practice_credit'),'cards',cards,'swaps',history,
 'ledger',(select coalesce(jsonb_agg(to_jsonb(l) order by created_at desc),'[]') from beta_fantasy.swap_ledger l where user_id=u),
 'ownership_history',(select coalesce(jsonb_agg(to_jsonb(e) order by created_at desc),'[]') from beta_fantasy.ownership_events e where e.reason='two-person-sandbox-swap' and u in(e.from_user,e.to_user)));
end$$;
