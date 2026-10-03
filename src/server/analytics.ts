import { authUsersRelation } from "@/core/auth-relations";
import "server-only";
import { db } from "./db";
import type { AnalyticsEvent } from "../core/analytics";
import { acquisitionAccountsQuery } from "./acquisition-query";

// No URL, IP, form value, bookmaker account, stake or loss enters this store.
// Consent and active account are checked again on every write.
export async function recordAnalytics(
  userId: string,
  event: AnalyticsEvent,
  channel?: string,
  once = false,
) {
  try {
    const sql = db();
    await sql`insert into private.analytics_events(user_id,event,cohort,channel)
      select p.id,${event},p.created_at,${channel ?? null} from public.profiles p
      where p.id=${userId} and p.disabled_at is null
      and exists(select 1 from ${sql.unsafe(authUsersRelation())} u where u.id=p.id and coalesce(u.raw_app_meta_data->>'preview_fixture','false')<>'true' and lower(coalesce(u.email,'')) not like '%@example.invalid')
      and (${event}<>'email_verified' or exists(select 1 from ${sql.unsafe(authUsersRelation())} u where u.id=p.id and u.email_confirmed_at is not null and coalesce(u.raw_app_meta_data->>'email_ownership_verified','true')<>'false' and coalesce(u.raw_app_meta_data->>'preview_invitation_confirmed','false')<>'true'))
      and coalesce((select granted from private.consent_events where user_id=p.id and purpose='analytics' order by created_at desc limit 1),false)
      and (not ${once} or not exists(select 1 from private.analytics_events where user_id=p.id and event=${event})) on conflict do nothing`;
  } catch {
    // Analytics must never prevent a consent change, authentication or deletion.
  }
}

export async function acquisitionMetrics() {
  const sql = db();
  const [accounts, events, retention, sources, delivery, engagement] =
    await Promise.all([
      sql.unsafe(acquisitionAccountsQuery),
      sql`select event,count(*) as events,count(distinct user_id) as members from private.analytics_events where created_at>=now()-interval '30 days' group by event order by event`,
      sql`select d.days,
      count(*) filter(where p.created_at<=now()-(d.days+7)*interval '1 day') as eligible_members,
      count(*) filter(where p.created_at<=now()-(d.days+7)*interval '1 day' and exists(
        select 1 from private.analytics_events e where e.user_id=p.id and e.event in ('edge_viewed','tip_saved','methodology_viewed','results_viewed','article_viewed')
        and e.created_at>=p.created_at+d.days*interval '1 day' and e.created_at<p.created_at+(d.days+7)*interval '1 day')) as retained_members
      from (values(7),(30),(90)) d(days) cross join public.profiles p where p.disabled_at is null
      and coalesce((select granted from private.consent_events where user_id=p.id and purpose='analytics' order by created_at desc limit 1),false)
      and coalesce((select granted from private.consent_events where user_id=p.id and purpose='analytics' and created_at<=p.created_at+d.days*interval '1 day' order by created_at desc limit 1),false)
      and not exists(select 1 from private.consent_events where user_id=p.id and purpose='analytics' and not granted and created_at>=p.created_at+d.days*interval '1 day' and created_at<p.created_at+(d.days+7)*interval '1 day') group by d.days order by d.days`,
      sql`select coalesce(channel,'unattributed') as channel,count(distinct user_id) as members from private.analytics_events where event='signup_completed' group by channel`,
      sql`select status,count(*) as attempts from private.delivery_attempts where created_at>=now()-interval '30 days' group by status`,
      sql`select
      (select count(distinct user_id) from private.analytics_events where created_at>=now()-interval '30 days' and event in ('edge_viewed','tip_saved','methodology_viewed','results_viewed','article_viewed')) as active_members_30_days,
      (select count(distinct user_id) from private.consent_events where actor='one-click-unsubscribe' and created_at>=now()-interval '30 days') as unsubscribed_members_30_days,
      (select count(*) from private.audit_events where action='email.complained' and created_at>=now()-interval '30 days') as complaints_received_30_days`,
    ]);
  return {
    accounts: accounts[0],
    events,
    retention,
    sources,
    delivery,
    engagement: engagement[0],
    emailEngagement: null,
    alertEngagement: null,
  };
}
