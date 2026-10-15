-- Additive social extensions in both isolated namespaces. No existing visibility,
-- holdings, wallet, entries or post content is rewritten. No activation/seeding.
do $migration$
declare ns text; runtime_role text; fs text; tbl text;
begin
foreach ns in array array['private','beta_private'] loop
  fs := case when ns='private' then 'fantasy' else 'beta_fantasy' end;
  runtime_role := case when ns='private' then 'docked_app' else 'docked_beta_app' end;
  execute format($sql$
    create table %1$I.social_collection_settings (
      profile_id uuid primary key references %1$I.social_profiles(id),
      visibility text not null default 'private' check(visibility in ('members','followers','private')),
      offers text not null default 'nobody' check(offers in ('everyone','followers','nobody')),
      minimum_credits bigint check(minimum_credits between 1 and 1000000000),
      card_preferences jsonb not null default '{}' check(jsonb_typeof(card_preferences)='object'),
      updated_at timestamptz not null default clock_timestamp()
    );
    create table %1$I.social_communities (
      id uuid primary key default gen_random_uuid(),
      name text not null check(length(name) between 3 and 80),
      description text not null check(length(description)<=500),
      rules text not null check(length(rules) between 10 and 4000),
      sport text check(sport in ('nfl','football')),
      status text not null default 'active' check(status in ('active','closed')),
      created_by uuid not null references %1$I.social_profiles(id),
      created_at timestamptz not null default clock_timestamp(),
      unique(name)
    );
    create table %1$I.social_community_members (
      community_id uuid references %1$I.social_communities(id),
      profile_id uuid references %1$I.social_profiles(id),
      joined_at timestamptz not null default clock_timestamp(),
      primary key(community_id,profile_id)
    );
    create table %1$I.social_discussion_follows (
      post_id uuid references %1$I.social_posts(id),
      profile_id uuid references %1$I.social_profiles(id),
      primary key(post_id,profile_id)
    );
    alter table %1$I.social_posts add column card_snapshots jsonb not null default '[]' check(jsonb_typeof(card_snapshots)='array' and jsonb_array_length(card_snapshots)<=4),
      add column player_id text,
      add column community_id uuid references %1$I.social_communities(id);
    create index social_posts_community_page on %1$I.social_posts(community_id,created_at desc,id desc) where community_id is not null;
    create index social_posts_player_page on %1$I.social_posts(player_id,created_at desc,id desc) where player_id is not null;
    create function %1$I.social_snapshot_immutable() returns trigger language plpgsql set search_path='' as $fn$
    begin
      if new.card_snapshots is distinct from old.card_snapshots or new.player_id is distinct from old.player_id or new.community_id is distinct from old.community_id then raise exception 'Post card snapshot and discussion context are immutable'; end if;
      return new;
    end $fn$;
    revoke all on function %1$I.social_snapshot_immutable() from public,anon,authenticated;
    create trigger social_snapshot_immutable before update on %1$I.social_posts for each row execute function %1$I.social_snapshot_immutable();
    create or replace function %1$I.social_post_visible(p_viewer uuid,p_post uuid) returns boolean language sql stable set search_path='' as $fn$
      select %1$I.community_post_allowed(auth.uid(),p_post) and exists(
        select 1 from %1$I.social_posts p where p.id=p_post and %1$I.social_profile_visible(p_viewer,p.author_id,false)
        and (p.moderation_status='visible' or p.kind='edge') and (p.deleted_at is null or p.kind='edge')
        and (p.community_id is null or exists(select 1 from %1$I.social_communities c where c.id=p.community_id and c.status='active')))
    $fn$;
  $sql$,ns);


      -- Private server-role access only; browser roles have no schema/table grants.
      execute format('alter table %I.social_collection_settings enable row level security',ns);
      execute format('alter table %I.social_communities enable row level security',ns);
      execute format('alter table %I.social_community_members enable row level security',ns);
      execute format('alter table %I.social_discussion_follows enable row level security',ns);
      execute format('revoke all on %1$I.social_collection_settings,%1$I.social_communities,%1$I.social_community_members,%1$I.social_discussion_follows from public,anon,authenticated',ns);
      execute format('grant select,insert,update,delete on %1$I.social_collection_settings,%1$I.social_communities,%1$I.social_community_members,%1$I.social_discussion_follows to %2$I',ns,runtime_role);
      foreach tbl in array array['social_collection_settings','social_community_members','social_discussion_follows'] loop
        execute format('create policy runtime_read on %1$I.%2$I for select to %3$I using(true)',ns,tbl,runtime_role);
        execute format('create policy runtime_insert on %1$I.%2$I for insert to %3$I with check(exists(select 1 from %1$I.social_profiles p where p.id=profile_id and p.user_id=auth.uid()))',ns,tbl,runtime_role);
        execute format('create policy runtime_update on %1$I.%2$I for update to %3$I using(exists(select 1 from %1$I.social_profiles p where p.id=profile_id and p.user_id=auth.uid())) with check(exists(select 1 from %1$I.social_profiles p where p.id=profile_id and p.user_id=auth.uid()))',ns,tbl,runtime_role);
        execute format('create policy runtime_delete on %1$I.%2$I for delete to %3$I using(exists(select 1 from %1$I.social_profiles p where p.id=profile_id and p.user_id=auth.uid()))',ns,tbl,runtime_role);
      end loop;
      execute format('create policy runtime_read on %1$I.social_communities for select to %2$I using(true)',ns,runtime_role);
      execute format($policy$create policy runtime_manage on %1$I.social_communities to %2$I using(auth.jwt()->>'aal'='aal2' and exists(select 1 from %1$I.roles where user_id=auth.uid() and role in ('owner','admin'))) with check(auth.jwt()->>'aal'='aal2' and exists(select 1 from %1$I.roles where user_id=auth.uid() and role in ('owner','admin')))$policy$,ns,runtime_role);
      execute format($sql$
        create function %1$I.social_legacy_cards(target uuid) returns jsonb language plpgsql security definer set search_path='' as $fn$
        declare viewer uuid; owner_profile uuid; prefs %1$I.social_collection_settings; result jsonb;
        begin
          viewer := %1$I.community_actor(auth.uid(),'public_profiles',false);
          select id into owner_profile from %1$I.social_profiles where user_id=target;
          select * into prefs from %1$I.social_collection_settings where profile_id=owner_profile;
          if target<>auth.uid() and not coalesce((%1$I.social_profile_visible(viewer,owner_profile,true) and
            (prefs.visibility='members' or (prefs.visibility='followers' and exists(select 1 from %1$I.social_follows where actor_id=viewer and target_id=owner_profile)))),false) then return '[]'; end if;
          select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'edition_id',e.id,'player_id',p.id,'serial',c.serial,'name',p.name,'position',p.position,'tier',e.tier,'season',e.season,'kind',e.kind,'max_supply',e.max_supply,'team',p.team,'edition_team',p.team,'colour',p.colour,'shirt',p.shirt,'verifiedJerseyNumber',null,'status',p.status,'sport',p.sport,'tradeable',c.tradeable)),'[]') into result
          from %2$I.cards c join %2$I.editions e on e.id=c.edition_id join %2$I.players p on p.id=e.player_id where c.owner_id=target;
          return result;
        end $fn$;
        revoke all on function %1$I.social_legacy_cards(uuid) from public,anon,authenticated,service_role;
        grant execute on function %1$I.social_legacy_cards(uuid) to %3$I;
      $sql$,ns,fs,runtime_role);
      execute format($sql$
        create function %1$I.social_player_exists(target text) returns boolean language plpgsql security definer set search_path='' as $fn$
        begin
          perform %1$I.community_actor(auth.uid(),'community_social',true);
          return exists(select 1 from credits_sandbox.current_player_status where id::text=target) or exists(select 1 from %2$I.players where id::text=target and sport in ('nfl','football'));
        end $fn$;
        revoke all on function %1$I.social_player_exists(text) from public,anon,authenticated,service_role;
        grant execute on function %1$I.social_player_exists(text) to %3$I;
        create function %1$I.social_discussion_reply_notice() returns trigger language plpgsql security definer set search_path='' as $fn$
        begin
          insert into %1$I.social_notifications(recipient_id,actor_id,type,post_id,title,href,group_key,dedupe_key)
          select f.profile_id,new.author_id,'reply',new.post_id,'A player discussion you follow has a reply','/community/posts/'||new.post_id,'discussion:'||new.post_id,'discussion-reply:'||new.id||':'||f.profile_id
          from %1$I.social_discussion_follows f join %1$I.social_notification_preferences prefs on prefs.profile_id=f.profile_id
          where f.post_id=new.post_id and f.profile_id<>new.author_id and prefs.in_app and prefs.social
            and %1$I.social_post_visible(f.profile_id,new.post_id) and %1$I.social_profile_visible(f.profile_id,new.author_id,false)
          on conflict(dedupe_key) do nothing;
          return new;
        end $fn$;
        revoke all on function %1$I.social_discussion_reply_notice() from public,anon,authenticated;
        create trigger social_discussion_reply_notice after insert on %1$I.social_comments for each row execute function %1$I.social_discussion_reply_notice();
      $sql$,ns,fs,runtime_role);


end loop;
end $migration$;

