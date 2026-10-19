-- Additive member release. No entitlements, purchases, announcements or prizes are issued on install.
alter table beta_private.announcement_drafts add column if not exists cta text,
 add column if not exists published jsonb, add column if not exists published_at timestamptz,
 add column if not exists pinned boolean not null default false;
alter table beta_private.announcement_drafts drop constraint if exists announcement_drafts_status_check;
alter table beta_private.announcement_drafts add constraint announcement_drafts_status_check check(status in('draft','in_review','approved','changes_requested','archived','published'));
create index if not exists announcement_published_order on beta_private.announcement_drafts(pinned desc,published_at desc,id) where published is not null and status<>'archived';
create or replace function beta_private.announcement_mutate(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<command>>
declare staff_role text; actor uuid:=auth.uid(); d beta_private.announcement_drafts%rowtype;
 old beta_private.announcement_events%rowtype; request_id uuid; draft_id uuid; action text; expected integer; result jsonb; next_status text;
begin
 staff_role:=beta_private.announcement_staff_role();
 if staff_role='auditor' then raise exception 'Role denied'; end if;
 if p is null or jsonb_typeof(p)<>'object' or (select count(*) from jsonb_object_keys(p)) not between 8 and 9 or (p - array['requestId','id','action','version','title','body','audience','reason','cta'])<>'{}'::jsonb
 or not p ?& array['requestId','id','action','version','title','body','audience','reason']
 or jsonb_typeof(p->'version')<>'number' or (p->>'version') !~ '^[0-9]+$'
 or jsonb_typeof(p->'title')<>'string' or jsonb_typeof(p->'body')<>'string'
 or jsonb_typeof(p->'reason')<>'string' or coalesce(p->>'audience','')<>'admitted'
 or length(btrim(p->>'title')) not between 1 and 120 or length(btrim(p->>'body')) not between 1 and 3000
 or length(btrim(p->>'reason')) not between 3 and 500 then raise exception 'Invalid announcement input'; end if;
 request_id:=(p->>'requestId')::uuid;draft_id:=(p->>'id')::uuid;action:=p->>'action';expected:=(p->>'version')::integer;
 if request_id is null or draft_id is null or action is null or action not in('create','save','submit','approve','request_changes','archive','restore','publish','pin','unpin') or expected>2147483646 then raise exception 'Invalid announcement input'; end if;
 if p ? 'cta' and p->'cta'<>'null'::jsonb and (jsonb_typeof(p->'cta')<>'string' or p->>'cta' not in('/fantasy/prizes','/fantasy/play','/fantasy/cards','/fantasy/market','/fantasy/results','/fantasy/test-wallet?view=packs')) then raise exception 'Internal destination required';end if;
 -- A repeated request returns its original result; reuse with different input fails.
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||request_id::text,0));
 select * into old from beta_private.announcement_events e where e.actor=command.actor and e.request_id=command.request_id;
 if found then
  if old.request<>p then raise exception 'Announcement request conflict';end if;
  return old.result;
 end if;
 if action='create' then
  perform pg_advisory_xact_lock(hashtextextended('announcement-create:'||actor::text,0));
  if expected<>0 or exists(select 1 from beta_private.announcement_drafts where id=draft_id) then raise exception 'Announcement version conflict'; end if;
  if (select count(*) from beta_private.announcement_drafts where created_by=actor and status<>'archived')>=100 then raise exception 'Archive an existing draft first';end if;
  insert into beta_private.announcement_drafts(id,title,body,audience,status,version,created_by,updated_by,last_edited_by)
  values(draft_id,btrim(p->>'title'),btrim(p->>'body'),'admitted','draft',1,actor,actor,actor) returning * into d;
 else
  select * into d from beta_private.announcement_drafts where id=draft_id for update;
  if not found or d.version<>expected then raise exception 'Announcement version conflict';end if;
  if staff_role='editor' and d.created_by<>actor then raise exception 'Role denied';end if;
  if action<>'save' and (d.title<>p->>'title' or d.body<>p->>'body' or (p ? 'cta' and d.cta is distinct from (p->>'cta'))) then raise exception 'Save content before changing review state';end if;
  next_status:=d.status;
  if action='save' then
   if d.status not in('draft','changes_requested','published') then raise exception 'Announcement state denied';end if;
   if d.published is not null and staff_role not in('owner','admin') then raise exception 'Publisher role required';end if;
   next_status:='draft';
  elsif action='submit' then
   if d.status not in('draft','changes_requested') then raise exception 'Announcement state denied';end if;
   next_status:='in_review';
  elsif action in('approve','request_changes') then
   if staff_role not in('owner','admin') or (staff_role<>'owner' and (actor=d.created_by or actor=d.last_edited_by)) then raise exception 'Owner or independent reviewer required';end if;
   if d.status<>'in_review' then raise exception 'Announcement state denied';end if;
   next_status:=case when action='approve' then 'approved' else 'changes_requested' end;
  elsif action='publish' then
   if staff_role not in('owner','admin') or d.status<>'approved' then raise exception 'Approved announcement and publisher role required';end if;
   next_status:='published';
  elsif action in('pin','unpin') then
   if staff_role not in('owner','admin') or d.published is null or d.status='archived' then raise exception 'Published announcement and publisher role required';end if;
  elsif action='archive' then
   if d.published is not null and staff_role not in('owner','admin') then raise exception 'Publisher role required';end if;
   if d.status='archived' then raise exception 'Announcement state denied';end if;
   next_status:='archived';
  elsif action='restore' then
   if d.status<>'archived' then raise exception 'Announcement state denied';end if;
   next_status:='draft';
  end if;
  update beta_private.announcement_drafts set title=btrim(p->>'title'),body=btrim(p->>'body'),status=next_status,version=version+1,updated_by=actor,last_edited_by=case when action='save' then actor else last_edited_by end,updated_at=clock_timestamp() where id=draft_id returning * into d;
 end if;
 update beta_private.announcement_drafts set
 cta=case when action in('save','create') and p ? 'cta' then p->>'cta' else cta end,
 published=case when action='publish' then jsonb_build_object('title',title,'body',body,'cta',cta) when action='restore' then null else published end,
 published_at=case when action='publish' then clock_timestamp() when action='restore' then null else published_at end,
 pinned=case when action='pin' then true when action in('unpin','archive','restore') then false else pinned end
 where id=draft_id returning * into d;
 result:=to_jsonb(d);
 insert into beta_private.announcement_events(draft_id,actor,request_id,action,reason,version,request,result)
 values(d.id,actor,request_id,action,btrim(p->>'reason'),d.version,p,result);
 return result;
