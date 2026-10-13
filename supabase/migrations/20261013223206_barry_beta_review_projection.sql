-- Read-model only. No changes to entries, eligibility rules, locked snapshots or assets.
alter function sports_feed.seven_inventory(uuid) rename to seven_inventory_before_review;
create function sports_feed.seven_inventory(u uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(c||jsonb_build_object('source_status',r.status,'status_observed_at',r.checked_at,
 'availability_reason',case when r.checked_at is null then 'Roster source data is unavailable; eligibility cannot be verified.'
 when r.checked_at<clock_timestamp()-interval '72 hours' then 'Roster source is stale; eligibility awaits a fresh observation.'
 when r.status='RET' then 'Roster source reports retired. Existing ownership is preserved.'
 when r.status<>'ACT' then 'Roster source reports '||r.status||' (not active). Current rules require active roster status for new selections. This is not an injury diagnosis or confirmed DNP.'
 else null end)), '[]')
 from jsonb_array_elements(sports_feed.seven_inventory_before_review(u)) c
 left join credits_sandbox.current_player_status r on r.id=c->>'player_id'
$$;
revoke all on function sports_feed.seven_inventory_before_review(uuid),sports_feed.seven_inventory(uuid) from public,anon,authenticated,service_role,docked_beta_app;

create function sports_feed.member_review_context() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; answer jsonb;begin
 u:=beta_fantasy.production_eligible();
 if u is null or u<>auth.uid() or not beta_private.active_member_session() then raise exception 'Active admitted member required';end if;
 select jsonb_build_object('rounds',coalesce((select jsonb_agg(jsonb_build_object(
 'id',c.id,'name',c.name,'season',c.season,'week',c.round,'mode',coalesce(c.rules->>'mode','LEGACY'),
 'closesAt',c.locks_at,'finalAt',c.scored_at,'entryCount',(select count(*) from beta_fantasy.entries e where e.competition_id=c.id),
 'entered',exists(select 1 from beta_fantasy.entries e where e.competition_id=c.id and e.user_id=u),
 'updatedAt',j.recorded_at,'rules',coalesce(j.body->'period'->'rules',sr.rules),
 'lineup',lc.configuration,'visible',coalesce(rc.standings_visible,true),'streamId',n.stream_id
 ) order by c.season desc,c.round desc,c.name) from sports_feed.nfl_rounds n
 join beta_fantasy.competitions c on c.id=n.competition_id
 join beta_fantasy.scoring_rules sr on sr.id=c.scoring_id
 left join beta_fantasy.lineup_configurations lc on lc.version=c.rules->>'lineup_version'
 left join beta_fantasy.round_controls rc on rc.competition_id=c.id
 left join lateral(select body,recorded_at from sports_feed.journal where stream_id=n.stream_id order by revision desc limit 1)j on true
 where n.purpose='member'), '[]'),
 'cardHistory',coalesce((select jsonb_object_agg(i.key, (select coalesce(jsonb_agg(jsonb_build_object('at',h->'at','event',case when h->>'from' is null then 'Issued' when s.document->'listings' ? (h->>'reference') then 'Purchased / sold' when s.document->'swaps' ? (h->>'reference') then 'Swapped' else 'Ownership transferred' end)),'[]') from jsonb_array_elements(s.document->'cards'->i.key->'history')h) || case when (s.document#>array['economy','packs',s.document#>>array['economy','instances',i.key,'source'],'openedAt']) is not null and (s.document#>array['economy','packs',s.document#>>array['economy','instances',i.key,'source'],'openedAt']) <> 'null'::jsonb then jsonb_build_array(jsonb_build_object('event','Pack opened','at',s.document#>array['economy','packs',s.document#>>array['economy','instances',i.key,'source'],'openedAt'])) else '[]'::jsonb end)
 from credits_sandbox.state s,jsonb_each(s.document->'commerce'->'cards')i where s.id and i.value->>'owner'=u::text),'{}')) into answer;
 return answer;
end$$;
revoke all on function sports_feed.member_review_context() from public,anon,authenticated,service_role;
grant execute on function sports_feed.member_review_context() to docked_beta_app;
create or replace function sports_feed.nfl_standings() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;begin
 u:=beta_fantasy.production_eligible();if u is null or not beta_private.active_member_session() then raise exception 'Active session required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('competitionId',n.competition_id,'label',c.name,'rows',(
 select coalesce(jsonb_agg(jsonb_build_object('name',case when r->>'member'=u::text then 'You' else coalesce(p.display_name,'Member') end,'isMe',r->>'member'=u::text,'points',(r->>'centipoints')::numeric/100,'rank',r->'rank','status',r->>'status') order by (r->>'rank')::int nulls last),'[]') from jsonb_array_elements(j.calculated->'rows')r left join beta_private.social_profiles p on p.user_id=(r->>'member')::uuid and p.status='active' and p.visibility='members')))
 from sports_feed.nfl_rounds n join beta_fantasy.competitions c on c.id=n.competition_id
 left join lateral(select calculated from sports_feed.journal where stream_id=n.stream_id order by revision desc limit 1)j on true
 where n.purpose='member' and not exists(select 1 from beta_fantasy.round_controls where competition_id=c.id and not standings_visible)),'[]');
end$$;
revoke all on function sports_feed.nfl_standings() from public,anon,authenticated,service_role;
grant execute on function sports_feed.nfl_standings() to docked_beta_app;
