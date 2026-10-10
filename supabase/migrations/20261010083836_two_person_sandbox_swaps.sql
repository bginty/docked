-- Finite beta cards only; no official table, real wallet or payment integration.
create table beta_fantasy.swap_policy(id boolean primary key default true check(id), enabled boolean not null default false,
 epoch timestamptz not null default '2026-10-10 00:00:00+00', revision bigint not null default 1,
 override_mode text not null default 'scheduled' check(override_mode in('scheduled','free','paid')), override_until timestamptz);
insert into beta_fantasy.swap_policy(id) values(true);
create table beta_fantasy.swaps(id uuid primary key default gen_random_uuid(),sender uuid not null references beta_fantasy.members,recipient uuid not null references beta_fantasy.members,
 give_card uuid not null references beta_fantasy.cards,take_card uuid not null references beta_fantasy.cards,give_revision bigint not null,take_revision bigint not null,
 fee_cents integer not null check(fee_cents in(0,250)),policy_revision bigint not null,expires_at timestamptz not null,
 state text not null default 'pending' check(state in('pending','accepted','rejected','cancelled')),created_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 check(sender<>recipient),check(give_card<>take_card));
create table beta_fantasy.swap_ledger(id uuid primary key default gen_random_uuid(),user_id uuid not null references beta_fantasy.members,kind text not null check(kind in('practice_credit','swap_fee')),
 amount_cents integer not null,reference uuid not null,created_at timestamptz not null default clock_timestamp(),unique(user_id,kind,reference),
 check((kind='practice_credit' and amount_cents=10000) or (kind='swap_fee' and amount_cents in(0,-250))));
create unique index one_practice_credit on beta_fantasy.swap_ledger(user_id) where kind='practice_credit';
create table beta_fantasy.swap_reserve_packs(user_id uuid primary key references beta_fantasy.members,pack_id uuid unique not null references beta_fantasy.packs,created_at timestamptz not null default clock_timestamp());
create table beta_fantasy.swap_requests(user_id uuid not null references beta_fantasy.members,request_id uuid not null,action text not null,payload jsonb not null,result jsonb not null,primary key(user_id,request_id));
create table beta_fantasy.swap_policy_events(id uuid primary key default gen_random_uuid(),actor uuid not null,mode text not null,revision bigint not null,expires_at timestamptz,created_at timestamptz not null default clock_timestamp());
do $$declare t text;begin foreach t in array array['swap_policy','swaps','swap_ledger','swap_requests','swap_policy_events','swap_reserve_packs'] loop
 execute format('alter table beta_fantasy.%I enable row level security',t);
 execute format('revoke all on beta_fantasy.%I from public,anon,authenticated,docked_app,docked_beta_app',t);
 end loop;end$$;
create function beta_fantasy.swap_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Sandbox history is immutable';end$$;
create trigger swap_reserve_packs_immutable before update or delete on beta_fantasy.swap_reserve_packs for each row execute function beta_fantasy.swap_immutable();
create trigger swap_ledger_immutable before update or delete on beta_fantasy.swap_ledger for each row execute function beta_fantasy.swap_immutable();
create trigger swap_requests_immutable before update or delete on beta_fantasy.swap_requests for each row execute function beta_fantasy.swap_immutable();
create trigger swap_policy_events_immutable before update or delete on beta_fantasy.swap_policy_events for each row execute function beta_fantasy.swap_immutable();
create function beta_fantasy.swap_guard() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or old.state<>'pending' or new.state='pending' or (to_jsonb(new)-array['state','completed_at']) is distinct from (to_jsonb(old)-array['state','completed_at']) then raise exception 'Swap history is immutable';end if;return new;end$$;
create trigger swap_guard before update or delete on beta_fantasy.swaps for each row execute function beta_fantasy.swap_guard();

create function beta_fantasy.swap_actor() returns uuid language plpgsql set search_path='' as $$declare u uuid;begin
 u:=beta_fantasy.production_eligible();
 if not exists(select 1 from beta_fantasy.swap_policy where enabled) or not exists(select 1 from beta_private.two_person_control where tester_enabled and u in(owner_id,tester_id)) then raise exception 'Two-person sandbox unavailable';end if;
 return u;end$$;
create function beta_fantasy.swap_card(cid uuid,u uuid) returns bigint language plpgsql set search_path='' as $$declare rev bigint;begin
 if not beta_private.admitted(u) or not beta_private.beta_gameplay_identity(u) then raise exception 'Swap participant unavailable';end if;
 if not exists(select 1 from beta_fantasy.members m join beta_public.profiles p on p.id=m.user_id where m.user_id=u and m.revoked_at is null and m.expires_at>clock_timestamp() and p.disabled_at is null) then raise exception 'Swap participant unavailable';end if;
 if not exists(select 1 from beta_fantasy.cards where id=cid and owner_id=u) then raise exception 'Card ownership changed';end if;
 if exists(select 1 from beta_fantasy.pack_items i join beta_fantasy.packs p on p.id=i.pack_id where i.card_id=cid and p.opened_at is null) then raise exception 'Open the pack before swapping';end if;
 if exists(select 1 from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id where cid=any(e.cards) and c.scored_at is null) then raise exception 'Remove card from unsettled lineup before swapping';end if;
 -- Existing free beta cards stay non-transferable outside this specifically authorised sandbox.
 select count(*) into rev from beta_fantasy.ownership_events where card_id=cid;return rev;end$$;
