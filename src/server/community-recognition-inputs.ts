import "server-only";
import type postgres from "postgres";
import {
  completedRecognitionWeek,
  type RecognitionCandidate,
  type RecognitionEdge,
} from "@/core/community-recognition";
import { communityMarketLabel } from "@/core/community-edge";

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
type Tx = postgres.TransactionSql;
/** Private bounded inputs; private accounts never become discovery candidates. */
export async function recognitionInputs(
  tx: Tx,
  viewer: string | null,
  asOf: string,
) {
  const week = completedRecognitionWeek(asOf);
  const rows = await tx`select e.*,p.handle,p.display_name,p.joined_at,
    ev.participants,coalesce(s.result,'PENDING') result,s.created_at settled_at,s.id settlement_id,
    coalesce(h.result,'PENDING') week_result,h.id week_settlement_id,
    (${viewer}::uuid is null or (private.social_profile_visible(${viewer}::uuid,p.id,false)
      and not exists(select 1 from private.social_mutes where actor_id=${viewer}::uuid and target_id=p.id))) viewer_visible,
    post.id post_id from private.community_edges e
    join private.social_profiles p on p.id=e.profile_id join public.profiles member on member.id=p.user_id
    join auth.users u on u.id=p.user_id join private.events ev on ev.id=e.event_id
    join private.market_references reference on reference.id=e.market_reference_id
    join private.social_posts post on post.community_edge_id=e.id
    left join lateral(select id,result,created_at from private.community_settlements where edge_id=e.id and created_at<=${asOf}::timestamptz order by created_at desc,id desc limit 1)s on true
    left join lateral(select id,result from private.community_settlements where edge_id=e.id and created_at<${week.end}::timestamptz order by created_at desc,id desc limit 1)h on true
    where e.pricing_model='market_reference_v1' and e.classification='STANDARD_VERIFIED'
    and reference.reference->>'evidenceMode'='current'
    and cardinality(reference.snapshot_ids)>0 and cardinality(reference.snapshot_ids)=(select count(*) from private.odds_snapshots q where q.id=any(reference.snapshot_ids) and q.evidence::text in ('market_data','forward_paper','live_published'))
    and not p.is_official and p.status='active' and p.visibility='members' and member.disabled_at is null
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and u.email not like '%@example.invalid'
    and (u.banned_until is null or u.banned_until<=${asOf}::timestamptz)
    and private.community_feature_allowed(p.user_id,'community_edges')
    and post.kind='edge' and post.claim_label='social_only' and post.moderation_status='visible' and post.deleted_at is null
    and not exists(select 1 from private.community_edge_personal_notes n where n.edge_id=e.id and n.metadata->>'promotional'='true')
    and coalesce((select status from private.community_edge_status where edge_id=e.id and status in ('INTEGRITY_REVIEW','INTEGRITY_CLEARED') order by created_at desc,id desc limit 1),'INTEGRITY_CLEARED')='INTEGRITY_CLEARED'
    and not exists(select 1 from private.social_reports r where r.status in ('open','escalated') and ((r.target_type='post' and r.target_id=post.id) or (r.target_type='profile' and r.target_id=p.id)))
    and e.submitted_at<${asOf}::timestamptz and ((s.id is null and e.start_at>${asOf}::timestamptz and e.start_at<${asOf}::timestamptz+interval '7 days')
      or (h.result='WON' and exists(select 1 from private.community_settlements w where w.id=h.id and w.created_at>=${week.start}::timestamptz)))
    order by e.id limit 1001`;
  if (rows.length > 1000)
    throw Error("Recognition candidate review capacity exceeded");
  if (!rows.length) return [];
  const postIds = rows.map((r) => String(r.post_id)),
    authors = [...new Set(rows.map((r) => String(r.profile_id)))];
  const engagement = await tx`with activity as (
    select post_id,profile_id actor_id,'reaction' kind,created_at from private.social_reactions where post_id=any(${postIds})
    union all select post_id,author_id,'comment',created_at from private.social_comments where post_id=any(${postIds}) and moderation_status='visible' and deleted_at is null and length(btrim(body))>=20
      and not exists(select 1 from private.social_reports where target_type='comment' and target_id=private.social_comments.id and status in ('open','escalated')))
    select a.*,p.joined_at,(${viewer}::uuid is null or (private.social_profile_visible(${viewer}::uuid,p.id,false)
      and not exists(select 1 from private.social_mutes where actor_id=${viewer}::uuid and target_id=p.id))) viewer_visible
    from activity a join private.social_profiles p on p.id=a.actor_id
    join private.social_posts post on post.id=a.post_id join public.profiles member on member.id=p.user_id join auth.users u on u.id=p.user_id
    where a.created_at<${asOf}::timestamptz and p.status='active' and p.visibility='members' and not p.is_official
    and member.disabled_at is null and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and u.email not like '%@example.invalid'
    and (u.banned_until is null or u.banned_until<=${asOf}::timestamptz)
    and private.community_feature_allowed(p.user_id,'community_edges')
    and not exists(select 1 from private.social_blocks b where (b.actor_id=p.id and b.target_id=post.author_id) or (b.target_id=p.id and b.actor_id=post.author_id))
    and not exists(select 1 from private.social_reports r where r.target_type='profile' and r.target_id=p.id and r.status in ('open','escalated'))
    order by a.created_at,a.actor_id limit 50001`;
  if (engagement.length > 50000)
    throw Error("Recognition engagement review capacity exceeded");
  const samples =
    await tx`select e.profile_id,count(*) settled,count(distinct (e.submitted_at at time zone 'UTC')::date) active_days
    from private.community_edges e join private.market_references r on r.id=e.market_reference_id
    join lateral(select result from private.community_settlements where edge_id=e.id and created_at<${week.end}::timestamptz order by created_at desc,id desc limit 1)s on true
    where e.profile_id=any(${authors}) and e.pricing_model='market_reference_v1' and e.classification='STANDARD_VERIFIED' and r.reference->>'evidenceMode'='current'
    and cardinality(r.snapshot_ids)>0 and cardinality(r.snapshot_ids)=(select count(*) from private.odds_snapshots q where q.id=any(r.snapshot_ids) and q.evidence::text in ('market_data','forward_paper','live_published'))
    and e.submitted_at<e.start_at and e.start_at<${week.end}::timestamptz and s.result in ('WON','LOST')
    and not exists(select 1 from private.community_edge_personal_notes n where n.edge_id=e.id and n.metadata->>'promotional'='true')
    and coalesce((select status from private.community_edge_status where edge_id=e.id and status in ('INTEGRITY_REVIEW','INTEGRITY_CLEARED') order by created_at desc,id desc limit 1),'INTEGRITY_CLEARED')='INTEGRITY_CLEARED'
    group by e.profile_id`;
  const samplesByAuthor = new Map(
    samples.map((s) => [String(s.profile_id), s]),
  );
  const engagementByPost = new Map<
    string,
    RecognitionCandidate["engagements"]
  >();
  for (const e of engagement) {
    const key = String(e.post_id),
      items = engagementByPost.get(key) ?? [];
    items.push({
      actorId: String(e.actor_id),
      kind: e.kind as "reaction" | "comment",
      createdAt: iso(e.created_at),
      joinedAt: iso(e.joined_at),
      eligible: true,
      viewerVisible: e.viewer_visible === true,
    });
    engagementByPost.set(key, items);
  }
  return rows.map((r) => {
    const sample = samplesByAuthor.get(String(r.profile_id));
    return {
      edge: {
        id: String(r.id),
        profileId: String(r.profile_id),
        handle: String(r.handle),
        displayName: String(r.display_name),
        event: (r.participants as string[]).join(" v "),
        sport: String(r.sport),
        competition: String(r.competition),
        market: communityMarketLabel(r.market_rules),
        selection: String(r.selection),
        submittedAt: iso(r.submitted_at),
        startAt: iso(r.start_at),
        odds: String(r.odds),
        result: r.result as RecognitionEdge["result"],
        settledAt: r.settled_at ? iso(r.settled_at) : null,
      },
      authorJoinedAt: iso(r.joined_at),
      eligible: true,
      verifiedStandardReference: true,
      evidenceMode: "current" as const,
      promotional: false,
      // A later result revision withdraws an award pending a new reviewed snapshot.
      integrityClear:
        !r.week_settlement_id || r.week_settlement_id === r.settlement_id,
      viewerVisible: r.viewer_visible === true,
      settledSample: Number(sample?.settled ?? 0),
      activeDays: Number(sample?.active_days ?? 0),
      engagements: engagementByPost.get(String(r.post_id)) ?? [],
    } satisfies RecognitionCandidate;
  });
}
