/** Staff-only read, invoked only after requireRole (which enforces current identity + AAL2).
 * No original deleted content is reconstructed. History is bounded per target.
 */
export const moderationReportsQuery = `
select r.id,r.target_type,r.target_id,r.reason,r.details,r.status,r.created_at,
 reporter.display_name reporter_name,reporter.handle reporter_handle,
 case r.target_type when 'post' then nullif(p.body,'') when 'comment' then nullif(c.body,'')
 when 'profile' then profile.bio when 'media' then media.alt end target_content,
 case r.target_type when 'post' then p.moderation_status when 'comment' then c.moderation_status
 when 'profile' then profile.status when 'media' then media.status end target_status,
 coalesce(history.events,'[]'::jsonb) history
from private.social_reports r
left join private.social_profiles reporter on reporter.id=r.reporter_id
left join private.social_posts p on r.target_type='post' and p.id=r.target_id
left join private.social_comments c on r.target_type='comment' and c.id=r.target_id
left join private.social_profiles profile on r.target_type='profile' and profile.id=r.target_id
left join private.social_media media on r.target_type='media' and media.id=r.target_id
left join lateral (
 select jsonb_agg(jsonb_build_object('id',h.id,'decision',h.decision,'reason',h.reason,
 'actor',h.actor,'createdAt',h.created_at) order by h.created_at desc,h.id desc) events
 from (select e.id,e.decision,e.reason,e.created_at,
 coalesce(actor.display_name,'Staff member') actor
 from private.social_moderation_events e
 left join private.social_profiles actor on actor.user_id=e.actor
 where e.target_type=r.target_type and e.target_id=r.target_id
 order by e.created_at desc,e.id desc limit 20) h
) history on true
/* dashboard-queue-filter */
order by case when r.status='escalated' then 0 when r.status='open' then 1 else 2 end,r.created_at desc,r.id desc
limit 100`;

/** Closed permitlist: dashboard categories are filtered before the bounded queue limit. */
export function moderationQueueReportsQuery(kind?: "content" | "members") {
  const filter =
    kind === "content"
      ? "where r.target_type in ('post','comment','media') and r.status in ('open','escalated')"
      : kind === "members"
        ? "where r.target_type='profile' and r.status in ('open','escalated')"
        : "";
  return moderationReportsQuery.replace("/* dashboard-queue-filter */", filter);
}