end $$;

create or replace function beta_private.member_announcements(p_id uuid default null,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(beta_private.active_member_session(),false) or not coalesce(beta_private.admitted(auth.uid()),false) then raise exception 'Active admitted session required';end if;
 if p_page is null or p_page not between 1 and 1000 then raise exception 'Invalid page';end if;
 return coalesce((select jsonb_agg(v order by pinned desc,published_at desc,id) from (
 select id,published->>'title' title,published->>'body' body,published->>'cta' cta,published_at,pinned
 from beta_private.announcement_drafts where published is not null and status<>'archived' and published_at<=clock_timestamp() and (p_id is null or id=p_id)
 order by pinned desc,published_at desc,id limit 26 offset (p_page-1)*25)v),'[]');
end $$;
revoke all on function beta_private.member_announcements(uuid,integer) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function beta_private.member_announcements(uuid,integer) to docked_beta_app;
-- END ANNOUNCEMENTS

-- Published weekly templates only describe rewards. No award or wallet function is called.
create table if not exists beta_fantasy.weekly_prize_templates(
 sport text not null check(sport='nfl'),mode text not null check(mode in('SALARY_CAP','OPEN')),
 first_season integer not null check(first_season>=2026),first_week integer not null check(first_week between 1 and 30),
 product_version text not null references credits_sandbox.pack_configuration(version),
 active boolean not null default false, created_at timestamptz not null default clock_timestamp(),
 primary key(sport,mode)
);
alter table beta_fantasy.weekly_prize_templates enable row level security;
revoke all on beta_fantasy.weekly_prize_templates from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create or replace function beta_fantasy.apply_weekly_prize_template(c beta_fantasy.competitions) returns void language plpgsql security definer set search_path='' as $$
declare t beta_fantasy.weekly_prize_templates; product jsonb; items jsonb; created_id uuid;
begin
 if c.sport<>'nfl' or c.scored_at is not null or c.season !~ '^\d{4}$' then return;end if;
 select * into t from beta_fantasy.weekly_prize_templates where active and sport=c.sport and mode=c.rules->>'mode';
 if not found or (c.season::int,c.round)<(t.first_season,t.first_week) then return;end if;
 select document into strict product from credits_sandbox.pack_configuration where version=t.product_version;
 if product->>'sport'<>'nfl' or (product->>'cards')::int<>9 or product->>'type'<>(case when t.mode='OPEN' then 'PREMIUM' else 'STANDARD' end) then raise exception 'Invalid prize product reference';end if;
 select jsonb_agg(jsonb_build_object('from',n,'to',n,'description',q||' × '||(product->>'name')||' NFL','type','pack','amount',q,'productVersion',t.product_version) order by n) into items from (values(1,5),(2,3),(3,1))v(n,q);
 insert into beta_fantasy.prize_schedules(sport,mode,season,scope,week,competition_id,draft,published,effective_at)
 values(c.sport,t.mode,c.season,'weekly',c.round,c.id,items,items,clock_timestamp())
 on conflict(sport,mode,season,scope,week) do nothing returning id into created_id;
 if created_id is not null then
 insert into beta_private.audit_events(actor,action,subject,details) values('weekly-prize-template','prize_schedule_published',created_id::text,jsonb_build_object('template',to_jsonb(t),'items',items,'awardsIssued',false));
 end if;
end $$;
create or replace function beta_fantasy.new_round_prize_template() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform beta_fantasy.apply_weekly_prize_template(new);return new;
end $$;
drop trigger if exists weekly_prize_template on beta_fantasy.competitions;
create trigger weekly_prize_template after insert on beta_fantasy.competitions for each row execute function beta_fantasy.new_round_prize_template();
revoke all on function beta_fantasy.apply_weekly_prize_template(beta_fantasy.competitions),beta_fantasy.new_round_prize_template() from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create or replace function beta_fantasy.prize_product_reference_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb;begin
 for item in select value from jsonb_array_elements(new.draft || coalesce(new.published,'[]')) loop
  if item ? 'productVersion' and (item->>'type'<>'pack' or not exists(select 1 from credits_sandbox.pack_configuration where version=item->>'productVersion' and document->>'sport'=new.sport)) then raise exception 'Valid pack product reference required';end if;
 end loop;return new;
end $$;
drop trigger if exists prize_product_reference on beta_fantasy.prize_schedules;
create trigger prize_product_reference before insert or update on beta_fantasy.prize_schedules for each row execute function beta_fantasy.prize_product_reference_guard();
revoke all on function beta_fantasy.prize_product_reference_guard() from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create or replace function beta_fantasy.collection_export_legacy() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;result jsonb;begin
 u:=beta_fantasy.production_eligible();
 if u is null or not coalesce(beta_private.active_member_session(),false) then raise exception 'Active admitted session required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'player_id',p.id,'name',p.name,'sport',p.sport,'team',p.team,'position',p.position,'tier',e.tier,'serial',c.serial,'max_supply',e.max_supply,'season',e.season,'edition_id',e.id,
 'acquired_at',(select max(o.created_at) from beta_fantasy.ownership_events o where o.card_id=c.id and o.to_user=u),
 'listing_price',(select l.price from beta_fantasy.listings l where l.card_id=c.id and l.seller=u and l.state='active')) order by c.id),'[]') into result
 from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id join beta_fantasy.players p on p.id=e.player_id
 where c.owner_id=u and not exists(select 1 from beta_fantasy.pack_items pi join beta_fantasy.packs pa on pa.id=pi.pack_id where pi.card_id=c.id and pa.opened_at is null);
 return result;
