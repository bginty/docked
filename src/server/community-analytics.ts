import "server-only";
import { requireRole } from "./auth";
import { db } from "./db";
import { dataHealth } from "./data-health";
export async function communityNotificationOperations() {
  await requireRole(["owner", "admin", "auditor"]);
  const sql = db();
  const [jobs, delivery, incidents] = await Promise.all([
    sql`select 'social' kind,count(*) filter(where completed_at is null) queued,count(*) filter(where completed_at is not null) completed,min(created_at) filter(where completed_at is null) oldest_queued from private.social_notification_jobs
      union all select 'leaderboard',count(*) filter(where completed_at is null),count(*) filter(where completed_at is not null),min(created_at) filter(where completed_at is null) from private.leaderboard_notification_jobs`,
    sql`select type,count(*) delivered,count(*) filter(where read_at is not null) marked_read from private.social_notifications where created_at>=now()-interval '30 days' group by type order by type`,
    sql`select created_at,action from private.audit_events where action='community_notification_failure' order by created_at desc limit 20`,
  ]);
  return {
    jobs,
    delivery,
    incidents,
    email: "DISABLED",
    push: "DISABLED",
    policy:
      "In-app only. Per worker pass: at most 100 social recipients and 50 leaderboard recipients. Optional notifications are dropped during quiet hours or when capped, paused or ineligible. Stored inbox items expire after 90 days; counts are retained operational observations, not external delivery or clicks.",
  };
}
export async function communityAnalytics() {
  await requireRole(["owner", "admin", "auditor"]);
  const sql = db();
  const [
    active,
    actions,
    retention,
    moderation,
    notifications,
    verification,
    providerHealth,
  ] = await Promise.all([
    sql`select count(distinct user_id) filter(where created_at>=now()-interval '1 day') dau,
      count(distinct user_id) filter(where created_at>=now()-interval '7 days') wau,
      count(distinct user_id) mau
      from private.analytics_events where created_at>=now()-interval '30 days'
      and event in ('feed_viewed','post_created','community_edge_submitted','comment_created','reaction_added','profile_viewed','leaderboard_viewed')`,
    sql`select event,count(*) events,count(distinct user_id) members from private.analytics_events
      where created_at>=now()-interval '30 days' and event in ('post_created','community_edge_submitted','community_edge_rejected','community_price_moved','community_promo_excluded','member_followed','member_unfollowed','comment_created','reaction_added','leaderboard_viewed','notifications_viewed','notification_opened')
      group by event order by event`,
    sql`select d.days,
      count(*) filter(where p.created_at<=now()-(d.days+7)*interval '1 day') eligible_members,
      count(*) filter(where p.created_at<=now()-(d.days+7)*interval '1 day' and exists(
        select 1 from private.analytics_events e where e.user_id=p.id
        and e.event in ('feed_viewed','post_created','community_edge_submitted','comment_created','reaction_added','profile_viewed','leaderboard_viewed')
        and e.created_at>=p.created_at+d.days*interval '1 day' and e.created_at<p.created_at+(d.days+7)*interval '1 day')) retained_members
      from (values(7),(30),(90)) d(days) cross join public.profiles p where p.disabled_at is null
      and coalesce((select granted from private.consent_events where user_id=p.id and purpose='analytics' order by created_at desc limit 1),false)
      and coalesce((select granted from private.consent_events where user_id=p.id and purpose='analytics' and created_at<=p.created_at+d.days*interval '1 day' order by created_at desc limit 1),false)
      and not exists(select 1 from private.consent_events where user_id=p.id and purpose='analytics' and not granted and created_at>=p.created_at+d.days*interval '1 day' and created_at<p.created_at+(d.days+7)*interval '1 day')
      group by d.days order by d.days`,
    sql`select status,count(*) reports from private.social_reports group by status order by status`,
    sql`select type,count(*) delivered,count(*) filter(where read_at is not null) marked_read
      from private.social_notifications where created_at>=now()-interval '30 days' group by type order by type`,
    sql`select classification,count(*) observations from private.community_quote_evidence where created_at>=now()-interval '30 days' group by classification order by classification`,
    dataHealth(),
  ]);
  return {
    status: "OBSERVED",
    active: active[0],
    actions,
    retention,
    retentionDefinition:
      "A consenting retained member has a measured community interaction in the completed seven-day window beginning on day 7, 30 or 90 after signup. Consent must cover that complete window. No eligible cohort means no retention rate.",
    operational: { moderation, notifications, verification },
    operationalScope:
      "Retained operational records, independent of optional behavioural analytics. Marked-read notifications do not establish a click or external delivery. Classification observations are not member submission attempts.",
    providerHealth,
    scope:
      "Consenting active-account analytics only. These are not all-member counts; deleted-account events are erased. No stake or loss-targeting data is collected.",
    windows: "Rolling UTC 24 hours / 7 days / 30 days at query time.",
    emailEngagement: null,
    pushEngagement: null,
  };
}
