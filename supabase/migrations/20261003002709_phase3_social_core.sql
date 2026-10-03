-- Phase 3 social features. Local/isolated preview only; no hosted activation.
create table private.social_profiles (
 id uuid primary key default gen_random_uuid(), user_id uuid unique references public.profiles(id) on delete set null,
 handle text not null unique check(handle ~ '^[a-z][a-z0-9_]{2,39}$'), display_name text not null check(length(display_name) between 1 and 60),
 bio text not null default '' check(length(bio)<=280), avatar_media_id uuid,
 is_official boolean not null default false, visibility text not null default 'members' check(visibility in ('members','private')),
 status text not null default 'active' check(status in ('active','restricted','suspended','deleted')),
 joined_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 check(is_official=(id='00000000-0000-4000-8000-000000000001'::uuid)),
 check((is_official and handle='docked' and display_name='Docked' and user_id is null and status='active') or (not is_official and handle<>'docked')),
 check(user_id is not null or is_official or status='deleted')
);
insert into private.social_profiles(id,handle,display_name,bio,is_official) values
 ('00000000-0000-4000-8000-000000000001','docked','Docked','Official Docked research, education and canonical Edge records.',true);
create table private.social_handle_history(handle text primary key,profile_id uuid not null references private.social_profiles(id),created_at timestamptz not null default clock_timestamp());
create table private.social_follows(actor_id uuid not null references private.social_profiles(id),target_id uuid not null references private.social_profiles(id),notifications boolean not null default false,created_at timestamptz not null default clock_timestamp(),primary key(actor_id,target_id),check(actor_id<>target_id));
create index on private.social_follows(target_id,created_at desc);
create table private.social_blocks(actor_id uuid not null references private.social_profiles(id),target_id uuid not null references private.social_profiles(id),created_at timestamptz not null default clock_timestamp(),primary key(actor_id,target_id),check(actor_id<>target_id));
create index on private.social_blocks(target_id,actor_id);
create table private.social_mutes(actor_id uuid not null references private.social_profiles(id),target_id uuid not null references private.social_profiles(id),created_at timestamptz not null default clock_timestamp(),primary key(actor_id,target_id),check(actor_id<>target_id));
create table private.social_posts (
 id uuid primary key default gen_random_uuid(),author_id uuid not null references private.social_profiles(id),
 kind text not null check(kind in ('discussion','analysis','question','celebration','edge','official')),body text not null check(length(body)<=4000),sport text,
 official_tip_id uuid unique references private.tip_publications(id),community_edge_id uuid unique,
 claim_label text not null default 'social_only' check(claim_label in ('social_only','promotional_price')),
 moderation_status text not null default 'visible' check(moderation_status in ('visible','removed','review')),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),deleted_at timestamptz,
 idempotency_key uuid,unique(author_id,idempotency_key),
 check(not(official_tip_id is not null and community_edge_id is not null)),
 check((kind='edge' and (official_tip_id is not null or community_edge_id is not null)) or (kind<>'edge' and official_tip_id is null and community_edge_id is null)),
 check((kind<>'official' and official_tip_id is null) or author_id='00000000-0000-4000-8000-000000000001')
);
create index on private.social_posts(created_at desc,id desc);
create index on private.social_posts(author_id,created_at desc,id desc);
create index on private.social_posts(sport,created_at desc);
create table private.social_media (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references private.social_profiles(id),
 content bytea,sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),mime text not null check(mime='image/webp'),
 width integer not null check(width between 1 and 4096),height integer not null check(height between 1 and 4096),
 alt text not null check(length(alt) between 1 and 240),status text not null default 'quarantine' check(status in ('quarantine','approved','rejected')),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default (clock_timestamp()+interval '7 days'),
 reviewed_by uuid,reviewed_at timestamptz,check(octet_length(content)<=5242880),unique(owner_id,sha256)
);
alter table private.social_profiles add foreign key(avatar_media_id) references private.social_media(id);
create table private.social_post_media(post_id uuid not null references private.social_posts(id),media_id uuid not null references private.social_media(id),position smallint not null check(position between 0 and 3),primary key(post_id,media_id),unique(post_id,position));
create table private.social_comments (
 id uuid primary key default gen_random_uuid(),post_id uuid not null references private.social_posts(id),author_id uuid not null references private.social_profiles(id),
 parent_id uuid references private.social_comments(id),depth smallint not null default 0 check(depth between 0 and 2),body text not null check(length(body)<=1000),
 moderation_status text not null default 'visible' check(moderation_status in ('visible','removed','review')),
 created_at timestamptz not null default clock_timestamp(),deleted_at timestamptz,idempotency_key uuid not null,unique(author_id,idempotency_key)
);
create index on private.social_comments(post_id,created_at,id);
create table private.social_reactions(profile_id uuid not null references private.social_profiles(id),post_id uuid not null references private.social_posts(id),created_at timestamptz not null default clock_timestamp(),primary key(profile_id,post_id));
create table private.social_saved(profile_id uuid not null references private.social_profiles(id),post_id uuid not null references private.social_posts(id),created_at timestamptz not null default clock_timestamp(),primary key(profile_id,post_id));
create table private.social_reports (
 id uuid primary key default gen_random_uuid(),reporter_id uuid references private.social_profiles(id),target_type text not null check(target_type in ('post','comment','profile','media')),target_id uuid not null,
 reason text not null check(reason in ('spam','harassment','impersonation','privacy','scam','affiliate_spam','misleading_odds','other')),details text not null default '' check(length(details)<=1000),
 status text not null default 'open' check(status in ('open','dismissed','actioned','escalated')),created_at timestamptz not null default clock_timestamp(),closed_at timestamptz,
 unique(reporter_id,target_type,target_id)
);
create index on private.social_reports(status,created_at);
create table private.social_moderation_events(id uuid primary key default gen_random_uuid(),actor uuid not null,report_id uuid references private.social_reports(id),target_type text not null,target_id uuid not null,decision text not null,reason text not null check(length(reason)>=12),created_at timestamptz not null default clock_timestamp());
create trigger immutable before update or delete on private.social_moderation_events for each row execute function private.immutable();
create table private.social_notification_preferences (
 profile_id uuid primary key references private.social_profiles(id),official_edges boolean not null default false,followed_members boolean not null default false,social boolean not null default true,
 leaderboard boolean not null default false,competitions boolean not null default false,deals_marketing boolean not null default false,
 in_app boolean not null default true,email boolean not null default false check(not email),push boolean not null default false check(not push),updated_at timestamptz not null default clock_timestamp()
);
create table private.social_notifications (
 id uuid primary key default gen_random_uuid(),recipient_id uuid not null references private.social_profiles(id),actor_id uuid references private.social_profiles(id),
 type text not null check(type in ('official_edge','edge_status','followed_post','followed_edge','comment','reply','reaction','follower','leaderboard','competition','prize','deal','account','system')),
 post_id uuid references private.social_posts(id),title text not null check(length(title)<=180),href text not null check(href ~ '^/(home|community|profile|notifications|edges|top-docked|membership|competitions|deals)(/|\?|$)'),
 group_key text not null,dedupe_key text not null unique,created_at timestamptz not null default clock_timestamp(),read_at timestamptz,
 expires_at timestamptz not null default (clock_timestamp()+interval '90 days')
);
create index on private.social_notifications(recipient_id,created_at desc,id desc);
create table private.social_notification_jobs (
 id uuid primary key default gen_random_uuid(),dedupe_key text not null unique,
 post_id uuid not null references private.social_posts(id),kind text not null default 'publication' check(kind in ('publication','status')),cursor_profile_id uuid,
 created_at timestamptz not null default clock_timestamp(),completed_at timestamptz
);
create index on private.social_notification_jobs(created_at) where completed_at is null;
create function private.social_queue_notification() returns trigger language plpgsql set search_path='' as $$
begin
 insert into private.social_notification_jobs(post_id,dedupe_key) values(new.id,'post:'||new.id) on conflict do nothing;
 return new;