end $$;
revoke all on function beta_fantasy.collection_export_legacy() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function beta_fantasy.collection_export_legacy() to docked_beta_app;

do $$begin
 if to_regprocedure('sports_feed.play_standings_before_status()') is null then
  alter function sports_feed.play_standings() rename to play_standings_before_status;
 end if;
end $$;
revoke all on function sports_feed.play_standings_before_status() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
create or replace function sports_feed.play_standings() returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;begin
 rows:=sports_feed.play_standings_before_status();
 return coalesce((select jsonb_agg(v||jsonb_build_object('closesAt',c.locks_at,'fixtures',coalesce(n.fixtures,'[]'),'serverTime',extract(epoch from clock_timestamp())*1000))
 from jsonb_array_elements(rows)v join beta_fantasy.competitions c on c.id=(v->>'competitionId')::uuid left join sports_feed.nfl_rounds n on n.competition_id=c.id),'[]');
end $$;
revoke all on function sports_feed.play_standings() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function sports_feed.play_standings() to docked_beta_app;
-- Durable settlement outbox. Inserting this record is part of the wallet transaction;
-- notification delivery happens afterwards and can never roll back a completed sale.
create table if not exists credits_sandbox.sale_notification_outbox(
 listing_id text primary key,recipient uuid not null references auth.users,
 receipt jsonb not null,created_at timestamptz not null default clock_timestamp(),
 delivered_at timestamptz,attempts integer not null default 0,last_error text
);
create index if not exists sale_notification_pending on credits_sandbox.sale_notification_outbox(created_at) where delivered_at is null;
alter table credits_sandbox.sale_notification_outbox enable row level security;
revoke all on credits_sandbox.sale_notification_outbox from public,anon,authenticated,service_role,docked_app,docked_beta_app;
create or replace function credits_sandbox.queue_sale_receipts() returns trigger language plpgsql security definer set search_path='' as $$
declare pair record;begin
 for pair in select key,value from jsonb_each(coalesce(new.document->'listings','{}')) where value->>'status'='SOLD' and value->'receipt' is not null loop
  if old.document->'listings'->pair.key->>'status' is distinct from 'SOLD' then
   insert into credits_sandbox.sale_notification_outbox(listing_id,recipient,receipt)
   values(pair.key,(pair.value->>'member')::uuid,pair.value->'receipt') on conflict do nothing;
  end if;
 end loop;return new;
