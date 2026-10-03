-- Phase 3 preparation only. No billing, competition, prize or deal activation.
create table private.membership_plans (
 id text primary key check(id in ('FREE','PRO')), name text not null,
 enabled boolean not null default false, provider text,
 check(id='FREE' or not enabled), check(provider is null)
);
insert into private.membership_plans(id,name,enabled) values('FREE','Docked Free',true),('PRO','Docked Pro',false);
create table private.plan_prices (
 id uuid primary key default gen_random_uuid(), plan_id text not null references private.membership_plans(id),
 currency text check(currency ~ '^[A-Z]{3}$'), amount_minor bigint check(amount_minor>=0),
 cadence text check(cadence in ('month','year')), provider_price_reference text,
 enabled boolean not null default false check(not enabled), created_at timestamptz not null default clock_timestamp()
);
create table private.plan_entitlements (
 plan_id text not null references private.membership_plans(id), feature text not null,
 enabled boolean not null default false, primary key(plan_id,feature),
 check(feature not in ('leaderboard_advantage','verification_override','hide_losses','delayed_safety')),
 check(plan_id='FREE' or not enabled)
);
insert into private.plan_entitlements(plan_id,feature,enabled)
 select 'FREE',feature,true from unnest(array['community','follows','social_posts','community_edges','public_profile','top_docked','core_official_edges','standard_alerts','public_results','methodology','education','basic_tracking','safety_and_corrections']) feature;
create table private.member_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid unique references public.profiles(id) on delete cascade,
 plan_id text not null references private.membership_plans(id) default 'FREE',
 provider text, customer_reference text, subscription_reference text unique,
 state text not null default 'FREE' check(state in ('FREE','INCOMPLETE','TRIAL','ACTIVE','PAST_DUE','GRACE','CANCEL_AT_PERIOD_END','CANCELED','EXPIRED')),
 current_period_end timestamptz, cancel_at_period_end boolean not null default false,
 auto_convert boolean not null default false check(not auto_convert),
 created_at timestamptz not null default clock_timestamp(),
 check(plan_id='FREE' and state in ('FREE','INCOMPLETE','CANCELED','EXPIRED')),
 check(provider is null and customer_reference is null and subscription_reference is null)
);
create table private.subscription_events (
 id uuid primary key default gen_random_uuid(), subscription_id uuid, actor uuid not null,
 event text not null, provider_event_id text unique, reason text not null check(length(reason)>=12),
 created_at timestamptz not null default clock_timestamp()
);
create table private.commercial_approvals (
 id uuid primary key default gen_random_uuid(), feature text not null check(feature in ('paid_analysis','competitions','prizes','deals','sponsorship','marketing','affiliates')),
 country text not null check(country ~ '^[A-Z]{2}$'), state text not null,
 topic text not null check(topic in ('jurisdiction','rules','prize_tax_permit','privacy','marketing','sponsor','responsible_design')),
 approved boolean not null default false, evidence text not null check(length(evidence)>=12),
 valid_from timestamptz not null, valid_to timestamptz not null, review_at timestamptz not null,
 actor uuid not null, created_at timestamptz not null default clock_timestamp(),
 check(valid_to>valid_from and review_at>valid_from)
);
create table private.community_competitions (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null,
 country text not null, state text not null, starts_at timestamptz not null, ends_at timestamptz not null,
 entry_cutoff timestamptz not null, minimum_age integer not null check(minimum_age>=18),
 membership text not null check(membership in ('FREE','FREE_AND_PRO','FUTURE_PRO')),
 mechanics text not null check(mechanics in ('STANDARD_VERIFIED_PERFORMANCE','NON_WAGER_PREDICTION')),
 state_code text not null default 'DRAFT_DISABLED' check(state_code='DRAFT_DISABLED'),
 actor uuid not null, draft_hash text not null check(draft_hash ~ '^[0-9a-f]{64}$'), reason text not null check(length(reason)>=12), created_at timestamptz not null default clock_timestamp(),
 unique(actor,draft_hash),
 check(entry_cutoff<=starts_at and ends_at>starts_at)
);
create table private.competition_rules (
 id uuid primary key default gen_random_uuid(), competition_id uuid not null unique references private.community_competitions(id),
 version text not null, ranking_rule_version text not null, config jsonb not null,
 config_hash text not null check(config_hash ~ '^[0-9a-f]{64}$'),
 minimum_settled integer not null check(minimum_settled>=20), minimum_active_days integer not null check(minimum_active_days>=7),
 entry_limit integer not null check(entry_limit=1), tie_breaker text not null check(tie_breaker='NET_UNITS_ROI_SETTLED_EARLIEST'),
 frozen_at timestamptz not null default clock_timestamp(), actor uuid not null,
 unique(competition_id,version)
);
create table private.competition_prizes (
 id uuid primary key default gen_random_uuid(), competition_id uuid not null references private.community_competitions(id),
 description text not null, value numeric check(value>=0), currency text, sponsor text not null,
 check((value is null)=(currency is null)), check(currency is null or currency ~ '^[A-Z]{3}$')
);
create table private.competition_qualifications (
 id uuid primary key default gen_random_uuid(), competition_id uuid not null references private.community_competitions(id),
 member_id uuid not null, rule_id uuid not null references private.competition_rules(id),
 eligible boolean not null, reason text not null, qualifying_edge_ids uuid[] not null,
 calculated_at timestamptz not null default clock_timestamp(), unique(competition_id,member_id,calculated_at)
);
create table private.competition_rankings (
 id uuid primary key default gen_random_uuid(), competition_id uuid not null references private.community_competitions(id),
 rule_id uuid not null references private.competition_rules(id), leaderboard_snapshot_id uuid,
 rankings jsonb not null, export_hash text not null, calculated_at timestamptz not null default clock_timestamp()
);
create table private.prize_award_events (
 id uuid primary key default gen_random_uuid(), competition_id uuid not null references private.community_competitions(id),
 prize_id uuid not null references private.competition_prizes(id), candidate_member_id uuid not null,
 ranking_id uuid not null references private.competition_rankings(id), previous_id uuid unique references private.prize_award_events(id),
 state text not null check(state in ('CALCULATED','INTEGRITY_REVIEW','ELIGIBILITY_REVIEW','APPROVED','AWARDED','DISQUALIFIED')),
 actor uuid not null, reason text not null check(length(reason)>=12), evidence text not null,
 created_at timestamptz not null default clock_timestamp()
);
create table private.community_deals (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null, sponsor text not null,
 category text not null check(category in ('MERCHANDISE','MEDIA','TICKETS','DOCKED_BENEFIT','NON_GAMBLING','BETTING_REVIEW_REQUIRED')),
 country text not null, state text not null, membership text not null check(membership in ('FREE','FREE_AND_PRO','FUTURE_PRO')),
 starts_at timestamptz not null, ends_at timestamptz not null, terms text not null, disclosure text not null,
 tracking_class text not null check(tracking_class in ('NONE','CONSENTED_AGGREGATE')),
 state_code text not null default 'DRAFT_DISABLED' check(state_code='DRAFT_DISABLED'),
 actor uuid not null, draft_hash text not null check(draft_hash ~ '^[0-9a-f]{64}$'), reason text not null check(length(reason)>=12), created_at timestamptz not null default clock_timestamp(),
 unique(actor,draft_hash),
 check(ends_at>starts_at)
);
create index community_competitions_created on private.community_competitions(created_at desc,id);
create index community_deals_created on private.community_deals(created_at desc,id);
create index commercial_approvals_region on private.commercial_approvals(feature,country,state,valid_from desc);