end $$;
create trigger social_queue_notification after insert on private.social_posts for each row execute function private.social_queue_notification();
create function private.social_queue_official_status() returns trigger language plpgsql set search_path='' as $$
begin
 insert into private.social_notification_jobs(post_id,kind,dedupe_key)
 select id,'status',tg_table_name||':'||new.id from private.social_posts where official_tip_id=new.tip_id
 on conflict do nothing;
 return new;
end $$;
create trigger social_queue_status after insert on private.tip_status_events for each row execute function private.social_queue_official_status();
create trigger social_queue_settlement after insert on private.settlement_events for each row execute function private.social_queue_official_status();

create function private.community_assert_access(p_actor uuid,p_feature text) returns void language plpgsql set search_path='' as $$
declare member public.profiles; policy private.region_policies;
begin
 if p_actor is distinct from auth.uid() or not private.active_member_session() then raise exception 'Active authenticated session required'; end if;
 select * into member from public.profiles where id=p_actor for share;
 if not found or member.disabled_at is not null or not member.age_attested or member.accepted_version='' then raise exception 'Account ineligible'; end if;
 select * into policy from private.region_policies where country=member.country and state=member.state and effective_from<=clock_timestamp() and effective_to>clock_timestamp() order by effective_from desc,id desc limit 1 for share;
 if not found or not policy.approved or policy.minimum_age>18 or policy.review_at<=clock_timestamp() or length(trim(policy.evidence))=0 or not(p_feature=any(policy.features)) then raise exception 'Community feature restricted'; end if;