end $$;
drop trigger if exists sale_receipt_outbox on credits_sandbox.state;
create trigger sale_receipt_outbox after update on credits_sandbox.state for each row execute function credits_sandbox.queue_sale_receipts();
revoke all on function credits_sandbox.queue_sale_receipts() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
alter table beta_private.social_notifications drop constraint if exists social_notifications_href_check;
alter table beta_private.social_notifications add constraint social_notifications_href_check check(href ~ '^/(home|community|profile|notifications|edges|top-docked|membership|competitions|deals)(/|\?|$)' or href ~ '^/fantasy/market\?tab=activity&sale=[A-Za-z0-9_-]+$');
create or replace function credits_sandbox.deliver_sale_receipts(p_user uuid default null) returns integer language plpgsql security definer set search_path='' as $$
declare r record;profile uuid;n integer:=0;title_text text;begin
 for r in select * from credits_sandbox.sale_notification_outbox where delivered_at is null and (p_user is null or recipient=p_user) order by created_at,listing_id limit 100 for update skip locked loop
  begin
   select id into profile from beta_private.social_profiles where user_id=r.recipient and status='active';
   if profile is null then continue;end if;
   title_text:=left(coalesce(r.receipt->'cardSnapshot'->>'name','Your card'),40)||' · '||replace(coalesce(r.receipt->'cardSnapshot'->>'tier',''),'_',' ')||coalesce(' #'||(r.receipt->'cardSnapshot'->>'serial'),'')||' sold for '||(r.receipt->>'price')||' credits. Fee: '||(r.receipt->>'fee')||'. You received '||(r.receipt->>'net')||' credits.';
   insert into beta_private.social_notifications(recipient_id,type,title,href,group_key,dedupe_key)
   values(profile,'account',title_text,'/fantasy/market?tab=activity&sale='||r.listing_id,'market-sales','sale:'||r.listing_id) on conflict(dedupe_key) do nothing;
   update credits_sandbox.sale_notification_outbox set delivered_at=clock_timestamp(),attempts=attempts+1,last_error=null where listing_id=r.listing_id;
   n:=n+1;
  exception when others then
   update credits_sandbox.sale_notification_outbox set attempts=attempts+1,last_error=sqlstate where listing_id=r.listing_id;
  end;
 end loop;return n;
