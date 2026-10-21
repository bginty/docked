-- Additive controls only. No campaign activation or live content classification.
create function credits_sandbox.guard_pack_coupons() returns trigger language plpgsql security invoker set search_path='' as $$
declare c jsonb; r record; oldr jsonb; p jsonb; uses bigint; amount bigint; paid bigint;
begin
 if coalesce(new.document#>'{packCoupons,campaigns}','{}') is distinct from coalesce(old.document#>'{packCoupons,campaigns}','{}') then
  if not beta_private.active_member_session() or auth.jwt()->>'aal' is distinct from 'aal2'
   or not exists(select 1 from beta_private.roles where user_id=auth.uid() and role in ('owner','admin')) then raise exception 'Coupon administration requires staff MFA';end if;
  if coalesce(new.document#>'{packCoupons,redemptions}','{}') is distinct from coalesce(old.document#>'{packCoupons,redemptions}','{}') then raise exception 'Review campaign changes separately from purchases';end if;
  for r in select * from jsonb_each(coalesce(old.document#>'{packCoupons,campaigns}','{}')) loop
   if not coalesce(new.document#>'{packCoupons,campaigns}','{}') ? r.key then raise exception 'Coupon history cannot be deleted';end if;
  end loop;
 end if;
 for r in select * from jsonb_each(coalesce(old.document#>'{packCoupons,redemptions}','{}')) loop
  if new.document#>array['packCoupons','redemptions',r.key] is distinct from r.value then raise exception 'Completed coupon redemption is immutable';end if;
 end loop;
 for r in select * from jsonb_each(coalesce(new.document#>'{packCoupons,redemptions}','{}')) loop
  oldr:=old.document#>array['packCoupons','redemptions',r.key];
  if oldr is not null then continue;end if;
  c:=old.document#>array['packCoupons','campaigns',r.value#>>'{coupon,code}'];
  p:=new.document#>array['economy','packs',r.key];
  if c is null or r.value->'coupon' is distinct from c or c->>'status'<>'active'
    or (r.value->>'member')::uuid is distinct from auth.uid()
    or extract(epoch from statement_timestamp())*1000 < (c->>'startsAt')::bigint
    or extract(epoch from statement_timestamp())*1000 >= (c->>'expiresAt')::bigint
    or p is null or p->'pricing' is distinct from r.value
    or p->>'member' is distinct from r.value->>'member'
    or p#>>'{product,sport}' is distinct from c->>'sport'
    or not (c->'products' ? (p#>>'{product,id}')) then raise exception 'Coupon purchase eligibility changed';end if;
  select count(*) into uses from jsonb_each(new.document#>'{packCoupons,redemptions}') x where x.value#>>'{coupon,code}'=c->>'code';
  if uses>(c->>'totalLimit')::bigint then raise exception 'Coupon redemption limit reached';end if;
  select count(*) into uses from jsonb_each(new.document#>'{packCoupons,redemptions}') x where x.value#>>'{coupon,code}'=c->>'code' and x.value->>'member'=r.value->>'member';
  if uses>(c->>'accountLimit')::bigint then raise exception 'Account coupon limit reached';end if;
  if (c->>'firstPurchaseOnly')::boolean and exists(select 1 from jsonb_each(old.document->'entitlements') e join lateral jsonb_array_elements(old.document->'journal') j on j->>'id'=e.value->>'source' where e.value->>'member'=r.value->>'member' and right(j->>'id',5)='_pack') then raise exception 'First purchase restriction';end if;
  amount:=(p#>>'{product,priceCredits}')::bigint;
  paid:=amount-least(case when c->>'type'='percent' then floor((amount::numeric*(c->>'value')::numeric+50)/100)::bigint else (c->>'value')::bigint end,(c->>'maximumDiscount')::bigint,amount-case when (c->>'allowZero')::boolean then 0 else 1 end);
  if (r.value->>'original')::bigint<>amount or (r.value->>'charge')::bigint<>paid or (r.value->>'saving')::bigint<>amount-paid or paid<0 or amount-paid<=0
    or not exists(select 1 from jsonb_array_elements(new.document->'journal') j where j->>'id'=new.document#>>array['entitlements',r.key,'source'] and (select coalesce(sum((l->>'credits')::bigint),0) from jsonb_array_elements(j->'lines') l where l->>'account'='system:pack-revenue')=paid)
    then raise exception 'Coupon settlement does not reconcile';end if;
 end loop;
 return new;
end $$;

-- Original publication and subsequent published edit are distinct. Draft edits
-- and pin actions never masquerade as published content changes.
create or replace function beta_private.member_announcements(p_id uuid default null,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(beta_private.active_member_session(),false) or not coalesce(beta_private.admitted(auth.uid()),false) then raise exception 'Active admitted session required';end if;
 if p_page is null or p_page not between 1 and 1000 then raise exception 'Invalid page';end if;
 return coalesce((select jsonb_agg(v order by pinned desc,published_at desc,id) from (
 select d.id,d.published->>'title' title,d.published->>'body' body,d.published->>'cta' cta,
 coalesce(first.published_at,d.published_at) published_at,
 case when first.published_at<d.published_at then d.published_at else null end edited_at,d.pinned
 from beta_private.announcement_drafts d left join lateral(select min(e.created_at) published_at from beta_private.announcement_events e where e.draft_id=d.id and e.action='publish') first on true
 where d.published is not null and d.status<>'archived' and d.published_at<=clock_timestamp() and (p_id is null or d.id=p_id)
 order by d.pinned desc,d.published_at desc,d.id limit 26 offset (p_page-1)*25)v),'[]');
end $$;
revoke all on function beta_private.member_announcements(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function beta_private.member_announcements(uuid,integer) to docked_beta_app;
revoke all on function credits_sandbox.guard_pack_coupons() from public,anon,authenticated,service_role;
grant execute on function credits_sandbox.guard_pack_coupons() to docked_beta_app;
create trigger pack_coupon_guard before update on credits_sandbox.state for each row execute function credits_sandbox.guard_pack_coupons();

-- Explicit provenance registry: no heuristic based on a member's name or text.
create table beta_private.internal_qa_entities(
 kind text not null check(kind in('post','account')), entity_id uuid not null,
 evidence text not null check(length(evidence)>10), recorded_at timestamptz not null default clock_timestamp(),
 primary key(kind,entity_id)
);
alter table beta_private.internal_qa_entities enable row level security;
revoke all on beta_private.internal_qa_entities from public,anon,authenticated,service_role,docked_beta_app;
grant select on beta_private.internal_qa_entities to docked_beta_app;
create policy runtime_read on beta_private.internal_qa_entities for select to docked_beta_app using(true);
-- Retain the existing visibility policy verbatim behind an additional exclusion.
alter function beta_private.social_post_visible(uuid,uuid) rename to social_post_visible_before_qa;
create function beta_private.social_post_visible(p_viewer uuid,p_post uuid) returns boolean language sql stable set search_path='' as $$
 select beta_private.social_post_visible_before_qa(p_viewer,p_post)
 and not exists(select 1 from beta_private.internal_qa_entities q where (q.kind='post' and q.entity_id=p_post)
 or (q.kind='account' and exists(select 1 from beta_private.social_posts p join beta_private.social_profiles a on a.id=p.author_id where p.id=p_post and a.user_id=q.entity_id)))
$$;
revoke all on function beta_private.social_post_visible(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function beta_private.social_post_visible(uuid,uuid) to docked_beta_app;
create function beta_private.reject_internal_qa_entry() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from beta_private.internal_qa_entities where kind='account' and entity_id=new.user_id) then raise exception 'Internal QA accounts require an isolated competition environment';end if;
 return new;
end $$;
revoke all on function beta_private.reject_internal_qa_entry() from public,anon,authenticated,service_role;
create trigger internal_qa_entry_guard before insert or update on beta_fantasy.entries for each row execute function beta_private.reject_internal_qa_entry();

-- A retry only advances the existing worker queue. It cannot edit a score,
-- import unverified numbers, finalise a round or grant a prize.
create table sports_feed.owner_retry_requests(id bigint generated always as identity primary key,competition uuid not null,actor uuid not null,requested_at timestamptz not null default clock_timestamp());
alter table sports_feed.owner_retry_requests enable row level security;
revoke all on sports_feed.owner_retry_requests from public,anon,authenticated,service_role,docked_beta_app;
create function sports_feed.request_round_retry(target uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform sports_feed.owner_scoring_diagnostics();
 if not exists(select 1 from sports_feed.nfl_rounds n join beta_fantasy.competitions c on c.id=n.competition_id where n.competition_id=target and n.purpose='member' and c.scored_at is null) then raise exception 'Only unfinished member rounds can be retried';end if;
 perform pg_advisory_xact_lock(71820343);
 if exists(select 1 from sports_feed.owner_retry_requests where competition=target and requested_at>clock_timestamp()-interval '1 minute') then return;end if;
 update sports_feed.nfl_rounds set next_check=clock_timestamp() where competition_id=target;
 insert into sports_feed.owner_retry_requests(competition,actor) values(target,auth.uid());
end $$;
revoke all on function sports_feed.request_round_retry(uuid) from public,anon,authenticated,service_role;
grant execute on function sports_feed.request_round_retry(uuid) to docked_beta_app;

-- Preserve the current scoring/visibility function body, adding only an honest
-- source-sync timestamp. Journal updates and worker attempts remain separate.
do $$declare definition text;begin
 if to_regprocedure('sports_feed.game_day_standings()') is not null then
  definition:=pg_get_functiondef('sports_feed.game_day_standings()'::regprocedure);
  if position('''lastCheckedAt'',n.last_checked' in definition)=0 then raise exception 'Review current game-day projection before migration';end if;
  definition:=replace(definition,'''lastCheckedAt'',n.last_checked','''lastSuccessfulSyncAt'',(select max(pc.checked_at) from sports_feed.postgame_cache pc join sports_feed.raw_revisions pr on pr.id=pc.raw_id where pr.body->>''dataset'' in (''weekly'',''pbp'')),''lastCheckedAt'',n.last_checked');
  execute definition;
 end if;
end $$;