end $$;
create function private.community_actor(p_actor uuid,p_feature text,p_require_posting boolean default true) returns uuid language plpgsql set search_path='' as $$
declare profile private.social_profiles;
begin
 perform private.community_assert_access(p_actor,p_feature);
 select * into profile from private.social_profiles where user_id=p_actor for update;
 if not found then raise exception 'Create a social profile first'; end if;
 if profile.status in ('suspended','deleted') or (p_require_posting and profile.status<>'active') then raise exception 'Social account restricted'; end if;
 return profile.id;
end $$;
create function private.social_profile_visible(p_viewer uuid,p_target uuid,p_include_deleted boolean default false) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from private.social_profiles target where target.id=p_target
 and (target.is_official or target.id=p_viewer or (target.visibility='members' and (target.status in ('active','restricted') or p_include_deleted)))
 and not exists(select 1 from private.social_blocks b where (b.actor_id=p_viewer and b.target_id=p_target) or (b.actor_id=p_target and b.target_id=p_viewer)))
$$;
create function private.community_feature_allowed(p_actor uuid,p_feature text) returns boolean language sql stable set search_path='' as $$
 select coalesce((select policy.approved and policy.minimum_age=18 and policy.review_at>now() and length(trim(policy.evidence))>0 and p_feature=any(policy.features)
 from public.profiles member join lateral (select * from private.region_policies r where r.country=member.country and r.state=member.state and r.effective_from<=now() and r.effective_to>now() order by r.effective_from desc,r.id desc limit 1) policy on true
 where member.id=p_actor and member.disabled_at is null and member.age_attested and member.accepted_version<>''),false)
$$;
create function private.community_post_allowed(p_actor uuid,p_post uuid) returns boolean language sql stable set search_path='' as $$
 select private.community_feature_allowed(p_actor,'community_social') and exists(select 1 from private.social_posts p where p.id=p_post
 and (p.community_edge_id is null or private.community_feature_allowed(p_actor,'community_edges'))
 and (p.official_tip_id is null or (private.community_feature_allowed(p_actor,'tips') and exists(
 select 1 from private.tip_publications tip join public.profiles member on member.id=p_actor
 join lateral (select * from private.region_policies rp where rp.country=member.country and rp.state=member.state and rp.effective_from<=now() and rp.effective_to>now() order by rp.effective_from desc,rp.id desc limit 1) policy on true
 where tip.id=p.official_tip_id and tip.evidence='live_published' and tip.published_at<=now() and private.publication_region_matches(tip.region_policy_id,policy.id)))))