end $$;
revoke all on function credits_sandbox.deliver_sale_receipts(uuid) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function credits_sandbox.deliver_sale_receipts(uuid) to docked_nfl_worker;
create or replace function beta_private.deliver_my_sales() returns void language plpgsql security definer set search_path='' as $$begin
 if not coalesce(beta_private.active_member_session(),false) or not coalesce(beta_private.admitted(auth.uid()),false) then raise exception 'Active admitted session required';end if;
 perform credits_sandbox.deliver_sale_receipts(auth.uid());
end $$;
revoke all on function beta_private.deliver_my_sales() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function beta_private.deliver_my_sales() to docked_beta_app;

-- Keep all existing lifetime/ownership guards; count follows immutable registered product.
create or replace function credits_sandbox.guard_economy_state() returns trigger language plpgsql security invoker set search_path='' as $$
declare e jsonb:=new.document->'economy'; previous jsonb:=old.document->'economy'; item record; d jsonb; config jsonb; registered jsonb; cnt int;begin
 if previous is not null and e is null then raise exception 'Economy history cannot be removed';end if;
 if e is null then return new;end if;
 if e->>'id' is distinct from 'invited-nfl-test-v2' or new.document->'policy'->>'liveEnabled' is distinct from 'false'
 or new.document->'policy'->>'purchasedWithdrawable' is distinct from 'false' then raise exception 'Isolated nonwithdrawable economy required';end if;
 if previous is null and current_user='docked_beta_app' then raise exception 'Operator migration required';end if;
 if current_user='docked_beta_app' and previous->'enabled' is distinct from e->'enabled' then raise exception 'Operator activation required';end if;
 if e->>'enabled'='true' and exists(select 1 from jsonb_object_keys(new.document->'commerce'->'orders') k where not coalesce(old.document->'commerce'->'orders','{}') ? k) then raise exception 'Legacy single-card purchases retired';end if;
 select document into config from credits_sandbox.rarity_configuration where version=e->>'rarityVersion';
 if config is null then raise exception 'Unknown rarity version';end if;
 for item in select key,value from jsonb_each(e->'players') loop
  select identity into registered from credits_sandbox.permanent_players where id=item.key;
  if registered is null or item.value->>'id'<>item.key or item.value->>'providerId'<>registered->>'providerId'
   or item.value->>'provider'<>registered->>'provider' or item.value->>'sport'<>registered->>'sport'
   or item.value->>'assetKind'<>registered->>'assetKind' then raise exception 'Permanent player identity mismatch';end if;
 end loop;
 for item in select key,value from jsonb_each(e->'products') loop
  select document into registered from credits_sandbox.pack_configuration where version=item.value->>'version';
  if registered is distinct from item.value or item.key<>item.value->>'id' or (item.value->>'cards')::int not in (1,3,9)
    or item.value->>'status'<>'TEST_ONLY' or (item.value->'weights'->>'ICON')::int<1
    or item.value->'weights' ? 'CORE' then raise exception 'Unregistered pack product';end if;
 end loop;
 for item in select key,value from jsonb_each(coalesce(e->'retiredTestInstances','{}')) loop
  if e->'instances' ? item.key or not exists(select 1 from nfl_roster.retired_test_cards a where a.card_id=item.key and a.allocation=item.value) then raise exception 'Unapproved retirement or resurrection';end if;
 end loop;
 for item in select key,value from jsonb_each(coalesce(previous->'retiredTestInstances','{}')) loop
  if e->'retiredTestInstances'->item.key is distinct from item.value then raise exception 'Retired scarcity cannot change';end if;
 end loop;
 for item in select key,value from jsonb_each(coalesce(previous->'instances','{}')) loop
  if e->'retiredTestInstances'->item.key=item.value and exists(select 1 from nfl_roster.retired_test_cards a where a.card_id=item.key and a.allocation=item.value and a.ownership=old.document->'commerce'->'cards'->item.key and a.history=old.document->'cards'->item.key) then
   if new.document->'commerce'->'cards' ? item.key or new.document->'cards' ? item.key then raise exception 'Retired ownership remains active';end if;
   continue;
  end if;
  if e->'instances'->item.key is distinct from item.value then raise exception 'Issued identity/serial is immutable';end if;
  if not(new.document->'commerce'->'cards' ? item.key) or not(new.document->'cards' ? item.key) then raise exception 'Ownership evidence required';end if;
  if exists(select 1 from jsonb_array_elements(old.document->'cards'->item.key->'history') with ordinality h(v,n) where new.document->'cards'->item.key->'history'->((h.n-1)::int) is distinct from h.v) then raise exception 'Ownership history append required';end if;
 end loop;
 for item in select key,value from jsonb_each(e->'definitions') loop
  if item.key<>((item.value->>'playerId')||':'||(item.value->>'rarity')) then raise exception 'Lifetime definition key';end if;
  select count(*) into cnt from jsonb_each(coalesce(e->'retiredTestInstances','{}') || (e->'instances')) x where x.value->>'definition'=item.key;
  if cnt<>(item.value->>'issued')::int then raise exception 'Issuance count mismatch';end if;
  insert into credits_sandbox.card_definitions values(item.key,item.value->>'playerId',item.value->>'rarity',e->>'rarityVersion',(config->'rarities'->(item.value->>'rarity')->>'lifetimeCap')::int) on conflict do nothing;
 end loop;
 for item in select key,value from jsonb_each(e->'instances') order by (value->>'serial')::int loop
  select document into registered from credits_sandbox.card_instances where id=item.key::uuid;
  if registered is null then
   insert into credits_sandbox.card_instances values(item.key::uuid,item.value->>'definition',(item.value->>'serial')::int,item.value);
  elsif registered is distinct from item.value then raise exception 'Serial already issued';end if;
  if new.document->'commerce'->'cards'->item.key->>'tier' is distinct from item.value->>'rarity'
    or new.document->'commerce'->'cards'->item.key->>'owner' is null
    or new.document->'cards'->item.key->'history'->-1->>'to' is distinct from new.document->'commerce'->'cards'->item.key->>'owner'
    or not coalesce(e->'packs'->(item.value->>'source')->'cards','[]') ? item.key then raise exception 'Owned rarity required';end if;
 end loop;
 if (select count(*) from credits_sandbox.card_instances)<>(select count(*) from jsonb_each(coalesce(e->'retiredTestInstances','{}') || (e->'instances'))) then raise exception 'Historical issuance missing';end if;
 for item in select key,value from jsonb_each(e->'packs') loop
  select document into registered from credits_sandbox.pack_configuration where version=item.value->'product'->>'version';
  if registered is null or registered is distinct from item.value->'product' then raise exception 'Unregistered pack receipt configuration';end if;
  if jsonb_array_length(item.value->'cards')<>(registered->>'cards')::int or
    (select count(distinct x) from jsonb_array_elements_text(item.value->'cards')x)<>(registered->>'cards')::int then raise exception 'Purchased card count and unique instances required';end if;
  for d in select value from jsonb_array_elements(item.value->'cards') loop
   if (coalesce(e->'retiredTestInstances','{}') || (e->'instances'))->(d#>>'{}')->>'source' is distinct from item.key then raise exception 'Pack allocation mismatch';end if;
  end loop;
  select document into registered from credits_sandbox.pack_receipts where id=item.key;
  if registered is null then insert into credits_sandbox.pack_receipts values(item.key,item.value-'openedAt');
  elsif registered is distinct from item.value-'openedAt' then raise exception 'Confirmed pack cannot be rerolled';end if;
  if previous->'packs'->item.key->>'openedAt' is not null and previous->'packs'->item.key->'openedAt' is distinct from item.value->'openedAt' then raise exception 'Opening receipt immutable';end if;
 end loop;
 if (select count(*) from credits_sandbox.pack_receipts)<>(select count(*) from jsonb_each(e->'packs')) then raise exception 'Pack history missing';end if;
 return new;
end$$;
