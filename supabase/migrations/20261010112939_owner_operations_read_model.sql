-- Owner-only aggregate/reporting surface; read-only, beta namespace only.
create function beta_private.owner_operations(p_start timestamptz,p_end timestamptz,p_sport text default null,p_include_staff boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$declare output jsonb;begin
 if not beta_private.active_member_session() or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from beta_private.roles where user_id=auth.uid() and role='owner')
 or not beta_private.owner_gameplay_identity(auth.uid()) then raise exception 'Owner MFA required';end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '366 days' or p_sport not in('football','nfl','afl') then raise exception 'Invalid reporting range';end if;
 with members as (
 select p.id,p.created_at from beta_public.profiles p join beta_private.admissions a on a.user_id=p.id
 where p.disabled_at is null and (p_include_staff or (not a.administrator and not exists(select 1 from beta_private.roles r where r.user_id=p.id)))
 ), activity as (
 select e.user_id,e.updated_at at,c.sport from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id
 union all select p.user_id,p.opened_at,null::text from beta_fantasy.packs p where p.opened_at is not null
 union all select p.user_id,s.created_at,s.sport from beta_private.social_posts s join beta_private.social_profiles p on p.id=s.author_id where s.deleted_at is null and s.kind<>'edge'
 union all select s.sender,s.completed_at,null::text from beta_fantasy.swaps s where s.state='accepted'
 union all select s.recipient,s.completed_at,null::text from beta_fantasy.swaps s where s.state='accepted'
 ), filtered as(select a.* from activity a join members m on m.id=a.user_id where p_sport is null or a.sport=p_sport)
 select jsonb_build_object(
 'scope','beta','generatedAt',clock_timestamp(),'start',p_start,'end',p_end,'sport',p_sport,'includeStaff',p_include_staff,
 'metrics',jsonb_build_object(
 'registered',(select count(*) from auth.users u join beta_private.admissions a on a.user_id=u.id where p_include_staff or not a.administrator),
 'admitted',(select count(*) from beta_private.admissions a where status='accepted' and (p_include_staff or not a.administrator)),
 'newRegistrations',(select count(*) from members where created_at>=p_start and created_at<p_end),
 'activeToday',(select count(distinct user_id) from filtered where at>=date_trunc('day',clock_timestamp() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney'),
 'activeWeek',(select count(distinct user_id) from filtered where at>=date_trunc('week',clock_timestamp() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney'),
 'activeMonth',(select count(distinct user_id) from filtered where at>=date_trunc('month',clock_timestamp() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney'),
 'activeInRange',(select count(distinct user_id) from filtered where at>=p_start and at<p_end),
 'starterCards',(select count(*) from beta_fantasy.starter_claims s join members m on m.id=s.user_id),
 'teamsEntered',(select count(*) from beta_fantasy.entries e join members m on m.id=e.user_id join beta_fantasy.competitions c on c.id=e.competition_id where e.updated_at>=p_start and e.updated_at<p_end and (p_sport is null or c.sport=p_sport)),
 'competitors',(select count(distinct e.user_id) from beta_fantasy.entries e join members m on m.id=e.user_id join beta_fantasy.competitions c on c.id=e.competition_id where e.updated_at>=p_start and e.updated_at<p_end and (p_sport is null or c.sport=p_sport)),
 'packsOpened',(select count(*) from beta_fantasy.packs p join members m on m.id=p.user_id where opened_at>=p_start and opened_at<p_end and p_sport is null),
 'tradeOffers',(select count(*) from beta_fantasy.swaps s join members m on m.id=s.sender where s.created_at>=p_start and s.created_at<p_end and p_sport is null),
 'acceptedTrades',(select count(*) from beta_fantasy.swaps s where s.state='accepted' and s.completed_at>=p_start and s.completed_at<p_end and exists(select 1 from members m where m.id in(s.sender,s.recipient)) and p_sport is null),
 'posts',(select count(*) from beta_private.social_posts p join beta_private.social_profiles sp on sp.id=p.author_id join members m on m.id=sp.user_id where p.created_at>=p_start and p.created_at<p_end and p.kind<>'edge' and (p_sport is null or p.sport=p_sport))
 ),
 'competitions',coalesce((select jsonb_agg(row) from (select c.id,c.name,c.sport,c.round,c.locks_at,c.scored_at,r.version rules_version,
 (select count(*) from beta_fantasy.entries e join members m on m.id=e.user_id where e.competition_id=c.id) entries,
 (select count(*) from beta_fantasy.results x join members m on m.id=x.user_id where x.competition_id=c.id) scored_entries,
 coalesce((select jsonb_agg(jsonb_build_object('member',x.user_id,'rank',x.rank,'score',x.score) order by x.rank) from beta_fantasy.results x join members m on m.id=x.user_id where x.competition_id=c.id),'[]') rankings
 from beta_fantasy.competitions c join beta_fantasy.scoring_rules r on r.id=c.scoring_id where (p_sport is null or c.sport=p_sport) and c.locks_at>=p_start and c.opens_at<p_end order by c.locks_at limit 500) row),'[]'),
 'inventory',coalesce((select jsonb_agg(row) from (select e.id,p.name,p.sport,e.tier,e.season,e.max_supply,e.issued,
 e.max_supply-e.issued available_lifetime_supply,(select count(*) from beta_fantasy.cards c where c.edition_id=e.id) cards,
 (select count(distinct c.serial) from beta_fantasy.cards c where c.edition_id=e.id) distinct_serials
 from beta_fantasy.editions e join beta_fantasy.players p on p.id=e.player_id where p_sport is null or p.sport=p_sport order by p.name,e.tier limit 500) row),'[]'),
 'reports',coalesce((select jsonb_agg(row) from (select id,status,created_at from beta_private.social_reports where status='open' order by created_at limit 100) row),'[]'),
 'emailFailures',(select count(*) from beta_private.outbox where state='dead' and created_at>=p_start and created_at<p_end),
 'limitations',jsonb_build_array('Gameplay activity uses saved teams, opened packs, posts and accepted trades; login is excluded.','Saved-team activity is last-update based, not a reconstructed event history. Retention cohorts are not available.','Registered means accounts linked to beta invitations, not every Supabase identity.','Inventory is a current snapshot; competition lists overlap the selected range. Table limits: 500; reports: 100.','Sport filters exclude unclassified packs/swaps rather than guessing their sport.','Synthetic beta competition scoring is not live finalisation evidence. No prizes are generated.')) into output;
 return output;
end$$;
revoke all on function beta_private.owner_operations(timestamptz,timestamptz,text,boolean) from public,anon,authenticated,docked_app;
grant execute on function beta_private.owner_operations(timestamptz,timestamptz,text,boolean) to docked_beta_app;