$$;
create function private.social_post_visible(p_viewer uuid,p_post uuid) returns boolean language sql stable set search_path='' as $$
 select private.community_post_allowed(auth.uid(),p_post) and exists(select 1 from private.social_posts p where p.id=p_post and private.social_profile_visible(p_viewer,p.author_id,false) and (p.moderation_status='visible' or p.kind='edge') and (p.deleted_at is null or p.kind='edge'))
$$;
create function private.social_official_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Durable social identity cannot be deleted'; end if;
 if old.is_official and new is distinct from old then raise exception 'Official Docked identity is immutable'; end if;
 if new.id<>old.id or new.is_official<>old.is_official or (new.user_id is distinct from old.user_id and not(new.user_id is null and new.status='deleted')) then raise exception 'Social identity ownership is immutable'; end if;
 return new;
end $$;
create trigger social_official_guard before update or delete on private.social_profiles for each row execute function private.social_official_guard();
create function private.social_identity_guard() returns trigger language plpgsql set search_path='' as $$
declare normalized text; historical uuid;
begin
 if new.is_official then return new; end if;
 normalized=regexp_replace(translate(lower(normalize(new.handle||' '||new.display_name,NFKD)),'013457оОοΟсСеЕ','oieastooooccee'),'[^a-z]','','g');
 if normalized like '%docked%' or normalized ~ '(official|administrator|moderator|support|admin)' or new.display_name ~ '[✓✔☑✅]'
 or (new.display_name ~ '[a-zA-Z]' and new.display_name ~ '[а-яА-Яα-ωΑ-Ω]') then raise exception 'Protected identity'; end if;
 if tg_op='INSERT' or new.handle is distinct from old.handle then
  select profile_id into historical from private.social_handle_history where handle=new.handle;
  if historical is not null and historical<>new.id then raise exception 'Handle is reserved'; end if;
  insert into private.social_handle_history(handle,profile_id) values(new.handle,new.id) on conflict do nothing;
  if tg_op='UPDATE' then insert into private.audit_events(actor,action,subject,details) values(coalesce(new.user_id::text,'account-service'),'social_handle_changed',new.id::text,jsonb_build_object('changed',true)); end if;
 end if;
 return new;
end $$;
-- AFTER ensures the FK to a newly inserted durable profile exists.
create trigger social_identity_guard after insert or update on private.social_profiles for each row execute function private.social_identity_guard();
create function private.social_post_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Use social tombstone; underlying Edge survives'; end if;
 if new.id<>old.id or new.author_id<>old.author_id or new.kind<>old.kind or new.created_at<>old.created_at
 or new.official_tip_id is distinct from old.official_tip_id or new.community_edge_id is distinct from old.community_edge_id or new.idempotency_key is distinct from old.idempotency_key
 then raise exception 'Social identity and ledger linkage immutable'; end if;
 return new;
end $$;
create trigger social_post_guard before update or delete on private.social_posts for each row execute function private.social_post_guard();
create function private.social_comment_guard() returns trigger language plpgsql set search_path='' as $$
declare parent private.social_comments;
begin
 if new.parent_id is not null then
  select * into parent from private.social_comments where id=new.parent_id;
  if not found or parent.post_id<>new.post_id or parent.depth>=2 then raise exception 'Invalid reply parent or maximum depth'; end if;
  new.depth=parent.depth+1;
 else new.depth=0; end if;
 return new;
end $$;
create trigger social_comment_guard before insert on private.social_comments for each row execute function private.social_comment_guard();
create function private.social_media_link_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from private.social_media m join private.social_posts p on p.author_id=m.owner_id where p.id=new.post_id and m.id=new.media_id and m.status='approved' and m.content is not null) then raise exception 'Only owned approved media can be attached'; end if;
 return new;
