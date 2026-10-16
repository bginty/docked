-- Read-only, bounded administrative projection. No new roles, table grants,
-- ledger writes, member mutations or ownership/lineup disclosure.
create function beta_private.admin_search(p_query text,p_category text default 'all',p_page integer default 1)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='4s' as $$
declare actor uuid:=auth.uid(); staff_role text; permitted text[]; selected text[]; result jsonb;
begin
 if actor is null or not coalesce(beta_private.active_member_session(),false) or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'Staff MFA required'; end if;
 select role into staff_role from beta_private.roles where user_id=actor;
 permitted:=case staff_role
  when 'owner' then array['members','cards','packs','transactions','competitions','moderation']
  when 'admin' then array['members','cards','packs','competitions','moderation']
  when 'auditor' then array['members','cards','packs','competitions','moderation']
  when 'editor' then array['competitions','moderation']
  when 'analyst' then array['competitions'] else array[]::text[] end;
 if cardinality(permitted)=0 then raise exception 'Role denied'; end if;
 if p_category is null or (p_category<>'all' and not p_category=any(permitted)) then raise exception 'Category denied';end if;
 p_query:=btrim(coalesce(p_query,''));
 if length(p_query)>120 or p_page is null or p_page<1 or p_page>100 then raise exception 'Invalid search';end if;
 if length(p_query)<2 then return '[]'::jsonb;end if;
 selected:=case when p_category='all' then permitted else array[p_category] end;
 with records as (
  select p.id::text id,'members'::text category,coalesce(nullif(s.display_name,''),'Member') title,
   concat_ws(' · ',case when p.disabled_at is null then 'Account enabled' else 'Account restricted' end,case when s.handle is not null then '@'||s.handle end) detail
   from beta_public.profiles p left join beta_private.social_profiles s on s.user_id=p.id where 'members'=any(selected)
  union all select c.id::text,'cards',p.name,concat_ws(' · ',upper(p.sport),p.position,e.tier,'#'||c.serial)
   from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id join beta_fantasy.players p on p.id=e.player_id where 'cards'=any(selected)
  union all select i.key,'cards',coalesce(s.document#>>array['economy','players',i.value->>'playerId','name'],'Player record'),
   concat_ws(' · ',upper(s.document#>>array['economy','players',i.value->>'playerId','sport']),i.value->>'rarity','#'||(i.value->>'serial'))
   from credits_sandbox.state s cross join lateral jsonb_each(coalesce(s.document#>'{economy,instances}','{}')) i where 'cards'=any(selected)
  union all select d.key,'cards',coalesce(s.document#>>array['economy','players',d.value->>'playerId','name'],'Player record'),
   concat_ws(' · ','Edition',d.value->>'rarity',(d.value->>'issued')||' issued')
   from credits_sandbox.state s cross join lateral jsonb_each(coalesce(s.document#>'{economy,definitions}','{}')) d where 'cards'=any(selected)
  union all select p.id::text,'packs',d.name,case when p.opened_at is null then 'Unopened · legacy pack' else 'Opened · legacy pack' end
   from beta_fantasy.packs p join beta_fantasy.pack_definitions d on d.id=p.definition_id where 'packs'=any(selected)
  union all select p.key,'packs',p.value#>>'{product,name}',case when p.value->>'openedAt' is null then 'Unopened · test-credit purchase' else 'Opened · test-credit purchase' end
   from credits_sandbox.state s cross join lateral jsonb_each(coalesce(s.document#>'{economy,packs}','{}')) p where 'packs'=any(selected)
  union all select p.key,'packs',p.value->>'name',concat_ws(' · ','Configuration',p.value->>'version',(p.value->>'cards')||' cards',(p.value->>'priceCredits')||' test credits')
   from credits_sandbox.state s cross join lateral jsonb_each(coalesce(s.document#>'{economy,products}','{}')) p where 'packs'=any(selected)
  union all select p.id::text,'packs','Weekly Core Pack',case when p.opened_at is null then 'Unopened · free reward' else 'Opened · free reward' end
   from sports_feed.weekly_core_packs p where 'packs'=any(selected)
  union all select j.value->>'id','transactions','Credit ledger record',concat_ws(' · ',j.value->>'policy','Test credits · no cash value')
   from credits_sandbox.state s cross join lateral jsonb_array_elements(coalesce(s.document->'journal','[]')) j where 'transactions'=any(selected)
  union all select c.id::text,'competitions',case when c.rules->>'lineup_version' is not null and c.rules->>'mode' in ('SALARY_CAP','OPEN') then
    (case c.rules->>'mode' when 'SALARY_CAP' then 'Traditional' else 'All-Star' end)||' · '||c.season||' · Week '||c.round else c.name end,
   concat_ws(' · ',upper(c.sport),c.season,'Week '||c.round) from beta_fantasy.competitions c where 'competitions'=any(selected)
  union all select r.id::text,'moderation',initcap(r.target_type)||' report',concat_ws(' · ',r.status,r.reason)
   from beta_private.social_reports r where 'moderation'=any(selected)
 ), matches as (
  select distinct id,category,title,detail from records where strpos(lower(concat_ws(' ',id,title,detail)),lower(p_query))>0
 ), page as (
  select * from matches order by case when lower(id)=lower(p_query) then 0 when lower(title)=lower(p_query) then 1 else 2 end,category,lower(title),id limit 21 offset (p_page-1)*20
 ) select coalesce(jsonb_agg(to_jsonb(page) order by case when lower(id)=lower(p_query) then 0 when lower(title)=lower(p_query) then 1 else 2 end,category,lower(title),id),'[]'::jsonb) into result from page;
 return result;
end $$;
revoke all on function beta_private.admin_search(text,text,integer) from public,anon,authenticated,service_role,docked_app,docked_nfl_worker;
grant execute on function beta_private.admin_search(text,text,integer) to docked_beta_app;