create function beta_fantasy.swap_window() returns jsonb language plpgsql set search_path='' as $$declare p beta_fantasy.swap_policy; n timestamptz:=clock_timestamp(); start_at timestamptz; boundary timestamptz; free boolean;begin
 select * into strict p from beta_fantasy.swap_policy where id;
 start_at:=p.epoch+floor(extract(epoch from(n-p.epoch))/2419200)*interval '28 days';
 free:=n<start_at+interval '48 hours';boundary:=case when free then start_at+interval '48 hours' else start_at+interval '28 days' end;
 if p.override_mode<>'scheduled' and p.override_until>n then free:=p.override_mode='free';boundary:=p.override_until;end if;
 return jsonb_build_object('free',free,'fee_cents',case when free then 0 else 250 end,'revision',p.revision,'expires_at',least(n+interval '5 minutes',boundary),'next_boundary',boundary,'server_time',n,'override_mode',case when p.override_until>n then p.override_mode else 'scheduled' end);
end$$;
create function beta_fantasy.swap_command(a text,p jsonb,req uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid;peer uuid;s beta_fantasy.swaps; prior beta_fantasy.swap_requests;w jsonb;result jsonb;id uuid;g uuid;t uuid;gr bigint;tr bigint;fee integer;begin
 perform pg_advisory_xact_lock(71820341);u:=beta_fantasy.swap_actor();
 if req is null then raise exception 'Request identity required';end if;
 select * into prior from beta_fantasy.swap_requests where user_id=u and request_id=req;
 if found then if prior.action<>a or prior.payload<>p then raise exception 'Request identity reused with different fields';end if;return prior.result;end if;
 select case when owner_id=u then tester_id else owner_id end into peer from beta_private.two_person_control where two_person_control.id;
 if not beta_private.admitted(peer) then raise exception 'Other participant has not completed admission';end if;
 if a='fee_mode' then
 if coalesce(auth.jwt()->>'aal','')<>'aal2' or not exists(select 1 from beta_private.two_person_control where owner_id=u) then raise exception 'Owner MFA required';end if;
 if p->>'mode' not in('scheduled','free','paid') or p->>'mode' is null then raise exception 'Invalid fee mode';end if;
 update beta_fantasy.swap_policy set override_mode=p->>'mode',override_until=case when p->>'mode'='scheduled' then null else clock_timestamp()+interval '1 hour' end,revision=revision+1 where true;
 insert into beta_fantasy.swap_policy_events(actor,mode,revision,expires_at) select u,override_mode,revision,override_until from beta_fantasy.swap_policy;
 result:=jsonb_build_object('ok',true,'mode',p->>'mode');
 elsif a='offer' then
 g:=(p->>'give_card')::uuid;t:=(p->>'take_card')::uuid;
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
create function beta_fantasy.swap_read_state() returns jsonb language plpgsql security definer set search_path='' as $$declare u uuid;peer uuid;cards jsonb;history jsonb;begin
 u:=beta_fantasy.swap_actor();select case when owner_id=u then tester_id else owner_id end into peer from beta_private.two_person_control where id;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'owner_id',c.owner_id,'name',pl.name,'position',pl.position,'serial',c.serial,'rarity',e.tier,
 'in_lineup',exists(select 1 from beta_fantasy.entries en join beta_fantasy.competitions co on co.id=en.competition_id where c.id=any(en.cards) and co.scored_at is null),
 'unopened',exists(select 1 from beta_fantasy.pack_items i join beta_fantasy.packs pa on pa.id=i.pack_id where i.card_id=c.id and pa.opened_at is null))), '[]') into cards
 from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id join beta_fantasy.players pl on pl.id=e.player_id
 where c.owner_id=u or (c.owner_id=peer and beta_private.admitted(peer));
 select coalesce(jsonb_agg(to_jsonb(s) order by created_at desc),'[]') into history from beta_fantasy.swaps s where u in(s.sender,s.recipient);
 return jsonb_build_object('mode','TWO_PERSON_SIMULATED','user_id',u,'peer_id',peer,'owner',exists(select 1 from beta_private.two_person_control where owner_id=u),
 'window',beta_fantasy.swap_window(),'balance_cents',coalesce((select sum(amount_cents) from beta_fantasy.swap_ledger where user_id=u),0),
 'reserves_granted',exists(select 1 from beta_fantasy.swap_reserve_packs where user_id=u),'credited',exists(select 1 from beta_fantasy.swap_ledger where user_id=u and kind='practice_credit'),'cards',cards,'swaps',history,
 'ledger',(select coalesce(jsonb_agg(to_jsonb(l) order by created_at desc),'[]') from beta_fantasy.swap_ledger l where user_id=u),
 'ownership_history',(select coalesce(jsonb_agg(to_jsonb(e) order by created_at desc),'[]') from beta_fantasy.ownership_events e where e.reason='two-person-sandbox-swap' and u in(e.from_user,e.to_user)));
end$$;
revoke all on function beta_fantasy.swap_immutable(),beta_fantasy.swap_guard(),beta_fantasy.swap_actor(),beta_fantasy.swap_card(uuid,uuid),beta_fantasy.swap_window(),beta_fantasy.swap_command(text,jsonb,uuid),beta_fantasy.swap_read_state() from public,anon,authenticated,docked_app,docked_beta_app;
grant execute on function beta_fantasy.swap_command(text,jsonb,uuid),beta_fantasy.swap_read_state() to docked_beta_app;
