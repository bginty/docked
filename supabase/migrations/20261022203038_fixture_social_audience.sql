-- Fictional collectible posts are visible only to the existing admitted sport
-- testers. They never become public posts or permanent card ownership.
insert into beta_private.sports(id,name,enabled) values('basketball','NBA testing',false),('afl','AFL testing',false),('nrl','NRL testing',false) on conflict do nothing;
create function sports_feed.fixture_social_access(s text,viewer uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(s in ('basketball','afl','nrl')
 and exists(select 1 from sports_feed.nba_beta_control where id and enabled)
 and exists(select 1 from sports_feed.nba_beta_access b join auth.users u on u.id=b.user_id
  where b.user_id=viewer and b.enabled and b.expires_at>clock_timestamp()
  and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
  and (to_jsonb(u)->>'banned_until' is null or (to_jsonb(u)->>'banned_until')::timestamptz<clock_timestamp()))
 and beta_private.beta_gameplay_identity(viewer)
 and (s='basketball' or exists(select 1 from sports_feed.private_beta_sports where sport=s and enabled)),false)
$$;
create function sports_feed.fixture_social_visible(cards jsonb,profile uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare s text; n int;u uuid;begin
 select count(*),min(p.identity->>'sport') into n,s from jsonb_array_elements(cards)c
 join credits_sandbox.nba_fixture_instances i on i.id::text=c->>'id'
 join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId';
 if n=0 then return true;end if;
 if n<>jsonb_array_length(cards) or exists(select 1 from jsonb_array_elements(cards)c join credits_sandbox.nba_fixture_instances i on i.id::text=c->>'id' join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId' where p.identity->>'sport'<>s) then return false;end if;
 select user_id into u from beta_private.social_profiles where id=profile;
 return sports_feed.fixture_social_access(s,u);
end$$;
create function sports_feed.fixture_social_post_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare s text;n int;u uuid;d jsonb;begin
 select count(*),min(p.identity->>'sport') into n,s from jsonb_array_elements(new.card_snapshots)c
 join credits_sandbox.nba_fixture_instances i on i.id::text=c->>'id'
 join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId';
 if n=0 then return new;end if;
 if not sports_feed.fixture_social_visible(new.card_snapshots,new.author_id) or new.sport is distinct from s then raise exception 'Private fixture audience and matching sport required';end if;
 select user_id into u from beta_private.social_profiles where id=new.author_id;
 select document into d from credits_sandbox.state where id;
 if exists(select 1 from jsonb_array_elements(new.card_snapshots)c
  join credits_sandbox.nba_fixture_instances i on i.id::text=c->>'id'
  where d->'commerce'->'cards'->(c->>'id')->>'owner' is distinct from u::text
  or d->'economy'->'packs'->(i.document->>'source')->>'openedAt' is null) then raise exception 'Only owned opened fixture cards can be shared';end if;
 return new;
end$$;
revoke all on function sports_feed.fixture_social_access(text,uuid),sports_feed.fixture_social_visible(jsonb,uuid),sports_feed.fixture_social_post_guard() from public,anon,authenticated,service_role,docked_beta_app;
grant execute on function sports_feed.fixture_social_visible(jsonb,uuid) to docked_beta_app;
create trigger fixture_social_post_guard before insert on beta_private.social_posts for each row execute function sports_feed.fixture_social_post_guard();
do $$declare b text;needle text;begin
 b:=pg_get_functiondef('beta_private.social_post_visible(uuid,uuid)'::regprocedure);
 needle:='select beta_private.social_post_visible_before_qa(p_viewer,p_post)';
 if position(needle in b)=0 then raise exception 'Review changed post audience implementation';end if;
 execute replace(b,needle,needle||' and exists(select 1 from beta_private.social_posts p where p.id=p_post and sports_feed.fixture_social_visible(p.card_snapshots,p_viewer))');
end$$;