end $$;
create trigger social_media_link_guard before insert or update on private.social_post_media for each row execute function private.social_media_link_guard();
create function private.social_official_edge_projection() returns trigger language plpgsql set search_path='' as $$
begin
 if new.evidence='live_published' then
  insert into private.social_posts(author_id,kind,body,sport,official_tip_id,created_at)
  select '00000000-0000-4000-8000-000000000001','edge','',c.sport_id,new.id,new.published_at from private.events e join private.competitions c on c.id=e.competition_id where e.id=new.event_id
  on conflict(official_tip_id) do nothing;
 end if;
 return new;
end $$;
create trigger social_official_edge_projection after insert on private.tip_publications for each row execute function private.social_official_edge_projection();
-- Only existing canonical live publications are projected; no synthetic tips or results.
insert into private.social_posts(author_id,kind,body,sport,official_tip_id,created_at)
 select '00000000-0000-4000-8000-000000000001','edge','',c.sport_id,t.id,t.published_at from private.tip_publications t join private.events e on e.id=t.event_id join private.competitions c on c.id=e.competition_id where t.evidence='live_published' on conflict(official_tip_id) do nothing;
create function private.social_account_erasure() returns trigger language plpgsql set search_path='' as $$
declare v_profile uuid;
begin
 if tg_op='UPDATE' and (new.disabled_at is null or old.disabled_at is not null) then return new; end if;
 select id into v_profile from private.social_profiles where user_id=old.id;
 if v_profile is not null then
  update private.social_posts set body='',moderation_status='removed',deleted_at=coalesce(deleted_at,clock_timestamp()),updated_at=clock_timestamp() where author_id=v_profile;
  update private.social_comments set body='',moderation_status='removed',deleted_at=coalesce(deleted_at,clock_timestamp()) where author_id=v_profile;
  delete from private.social_post_media where media_id in(select id from private.social_media where owner_id=v_profile);
  update private.social_media set content=null,alt='Removed',status='rejected' where owner_id=v_profile;
  delete from private.social_reactions where social_reactions.profile_id=v_profile;
  delete from private.social_saved where social_saved.profile_id=v_profile;
  delete from private.social_follows where actor_id=v_profile or target_id=v_profile;
  delete from private.social_blocks where actor_id=v_profile or target_id=v_profile;
  delete from private.social_mutes where actor_id=v_profile or target_id=v_profile;
  delete from private.social_notifications where recipient_id=v_profile or actor_id=v_profile;
  delete from private.social_notification_preferences where social_notification_preferences.profile_id=v_profile;
  update private.social_reports set reporter_id=null,details='' where reporter_id=v_profile;
  delete from private.social_handle_history where social_handle_history.profile_id=v_profile;
  update private.social_profiles set user_id=null,handle='deleted_'||replace(id::text,'-',''),display_name='Deleted member',bio='',avatar_media_id=null,status='deleted',visibility='members',updated_at=clock_timestamp() where id=v_profile;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger social_account_erasure before delete or update of disabled_at on public.profiles for each row execute function private.social_account_erasure();

do $$ declare t text; begin foreach t in array array['social_profiles','social_handle_history','social_follows','social_blocks','social_mutes','social_posts','social_media','social_post_media','social_comments','social_reactions','social_saved','social_reports','social_moderation_events','social_notification_preferences','social_notifications','social_notification_jobs'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
end loop; end $$;
revoke all on function private.community_assert_access(uuid,text),private.community_actor(uuid,text,boolean),private.social_profile_visible(uuid,uuid,boolean),private.social_post_visible(uuid,uuid),private.social_official_guard(),private.social_identity_guard(),private.social_post_guard(),private.social_comment_guard(),private.social_media_link_guard(),private.social_account_erasure() from public,anon,authenticated;
revoke all on function private.community_feature_allowed(uuid,text),private.social_official_edge_projection() from public,anon,authenticated;
revoke all on function private.community_post_allowed(uuid,uuid),private.social_queue_notification(),private.social_queue_official_status() from public,anon,authenticated;