create function private.commercial_draft_audit() returns trigger language plpgsql set search_path=private,pg_temp as $$
begin
 if not exists(select 1 from private.roles where user_id=new.actor and role in ('owner','admin')) then raise exception 'Administrator required'; end if;
 insert into private.audit_events(actor,action,subject,details) values(new.actor,'commercial_draft.'||tg_table_name,new.id::text,jsonb_build_object('state','DISABLED'));
 return new;
end $$;
create function private.commercial_activation_disabled() returns trigger language plpgsql set search_path=private,pg_temp as $$
begin raise exception 'Competition, prize and deal activation requires a separately reviewed release; disabled in Phase 3'; end $$;

create trigger commercial_draft_audit after insert on private.community_competitions for each row execute function private.commercial_draft_audit();
create trigger commercial_draft_audit after insert on private.community_deals for each row execute function private.commercial_draft_audit();
create trigger commercial_draft_audit after insert on private.commercial_approvals for each row execute function private.commercial_draft_audit();

do $$ declare t text; begin
 foreach t in array array['membership_plans','plan_prices','plan_entitlements','member_subscriptions','subscription_events','commercial_approvals','community_competitions','competition_rules','competition_prizes','competition_qualifications','competition_rankings','prize_award_events','community_deals'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
 end loop;
 foreach t in array array['subscription_events','commercial_approvals','community_competitions','competition_rules','competition_prizes','competition_qualifications','competition_rankings','prize_award_events','community_deals'] loop
 execute format('create trigger immutable before update or delete on private.%I for each row execute function private.immutable()',t);
 end loop;
 foreach t in array array['competition_qualifications','competition_rankings','prize_award_events'] loop
 execute format('create trigger activation_disabled before insert on private.%I for each row execute function private.commercial_activation_disabled()',t);
 end loop;
end $$;
revoke all on function private.commercial_draft_audit() from public,anon,authenticated;
revoke all on function private.commercial_activation_disabled() from public,anon,authenticated;

alter table private.analytics_events drop constraint analytics_events_event_check;
alter table private.analytics_events add constraint analytics_events_event_check check(event in (
 'landing_view','signup_started','signup_completed','email_verified','onboarding_completed','sport_selected','bookmaker_selected',
 'edge_viewed','tip_saved','methodology_viewed','results_viewed','alert_enabled','alert_disabled','digest_enabled','digest_disabled','article_viewed','share_clicked',
 'feed_viewed','post_started','post_created','community_edge_started','community_edge_submitted','community_edge_rejected','community_price_moved','community_promo_excluded',
 'member_followed','member_unfollowed','reaction_added','comment_created','profile_viewed','leaderboard_viewed','member_discovery_viewed',
 'notifications_viewed','notification_opened','pro_viewed','competition_viewed','deal_viewed'
));
