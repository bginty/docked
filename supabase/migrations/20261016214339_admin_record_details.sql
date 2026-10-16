-- Internal, explicitly projected read model. No table grants, mutations, raw
-- JSON documents, credentials, email addresses, unrevealed draws or lineups.
-- SECURITY DEFINER is needed only to project approved columns from private
-- stores already inaccessible to the runtime role; the current session, AAL2
-- and persisted staff role are independently checked on every invocation.
create function beta_private.admin_record_detail(p_category text,p_id text,p_page integer default 1)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='4s' as $$
declare actor uuid:=auth.uid(); staff_role text; permitted text[]; title text; source text;
 fields jsonb; events jsonb:='[]'; doc jsonb; item jsonb; more boolean;
begin
 if actor is null or not coalesce(beta_private.active_member_session(),false) or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Staff MFA required';end if;
 select role into staff_role from beta_private.roles where user_id=actor;
 permitted:=case staff_role
 when 'owner' then array['members','cards','packs','transactions','competitions','moderation']
 when 'admin' then array['members','cards','packs','competitions','moderation']
 when 'auditor' then array['members','cards','packs','competitions','moderation']
 when 'editor' then array['competitions','moderation']
 when 'analyst' then array['competitions'] else array[]::text[] end;
 if cardinality(permitted)=0 then raise exception 'Role denied';end if;
 if p_category is null or not p_category=any(permitted) then raise exception 'Category denied';end if;
 if p_id is null or length(btrim(p_id))=0 or length(p_id)>160 or p_id ~ '[[:cntrl:]]' or p_page is null or p_page<1 or p_page>100 then raise exception 'Invalid record';end if;

 if p_category='members' then
  select coalesce(nullif(s.display_name,''),'Member'),'Member admission and social records',jsonb_build_object(
   'Record ID',p.id,'Handle',s.handle,'Created at',p.created_at,'Account status',case when p.disabled_at is null then 'Enabled' else 'Restricted' end,
   'Restricted at',p.disabled_at,'Social status',s.status,'Admission status',a.status,'Invitation created at',a.created_at,'Admission accepted at',a.accepted_at,
   'Assigned staff role',r.role)
  into title,source,fields from beta_public.profiles p
  left join beta_private.social_profiles s on s.user_id=p.id
  left join beta_private.admissions a on a.user_id=p.id
  left join beta_private.roles r on r.user_id=p.id where p.id::text=p_id;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.at desc,e.id),'[]') into events from (
   select * from (
    select 'admission:'||e.id id,e.created_at at,'Admission: '||e.action event,'Recorded admission transition' detail
    from beta_private.admission_events e join beta_private.admissions a on a.id=e.admission_id where a.user_id::text=p_id
    union all select 'moderation:'||e.id,e.created_at,'Moderation: '||e.decision,'Recorded profile enforcement'
    from beta_private.social_moderation_events e join beta_private.social_profiles s on s.id=e.target_id
    where e.target_type='profile' and s.user_id::text=p_id
   ) h order by at desc,id limit 21 offset (p_page-1)*20
  ) e;
 elsif p_category='competitions' then
  select case when c.rules->>'lineup_version' is not null and c.rules->>'mode' in ('SALARY_CAP','OPEN') then
    (case c.rules->>'mode' when 'SALARY_CAP' then 'Traditional' else 'All-Star' end)||' · '||c.season||' · Week '||c.round else c.name end,
   'Competition schedule and aggregate entry records',jsonb_build_object('Record ID',c.id,'Sport',c.sport,'Season',c.season,'Week',c.round,
    'Opens at',c.opens_at,'Locks at',c.locks_at,'Scored at',c.scored_at,'Scoring rule ID',c.scoring_id,
    'Entry count',(select count(*) from beta_fantasy.entries e where e.competition_id=c.id),
    'Result count',(select count(*) from beta_fantasy.results r where r.competition_id=c.id),
    'Schedule state',case when now()<c.opens_at then 'Upcoming' when now()<c.locks_at then 'Entry window' else 'Lock time passed; player locks remain authoritative' end)
  into title,source,fields from beta_fantasy.competitions c where c.id::text=p_id;
  -- No cards, snapshots, slot assignments or draft fields are projected, even
  -- for the owner. Scored_at is evidence of a scoring run, not finality.
 elsif p_category='moderation' then
  select initcap(r.target_type)||' report','Moderation classification',jsonb_build_object('Record ID',r.id,'Target type',r.target_type,'Status',r.status,'Category',r.reason,'Created at',r.created_at)
   into title,source,fields from beta_private.social_reports r where r.id::text=p_id;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.at desc,e.id),'[]') into events from (
   select e.id::text id,e.created_at at,e.decision event,'Recorded staff decision' detail from beta_private.social_moderation_events e
   where e.report_id::text=p_id order by e.created_at desc,e.id limit 21 offset (p_page-1)*20
  ) e;
 elsif p_category='cards' then
  select p.name,'Legacy issued collectible',jsonb_build_object('Record ID',c.id,'Player',p.name,'Sport',p.sport,'Position',p.position,'Rarity',e.tier,
   'Serial',c.serial,'Edition',e.id,'Maximum supply',e.max_supply,'Issued supply',e.issued,'Owner reference',c.owner_id,'Issued at',c.created_at,'Tradeable',c.tradeable)
   into title,source,fields from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id join beta_fantasy.players p on p.id=e.player_id where c.id::text=p_id;
  if title is not null then
   select coalesce(jsonb_agg(to_jsonb(e) order by e.at desc,e.id),'[]') into events from (
    select e.id::text id,e.created_at at,'Ownership: '||e.reason event,concat_ws(' · ','From '||coalesce(e.from_user::text,'issuance'),'To '||e.to_user::text,'Reference '||e.reference::text) detail
    from beta_fantasy.ownership_events e where e.card_id::text=p_id order by e.created_at desc,e.id limit 21 offset (p_page-1)*20
   ) e;
  else
   select s.document into doc from credits_sandbox.state s where s.document#>array['economy','instances',p_id] is not null or s.document#>array['economy','definitions',p_id] is not null;
   item:=doc#>array['economy','instances',p_id];
   if item is not null then
    title:=coalesce(doc#>>array['economy','players',item->>'playerId','name'],'Player record'); source:='Current issued collectible and immutable ownership history';
    fields:=jsonb_build_object('Record ID',p_id,'Player',title,'Rarity',item->>'rarity','Serial',item->'serial','Lifetime supply',item->'lifetimeCap',
     'Edition',item->>'definition','Issued at',to_timestamp((item->>'mintedAt')::numeric/1000),'Owner reference',doc#>>array['commerce','cards',p_id,'owner']);
    select coalesce(jsonb_agg(to_jsonb(e) order by e.at desc,e.id desc),'[]') into events from (
     select h.n::text id,to_timestamp((h.value->>'at')::numeric/1000) at,'Ownership transfer' event,
      concat_ws(' · ','From '||coalesce(h.value->>'from','issuance'),'To '||(h.value->>'to'),'Reference '||(h.value->>'reference')) detail
     from jsonb_array_elements(coalesce(doc#>array['cards',p_id,'history'],'[]')) with ordinality h(value,n)
     order by (h.value->>'at')::numeric desc,h.n desc limit 21 offset (p_page-1)*20
    ) e;
   else
    item:=doc#>array['economy','definitions',p_id];
    if item is not null then
     title:=coalesce(doc#>>array['economy','players',item->>'playerId','name'],'Player record');source:='Current collectible edition';
     fields:=jsonb_build_object('Record ID',p_id,'Player',title,'Rarity',item->>'rarity','Issued supply',item->'issued');
    end if;
   end if;
  end if;
 elsif p_category='packs' then
  select d.name,'Legacy pack issuance',jsonb_build_object('Record ID',p.id,'Member reference',p.user_id,'Configuration ID',p.definition_id,
   'Issued at',p.created_at,'Opened at',p.opened_at,'Status',case when p.opened_at is null then 'Unopened' else 'Opened' end,
   'Issued card count',(select count(*) from beta_fantasy.pack_items i where i.pack_id=p.id))
   into title,source,fields from beta_fantasy.packs p join beta_fantasy.pack_definitions d on d.id=p.definition_id where p.id::text=p_id;
  if title is null then
   select 'Weekly Core Pack','Weekly reward entitlement',jsonb_build_object('Record ID',p.id,'Member reference',p.user_id,'Sport',p.sport,'Reward period',p.period,
    'Policy',p.policy,'Due at',p.due_at,'Issued at',p.issued_at,'Opened at',p.opened_at,'Status',case when p.opened_at is null then 'Unopened' else 'Opened' end,'Price','Free reward')
    into title,source,fields from sports_feed.weekly_core_packs p where p.id::text=p_id;
  end if;
  if title is null then
   select s.document into doc from credits_sandbox.state s where s.document#>array['economy','packs',p_id] is not null or s.document#>array['economy','products',p_id] is not null;
   item:=doc#>array['economy','packs',p_id];
   if item is not null then
    title:=item#>>'{product,name}';source:='Purchase-time pack configuration snapshot';
    fields:=jsonb_build_object('Record ID',p_id,'Member reference',item->>'member','Configuration version',item#>>'{product,version}',
     'Configuration hash',item->>'configurationHash','Card count',item#>'{product,cards}','Price (test credits)',item#>'{product,priceCredits}',
     'Issued at',to_timestamp((item->>'createdAt')::numeric/1000),'Opened at',to_timestamp((item->>'openedAt')::numeric/1000),
     'Status',case when item->>'openedAt' is null then 'Unopened' else 'Opened' end);
   else
    item:=doc#>array['economy','products',p_id];
    if item is not null then
     title:=item->>'name';source:='Pack configuration';
     fields:=jsonb_build_object('Record ID',p_id,'Version',item->>'version','Sport',item->>'sport','Card count',item->'cards','Price (test credits)',item->'priceCredits',
      'Status',item->>'status','Duplicate-player policy',item->>'duplicatePlayers','Supply exhaustion policy',item->>'exhaustion',
      'Effective at',to_timestamp((item->>'effectiveAt')::numeric/1000),'Expires at',to_timestamp((item->>'expiresAt')::numeric/1000));
    end if;
   end if;
  end if;
 elsif p_category='transactions' then
  select j.value into item from credits_sandbox.state s cross join lateral jsonb_array_elements(coalesce(s.document->'journal','[]')) j where j.value->>'id'=p_id;
  if item is not null then
   title:='Test-credit ledger record';source:='Immutable credit journal · test credits have no cash value';
   fields:=jsonb_build_object('Record ID',p_id,'Policy',item->>'policy','Recorded at',to_timestamp((item->>'at')::numeric/1000),'Unit','Test credits',
    'Line count',jsonb_array_length(item->'lines'),'Journal line total',(select sum((l->>'credits')::numeric) from jsonb_array_elements(item->'lines') l));
   select coalesce(jsonb_agg(to_jsonb(e) order by e.ordinal),'[]') into events from (
    select l.n ordinal,l.n::text id,to_timestamp((item->>'at')::numeric/1000) at,'Ledger line' event,
     concat_ws(' · ',l.value->>'account',(l.value->>'credits')||' test credits') detail
    from jsonb_array_elements(item->'lines') with ordinality l(value,n) order by l.n limit 21 offset (p_page-1)*20
   ) e;
  end if;
 end if;
 if title is null then return null;end if;
 more:=jsonb_array_length(events)>20;
 select coalesce(jsonb_agg(e.value order by e.n),'[]') into events from jsonb_array_elements(events) with ordinality e(value,n) where e.n<=20;
 return jsonb_build_object('id',p_id,'category',p_category,'title',title,'source',source,'fields',fields,'history',events,'page',p_page,'hasMore',more);
end $$;
revoke all on function beta_private.admin_record_detail(text,text,integer) from public,anon,authenticated,service_role,docked_app,docked_nfl_worker;
grant execute on function beta_private.admin_record_detail(text,text,integer) to docked_beta_app;
