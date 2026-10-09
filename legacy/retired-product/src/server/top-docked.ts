import "server-only";
import type postgres from "postgres";
import { db } from "./db";
import { config } from "./config";
import { requireRole } from "./auth";
import { communityAccess } from "./community-policy";
import {
  withCommunityActor,
  setCommunityClaims,
  enqueueCommunityNotification,
} from "./community-social";
import { hash } from "@/core/pricing";
import {
  calculateTopDocked,
  qualifiedPerformanceBadges,
  leaderboardMilestone,
  sameRankingScope,
  rankingWindow,
  type RankingScope,
  topDockedRuleV1,
  type PerformanceBadge,
  type CanonicalCommunityRecord,
  type RankingPeriod,
  type TopDockedRow,
} from "@/core/top-docked";

type Sql = postgres.Sql | postgres.TransactionSql;
const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : String(value);
/** One canonical query keeps all outcomes, independent of commentary, popularity and paid status. */
async function canonicalRecords(
  sql: Sql,
  asOf: string,
  profileIds?: string[],
): Promise<CanonicalCommunityRecord[]> {
  const rows =
    await sql`select e.*,p.is_official,s.id settlement_id,s.result,s.created_at settled_at,
    (select status from private.community_edge_status where edge_id=e.id and status in ('INTEGRITY_REVIEW','INTEGRITY_CLEARED') and created_at<=${asOf} order by created_at desc,id desc limit 1) integrity
    from private.community_edges e join private.social_profiles p on p.id=e.profile_id
    left join lateral(select id,result,created_at from private.community_settlements where edge_id=e.id and created_at<=${asOf} order by created_at desc,id desc limit 1)s on true
    where e.submitted_at<=${asOf} and (${profileIds === undefined} or e.profile_id=any(${profileIds ?? []}::uuid[])) order by e.id`;
  return rows.map((r) => ({
    id: r.id as string,
    profileId: r.profile_id as string,
    submittedAt: iso(r.submitted_at),
    startAt: iso(r.start_at),
    sport: r.sport as string,
    odds: String(r.odds),
    units: String(r.standard_units),
    classification:
      r.classification as CanonicalCommunityRecord["classification"],
    ruleVersion: r.verification_rule as string,
    verified: r.classification === "STANDARD_VERIFIED",
    demo: false,
    official: !!r.is_official,
    integrityClear:
      r.integrity !== "INTEGRITY_REVIEW" &&
      !["DISPUTED", "MANUAL_REVIEW"].includes(r.result),
    result: (r.result ?? "PENDING") as CanonicalCommunityRecord["result"],
    settledAt: r.settled_at ? iso(r.settled_at) : null,
    settlementId: (r.settlement_id ?? null) as string | null,
  }));
}
export type PublicTopDockedRow = TopDockedRow & {
  handle: string;
  displayName: string;
  interactionsAllowed: boolean;
  badges: PerformanceBadge[];
  followers?: number | null;
};
export type TopDockedBoard = {
  status: "NOT_CONFIGURED" | "RESTRICTED" | "EMPTY" | "READY";
  message: string;
  rule: typeof topDockedRuleV1;
  period: RankingPeriod;
  asOf: string;
  sport: string | null;
  rows: PublicTopDockedRow[];
  availableSports: string[];
};
export async function topDockedBoard(
  period: RankingPeriod = "month",
  sport?: string,
): Promise<TopDockedBoard> {
  const base = {
    rule: topDockedRuleV1,
    period,
    asOf: new Date().toISOString(),
    sport: sport ?? null,
    rows: [] as PublicTopDockedRow[],
    availableSports: [] as string[],
  };
  if (!config().database || !config().auth)
    return {
      ...base,
      status: "NOT_CONFIGURED",
      message:
        "No connected community ledger. Historical performance is unavailable, not zero.",
    };
  if (
    !(await communityAccess("leaderboards")).allowed ||
    !(await communityAccess("community_edges")).allowed
  )
    return {
      ...base,
      status: "RESTRICTED",
      message:
        "Top Docked requires current regional approval and an eligible account.",
    };
  try {
    return await withCommunityActor(
      "leaderboards",
      false,
      async (tx, who, viewer) => {
        await tx`select private.community_assert_access(${who.user.id},'community_edges')`;
        const records = await canonicalRecords(tx, base.asOf);
        const snapshot = calculateTopDocked(records, {
          period,
          asOf: base.asOf,
          sport,
        });
        const availableSports = [
          ...new Set(records.map((record) => record.sport)),
        ]
          .sort()
          .filter((candidate) =>
            calculateTopDocked(records, {
              period,
              asOf: base.asOf,
              sport: candidate,
            }).rows.some((row) => row.qualification === "QUALIFIED"),
          );
        const previous =
          await tx`select payload from private.leaderboard_snapshots where rule_version=${topDockedRuleV1.version} and period=${period} and sport is not distinct from ${sport ?? null} and as_of<${base.asOf} order by as_of desc,id desc limit 1`;
        const previousRows = (previous[0]?.payload?.rows ??
          []) as TopDockedRow[];
        const profiles = await tx`select id,
        case when private.social_profile_visible(${viewer}::uuid,id,false) then handle else 'member-'||left(id::text,8) end handle,
        case when private.social_profile_visible(${viewer}::uuid,id,false) then display_name else 'Community member' end display_name,
        private.social_profile_visible(${viewer}::uuid,id,false) interactions_allowed,
        case when private.social_profile_visible(${viewer}::uuid,id,false) then (select count(*)::int from private.social_follows where target_id=private.social_profiles.id) else null end followers from private.social_profiles`;
        const visible = new Map(profiles.map((p) => [p.id, p]));
        // Privacy changes identity presentation, never the canonical losing records or ranking inputs.
        const rows = snapshot.rows.map((r) => {
          const p = visible.get(r.profileId);
          return {
            ...r,
            handle: (p?.handle ??
              `member-${r.profileId.slice(0, 8)}`) as string,
            displayName: (p?.display_name ?? "Community member") as string,
            interactionsAllowed: p?.interactions_allowed === true,
            followers:
              p?.followers === null || p?.followers === undefined
                ? null
                : Number(p.followers),
            badges: qualifiedPerformanceBadges(
              r,
              previousRows.find((row) => row.profileId === r.profileId),
              sport,
              previous[0]?.payload
                ? { current: snapshot, previous: previous[0].payload }
                : undefined,
            ),
          };
        });
        return {
          ...base,
          availableSports,
          status: rows.length ? ("READY" as const) : ("EMPTY" as const),
          message: rows.length
            ? "Historical verified one-unit records. Past performance does not guarantee future results. Restricted identities are pseudonymised; their complete records remain included."
            : "No qualifying community record is available for this period. Tiny samples remain provisional.",
          rows,
        };
      },
    );
  } catch {
    return {
      ...base,
      status: "NOT_CONFIGURED",
      message: "Community performance is temporarily unavailable.",
    };
  }
}
export async function profilePerformanceBundle(
  profileId: string,
  period: RankingPeriod = "all",
) {
  const empty = {
    performance: null as (TopDockedRow & { badges: PerformanceBadge[] }) | null,
    sports: [] as (TopDockedRow & {
      sport: string;
      badges: PerformanceBadge[];
    })[],
  };
  if (
    !config().database ||
    !config().auth ||
    !(await communityAccess("public_profiles")).allowed ||
    !(await communityAccess("community_edges")).allowed
  )
    return empty;
  const allowRanking = (await communityAccess("leaderboards")).allowed;
  return withCommunityActor("community_edges", false, async (tx, who) => {
    await tx`select private.community_assert_access(${who.user.id},'public_profiles')`;
    if (allowRanking)
      await tx`select private.community_assert_access(${who.user.id},'leaderboards')`;
    const asOf = new Date().toISOString(),
      records = await canonicalRecords(tx, asOf);
    const snapshot = calculateTopDocked(records, { period, asOf });
    const row = snapshot.rows.find((r) => r.profileId === profileId);
    const performance = row
      ? {
          ...row,
          rank: allowRanking ? row.rank : null,
          badges: allowRanking ? qualifiedPerformanceBadges(row) : [],
        }
      : null;
    const sports = [
      ...new Set(
        records.filter((r) => r.profileId === profileId).map((r) => r.sport),
      ),
    ]
      .sort()
      .flatMap((sport) => {
        const result = calculateTopDocked(records, {
          period,
          asOf,
          sport,
        }).rows.find((r) => r.profileId === profileId);
        return result
          ? [
              {
                ...result,
                sport,
                rank: allowRanking ? result.rank : null,
                badges: allowRanking
                  ? qualifiedPerformanceBadges(result, undefined, sport)
                  : [],
              },
            ]
          : [];
      });
    return { performance, sports };
  });
}
export async function profilePerformance(
  profileId: string,
  period: RankingPeriod = "all",
) {
  return (await profilePerformanceBundle(profileId, period)).performance;
}
export async function profileSportPerformance(
  profileId: string,
  period: RankingPeriod = "all",
) {
  return (await profilePerformanceBundle(profileId, period)).sports;
}
export async function captureTopDockedSnapshot(
  period: RankingPeriod,
  sport: string | undefined,
  reason: string,
) {
  if (reason.trim().length < 10)
    throw new Error("Snapshot review reason required");
  const who = await requireRole(["owner", "admin"]),
    sql = db();
  return sql.begin("isolation level repeatable read", async (tx) => {
    await setCommunityClaims(tx, who);
    const time = await tx`select clock_timestamp() at`;
    const asOf = iso(time[0].at),
      records = await canonicalRecords(tx, asOf);
    const snapshot = calculateTopDocked(records, { period, asOf, sport });
    const rule =
      await tx`select configuration from private.leaderboard_rule_versions where id=${topDockedRuleV1.version}`;
    const configuration = Object.fromEntries(
      Object.entries(topDockedRuleV1).filter(([key]) => key !== "version"),
    );
    if (!rule[0] || hash(rule[0].configuration) !== hash(configuration))
      throw new Error(
        "Installed leaderboard rule differs from the registered immutable version",
      );
    const previous =
      await tx`select id from private.leaderboard_snapshots where rule_version=${topDockedRuleV1.version} and period=${period} and sport is not distinct from ${sport ?? null} order by created_at desc,id desc limit 1`;
    const rows =
      await tx`insert into private.leaderboard_snapshots(rule_version,period,sport,as_of,source_hash,snapshot_hash,payload,previous_id,actor,reason)
      values(${topDockedRuleV1.version},${period},${sport ?? null},${asOf},${hash(records)},${hash(snapshot)},${tx.json(snapshot)},${previous[0]?.id ?? null},${who.user.id},${reason.trim()}) returning id`;
    await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'leaderboard_snapshot',${rows[0].id},${tx.json({ previousSnapshotId: previous[0]?.id ?? null, sourceHash: hash(records), reason })})`;
    return rows[0].id as string;
  });
}
export async function topDockedAudit() {
  await requireRole(["owner", "admin", "auditor"]);
  const sql = db();
  return {
    rule: topDockedRuleV1,
    snapshots:
      await sql`select id,rule_version,period,sport,as_of,source_hash,snapshot_hash,previous_id,actor,reason,created_at from private.leaderboard_snapshots order by created_at desc,id desc limit 50`,
  };
}
export async function topDockedSnapshotExport(id: string) {
  await requireRole(["owner", "admin", "auditor"]);
  const rows =
    await db()`select * from private.leaderboard_snapshots where id=${id}`;
  return rows[0] ?? null;
}

/** Bounded, resumable in-app milestone delivery. Never called from a member request. */
export async function processLeaderboardNotifications() {
  return db().begin(async (tx) => {
    const jobs =
      await tx`select j.*,s.period,s.sport,s.as_of,s.payload-'rows' current_scope,p.payload-'rows' previous_scope,s.previous_id
      from private.leaderboard_notification_jobs j join private.leaderboard_snapshots s on s.id=j.snapshot_id
      left join private.leaderboard_snapshots p on p.id=s.previous_id
      where j.completed_at is null order by j.created_at,j.snapshot_id limit 1 for update of j skip locked`;
    const job = jobs[0];
    if (!job) return { processed: 0, delivered: 0 };
    if (
      Date.now() - new Date(job.as_of).getTime() > 86400000 ||
      !job.previous_scope ||
      !sameRankingScope(job.current_scope, {
        ...job.current_scope,
        from: rankingWindow(
          job.period as RankingPeriod,
          new Date().toISOString(),
        ).from,
      })
    ) {
      await tx`update private.leaderboard_notification_jobs set completed_at=clock_timestamp() where snapshot_id=${job.snapshot_id}`;
      return { processed: 0, delivered: 0 };
    }
    const rows =
      await tx`select current_row.value current_row,previous_row.value previous_row
      from private.leaderboard_snapshots s join private.leaderboard_snapshots p on p.id=s.previous_id
      cross join lateral jsonb_array_elements(s.payload->'rows') current_row(value)
      left join lateral(select value from jsonb_array_elements(p.payload->'rows') where value->>'profileId'=current_row.value->>'profileId' limit 1) previous_row on true
      where s.id=${job.snapshot_id} and (${job.cursor_profile_id ?? null}::text is null or current_row.value->>'profileId'>${job.cursor_profile_id ?? null}::text)
      order by current_row.value->>'profileId' limit 51`;
    const page = rows.slice(0, 50),
      now = new Date().toISOString();
    const currentRows = calculateTopDocked(
      await canonicalRecords(
        tx,
        now,
        page.map((row) => row.current_row.profileId),
      ),
      {
        period: job.period as RankingPeriod,
        asOf: now,
        sport: job.sport ?? undefined,
      },
    ).rows;
    const scope = {
      current: job.current_scope as RankingScope,
      previous: job.previous_scope as RankingScope,
    };
    const permitted =
      await tx`select id from private.social_profiles where id=any(${page.map((row) => row.current_row.profileId)}::uuid[]) and user_id is not null and private.community_feature_allowed(user_id,'community_edges')`;
    const allowed = new Set(permitted.map((profile) => profile.id));
    let delivered = 0;
    for (const row of page) {
      const current = row.current_row as TopDockedRow,
        previous = row.previous_row as TopDockedRow | undefined;
      const milestone = leaderboardMilestone(current, previous, scope);
      if (
        !milestone ||
        !allowed.has(current.profileId) ||
        currentRows.find((r) => r.profileId === current.profileId)
          ?.qualification !== "QUALIFIED"
      )
        continue;
      // Snapshot retries cannot generate another notification for identical evidence.
      const identity = hash({
        rule: scope.current.rule.version,
        from: scope.current.from,
        period: scope.current.period,
        sport: scope.current.sport,
        profile: current.profileId,
        milestone,
        evidence: milestone === "RISING" ? current.edgeIds : [],
      });
      const inserted = await enqueueCommunityNotification(tx, {
        recipientId: current.profileId,
        type: "leaderboard",
        title:
          milestone === "QUALIFIED"
            ? "Your verified record meets the published sample rules"
            : "Your qualified ranking has changed in a reviewed snapshot",
        href: `/top-docked?period=${encodeURIComponent(job.period)}${job.sport ? `&sport=${encodeURIComponent(job.sport)}` : ""}`,
        dedupeKey: `leaderboard:${identity}`,
        groupKey: `leaderboard:${job.period}:${job.sport ?? "all"}`,
      });
      if (inserted) delivered++;
    }
    await tx`update private.leaderboard_notification_jobs set cursor_profile_id=${page.at(-1)?.current_row.profileId ?? job.cursor_profile_id ?? null},completed_at=case when ${rows.length <= 50} then clock_timestamp() else null end where snapshot_id=${job.snapshot_id}`;
    return { processed: page.length, delivered };
  });
}
