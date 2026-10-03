import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { z } from "zod";
import { db, rateLimit } from "./db";
import { requireRole } from "./auth";
import { communityAccess } from "./community-policy";
import { withCommunityActor, setCommunityClaims } from "./community-social";
import { config } from "./config";
import { providerReadiness, freshTimestamp } from "@/core/data-health";
import type { Quote, Rules } from "@/core/pricing";
import { settle } from "@/core/settlement";
import type { ResultsProvider } from "@/providers/contracts";
import {
  communityRuleV1,
  communityMarketLabel,
  permanentEdgeStatement,
  verifyCommunityQuote,
  type CommunityEdge,
  type CommunityQuoteEvidence,
  type CommunityQuoteOption,
  type CommunityReview,
  type PriceClass,
  type QuoteOptionsResponse,
} from "@/core/community-edge";

type Sql = postgres.Sql | postgres.TransactionSql;
type Row = Record<string, unknown>;
const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : String(value);
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export class CommunityEdgeError extends Error {
  constructor(
    public code: string,
    message: string,
    public current?: CommunityReview,
    public previousOdds?: string,
  ) {
    super(message);
  }
}
const draftSchema = z
  .object({
    snapshotId: z.string().min(1).max(200),
    selection: z.string().min(1).max(150),
  })
  .strict();
export const communitySubmitSchema = draftSchema
  .extend({
    reviewToken: z.string().regex(/^[a-f0-9]{64}$/),
    confirmedPermanent: z.literal(true),
    idempotencyKey: z.string().uuid(),
    reasoning: z.string().max(4000).optional(),
    mediaIds: z
      .array(z.string().uuid())
      .max(4)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate media")
      .optional(),
  })
  .strict();

async function quoteRows(
  sql: Sql,
  marketId?: string,
  bookmaker?: string,
  provider?: string,
) {
  return sql`select distinct on (q.market_id,q.bookmaker,q.provider) q.*,m.rules canonical_rules,e.id event_id,e.start_at,e.status event_status,e.participants,e.competition_id,c.sport_id,e.source_mappings,
    v.id quote_evidence_id,v.classification,v.classification_version,v.classification_evidence,v.observed_start_at,v.provider_event_id,v.metadata,v.rights_reference,
    h.healthy,h.last_success,h.rights_reference source_rights,h.capabilities
    from private.odds_snapshots q join private.markets m on m.id=q.market_id join private.events e on e.id=m.event_id join private.competitions c on c.id=e.competition_id
    left join private.community_quote_evidence v on v.snapshot_id=q.id left join private.source_health h on h.provider=q.provider
    where q.evidence in ('forward_paper','live_published') and e.start_at>clock_timestamp()
      and (${marketId ?? null}::text is null or q.market_id=${marketId ?? null}) and (${bookmaker ?? null}::text is null or q.bookmaker=${bookmaker ?? null}) and (${provider ?? null}::text is null or q.provider=${provider ?? null})
    order by q.market_id,q.bookmaker,q.provider,q.source_at desc,q.received_at desc,q.id desc limit 300`;
}
function evidence(row: Row, selection: string): CommunityQuoteEvidence {
  const q = row.payload as Quote,
    rules = row.canonical_rules as Rules;
  const metadata = row.metadata as { promotionFlags?: string[] } | null;
  const capabilities = row.capabilities as Record<string, boolean> | null;
  return {
    snapshotId: String(row.id),
    marketId: String(row.market_id),
    sport: String(row.sport_id),
    competition: String(row.competition_id),
    eventId: String(row.event_id),
    eventLabel: (row.participants as string[]).join(" vs "),
    startAt: iso(row.start_at),
    selection,
    bookmaker: String(row.bookmaker),
    odds: q.prices[selection] ?? "",
    sourceAt: iso(row.source_at),
    receivedAt: iso(row.received_at),
    cutoffAt: new Date(
      Date.parse(iso(row.start_at)) - communityRuleV1.cutoffSeconds * 1000,
    ).toISOString(),
    classification:
      (row.classification as PriceClass | null) ?? "UNKNOWN_REVIEW",
    ruleVersion: communityRuleV1.version,
    provider: String(row.provider),
    providerEventId: String(row.provider_event_id ?? ""),
    snapshotAt: iso(row.snapshot_at),
    rules: q.rules,
    canonicalRules: rules,
    observedStartAt: row.observed_start_at ? iso(row.observed_start_at) : "",
    prices: q.prices,
    suspended: q.suspended,
    eventStatus: String(row.event_status),
    provenance: row.quote_evidence_id ? "docked_current_provider" : "unknown",
    licensed:
      !!row.rights_reference &&
      row.rights_reference === row.source_rights &&
      row.provenance === row.source_rights &&
      capabilities?.display === true &&
      capabilities?.retention === true &&
      capabilities?.community_standard_prices === true,
    providerClassification: row.classification as PriceClass | null,
    classificationEvidence: row.classification_evidence as string | null,
    classificationVersion: row.classification_version as string | null,
    promotionFlags: metadata?.promotionFlags ?? [],
  };
}
function option(e: CommunityQuoteEvidence): CommunityQuoteOption {
  const {
    snapshotId,
    marketId,
    sport,
    competition,
    eventId,
    eventLabel,
    startAt,
    selection,
    bookmaker,
    odds,
    sourceAt,
    receivedAt,
    cutoffAt,
    classification,
    ruleVersion,
  } = e;
  return {
    snapshotId,
    marketId,
    marketLabel: communityMarketLabel(e.canonicalRules),
    sport,
    competition,
    eventId,
    eventLabel,
    startAt,
    selection,
    bookmaker,
    odds,
    sourceAt,
    receivedAt,
    cutoffAt,
    classification,
    ruleVersion,
  };
}
function reviewFor(
  e: CommunityQuoteEvidence,
  profileId: string,
): CommunityReview {
  const summary = option(e);
  return {
    ...summary,
    reviewToken: digest({ profileId, ...summary }),
    permanentStatement: permanentEdgeStatement,
  };
}
async function bookmakerAllowed(sql: Sql, policyId: string, bookmaker: string) {
  const rows =
    await sql`select id from private.bookmaker_eligibility where region_policy_id=${policyId} and bookmaker=${bookmaker} and approved and effective_from<=clock_timestamp() and effective_to>clock_timestamp() for share`;
  return rows.length > 0;
}

export async function communityQuoteOptions(): Promise<QuoteOptionsResponse> {
  if (
    !config().database ||
    !config().auth ||
    providerReadiness(process.env, "odds") !== "READY"
  )
    return {
      status: "NOT_CONFIGURED",
      message:
        "Verified community Edges need an authorised current odds provider and known standard-price metadata. Posting a discussion remains separate.",
      options: [],
    };
  if (!(await communityAccess("community_edges")).allowed)
    return {
      status: "RESTRICTED",
      message:
        "Community Edge submission is not approved for your region or account.",
      options: [],
    };
  try {
    return await withCommunityActor(
      "community_edges",
      true,
      async (tx, who, profileId) => {
        const policies =
          await tx`select id,operators from private.region_policies where country=${who.profile.country} and state=${who.profile.state} and approved and effective_from<=now() and effective_to>now() and review_at>now() and 'community_edges'=any(features) order by effective_from desc limit 1 for share`;
        if (!policies[0])
          return {
            status: "RESTRICTED" as const,
            message: "Current regional approval is required.",
            options: [],
          };
        const books =
          await tx`select bookmaker from private.bookmaker_eligibility where region_policy_id=${policies[0].id} and approved and effective_from<=now() and effective_to>now()`;
        const approved = new Set(books.map((b) => b.bookmaker));
        const rows = await quoteRows(tx),
          now = new Date().toISOString(),
          options: CommunityQuoteOption[] = [];
        for (const row of rows)
          for (const selection of (row.canonical_rules as Rules).outcomes) {
            const e = evidence(row, selection);
            const verdict = verifyCommunityQuote(e, {
              now,
              regionAllowed: true,
              bookmakerAllowed:
                approved.has(e.bookmaker) &&
                policies[0].operators.includes(e.bookmaker),
              feedHealthy: !!row.healthy && freshTimestamp(row.last_success),
            });
            if (verdict.eligible) options.push(option(e));
          }
        void profileId;
        return {
          status: options.length
            ? ("READY" as const)
            : ("NO_VERIFIED_PRICES" as const),
          message: options.length
            ? "Select a current standard price, then review the permanent record."
            : "No eligible current standard-price evidence is available. Unknown or promotional prices cannot enter the ledger.",
          options,
        };
      },
    );
  } catch {
    return {
      status: "NO_VERIFIED_PRICES",
      message:
        "Verified prices are unavailable. No competitive record can be submitted from missing evidence.",
      options: [],
    };
  }
}

async function currentReview(
  sql: Sql,
  who: { profile: Row },
  profileId: string,
  draft: z.infer<typeof draftSchema>,
) {
  const selected =
    await sql`select market_id,bookmaker,provider,payload from private.odds_snapshots where id=${draft.snapshotId}`;
  if (!selected[0])
    throw new CommunityEdgeError(
      "UNVERIFIED",
      "The selected provider observation is unavailable.",
    );
  // Locks are shared with every odds-snapshot insertion, including the preserved official ingestion path.
  await sql`select id from private.markets where id=${selected[0].market_id} for update`;
  const rows = await quoteRows(
    sql,
    selected[0].market_id,
    selected[0].bookmaker,
    selected[0].provider,
  );
  if (!rows[0])
    throw new CommunityEdgeError(
      "POST_CUTOFF",
      "EDGE SUBMISSIONS CLOSED or current prices unavailable.",
    );
  const policies =
    await sql`select * from private.region_policies where country=${String(who.profile.country)} and state=${String(who.profile.state)} and approved and effective_from<=clock_timestamp() and effective_to>clock_timestamp() and review_at>clock_timestamp() and 'community_edges'=any(features) order by effective_from desc limit 1 for share`;
  const policy = policies[0],
    e = evidence(rows[0], draft.selection);
  const verdict = verifyCommunityQuote(e, {
    now: new Date().toISOString(),
    regionAllowed: !!policy,
    bookmakerAllowed:
      !!policy &&
      policy.operators.includes(e.bookmaker) &&
      (await bookmakerAllowed(sql, policy.id, e.bookmaker)),
    feedHealthy: !!rows[0].healthy && freshTimestamp(rows[0].last_success),
  });
  if (!verdict.eligible)
    throw new CommunityEdgeError(verdict.classification, verdict.reason);
  return {
    e,
    review: reviewFor(e, profileId),
    policyId: policy.id as string,
    quoteEvidenceId: rows[0].quote_evidence_id as string,
    previousOdds: (selected[0].payload as Quote).prices[draft.selection],
  };
}
export async function reviewCommunityEdge(
  input: unknown,
): Promise<CommunityReview> {
  const draft = draftSchema.parse(input);
  return withCommunityActor(
    "community_edges",
    true,
    async (tx, who, profileId) => {
      if (!(await rateLimit(`community-edge-review:${profileId}`, 20)))
        throw new Error("Rate limit");
      return (await currentReview(tx, who, profileId, draft)).review;
    },
  );
}
export async function submitCommunityEdge(input: unknown) {
  const draft = communitySubmitSchema.parse(input);
  return withCommunityActor(
    "community_edges",
    true,
    async (tx, who, profileId) => {
      if (!(await rateLimit(`community-edge-submit:${profileId}`, 10)))
        throw new Error("Rate limit");
      const requestHash = digest(draft);
      try {
        const previous =
          await tx`select private.community_submission_retry(${profileId},${draft.idempotencyKey},${requestHash}) id`;
        if (previous[0]?.id)
          return { id: previous[0].id as string, created: false };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("IDEMPOTENCY_CONFLICT")
        )
          throw new CommunityEdgeError(
            "IDEMPOTENCY_CONFLICT",
            "This submission key belongs to a different permanent record.",
          );
        throw error;
      }
      const current = await currentReview(tx, who, profileId, draft);
      if (
        current.review.reviewToken !== draft.reviewToken ||
        current.e.snapshotId !== draft.snapshotId
      )
        throw new CommunityEdgeError(
          "PRICE_MOVED",
          "The observation changed. Review and confirm the current verified price before submitting.",
          current.review,
          current.previousOdds,
        );
      const e = current.e,
        id = randomUUID();
      await tx`insert into private.community_edges(id,profile_id,event_id,market_id,snapshot_id,quote_evidence_id,provider,provider_event_id,bookmaker,selection,market_rules,sport,competition,odds,verification_rule,start_at,source_at,snapshot_at,received_at,region_policy_id,confirmed_permanent,review_hash,idempotency_key,request_hash)
      values(${id},${profileId},${e.eventId},${e.marketId},${e.snapshotId},${current.quoteEvidenceId},${e.provider},${e.providerEventId},${e.bookmaker},${e.selection},${tx.json(e.rules)},${e.sport},${e.competition},${e.odds},${communityRuleV1.version},${e.startAt},${e.sourceAt},${e.snapshotAt},${e.receivedAt},${current.policyId},true,${draft.reviewToken},${draft.idempotencyKey},${requestHash})`;
      await tx`insert into private.community_edge_status(edge_id,status,actor,reason) values(${id},'PENDING',${who.user.id},'Permanent verified community record submitted')`;
      // Optional approved owned images are commentary only; they never enter quote verification.
      const mediaIds = draft.mediaIds ?? [];
      if (mediaIds.length) {
        const media =
          await tx`select id from private.social_media where id=any(${mediaIds}::uuid[]) and owner_id=${profileId} and status='approved' and content is not null for share`;
        if (media.length !== mediaIds.length)
          throw new Error("Only owned approved social images may be attached");
      }
      // The social-post trigger queues durable, bounded in-app fanout atomically.
      const posts =
        await tx`insert into private.social_posts(author_id,kind,body,sport,community_edge_id,claim_label,idempotency_key) values(${profileId},'edge',${draft.reasoning ?? ""},${e.sport},${id},'social_only',${draft.idempotencyKey}) returning id`;
      for (let position = 0; position < mediaIds.length; position++)
        await tx`insert into private.social_post_media(post_id,media_id,position) values(${posts[0].id},${mediaIds[position]},${position})`;
      await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'community_edge_submitted',${id},${tx.json({ snapshotId: e.snapshotId, verificationRule: communityRuleV1.version, standardUnits: "1.00", confirmedPermanent: true })})`;
      return { id, created: true };
    },
  );
}

/** Trusted ingestion hook: classification is read only from retained provider metadata, never from caller claims. */
export async function registerCommunityQuoteEvidence(snapshotId: string) {
  const sql = db();
  const rows =
    await sql`insert into private.community_quote_evidence(snapshot_id,provider_event_id,observed_start_at,classification,classification_version,classification_evidence,rights_reference,metadata)
    values(${snapshotId},'',clock_timestamp(),'UNKNOWN_REVIEW','','','','{}') on conflict(snapshot_id) do nothing returning id`;
  return rows[0]?.id as string | undefined;
}

function edgeFromRow(row: Row): CommunityEdge {
  const rules = row.market_rules as Rules;
  return {
    id: String(row.id),
    profileId: String(row.profile_id),
    handle: String(row.handle),
    displayName: String(row.display_name),
    snapshotId: String(row.snapshot_id),
    marketId: String(row.market_id),
    marketLabel: communityMarketLabel(rules),
    sport: String(row.sport),
    competition: String(row.competition),
    eventId: String(row.event_id),
    eventLabel: rules.participants.join(" vs "),
    startAt: iso(row.start_at),
    selection: String(row.selection),
    bookmaker: String(row.bookmaker),
    odds: String(row.odds),
    sourceAt: iso(row.source_at),
    receivedAt: iso(row.received_at),
    cutoffAt: new Date(Date.parse(iso(row.start_at)) - 600000).toISOString(),
    classification: "STANDARD_VERIFIED",
    ruleVersion: String(row.verification_rule),
    submittedAt: iso(row.submitted_at),
    units: "1.00",
    result: (row.result ?? "PENDING") as CommunityEdge["result"],
    settledAt: row.settled_at ? iso(row.settled_at) : null,
    corrections: Number(row.corrections ?? 0),
    integrity: row.integrity === "INTEGRITY_REVIEW" ? "REVIEW" : "CLEAR",
    interactionsAllowed: row.interactions_allowed === true,
  };
}
export async function listCommunityEdges(
  filters: {
    profileId?: string;
    sport?: string;
    competition?: string;
    following?: boolean;
    settled?: boolean;
    before?: string;
    limit?: number;
  } = {},
) {
  const empty = {
    status: "RESTRICTED",
    message: "Community records require an eligible verified account.",
    edges: [] as CommunityEdge[],
    nextCursor: null as string | null,
  };
  if (!config().database || !config().auth)
    return {
      ...empty,
      status: "NOT_CONFIGURED",
      message:
        "Community services are not configured. No performance records have been created.",
    };
  if (!(await communityAccess("community_edges")).allowed) return empty;
  try {
    return await withCommunityActor(
      "community_edges",
      false,
      async (tx, _who, profileId) => {
        const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
        let cursorTime: string | null = null,
          cursorId: string | null = null;
        if (filters.before) {
          const cursor = JSON.parse(
            Buffer.from(filters.before, "base64url").toString("utf8"),
          );
          cursorTime = z.string().datetime().parse(cursor.at);
          cursorId = z.string().uuid().parse(cursor.id);
        }
        const rows = await tx`select e.*,
        case when private.social_profile_visible(${profileId}::uuid,p.id,false) then p.handle else 'member-'||left(p.id::text,8) end handle,
        case when private.social_profile_visible(${profileId}::uuid,p.id,false) then p.display_name else 'Community member' end display_name,
        private.social_profile_visible(${profileId}::uuid,p.id,false) interactions_allowed,s.result,s.created_at settled_at,
        (select status from private.community_edge_status where edge_id=e.id and status in ('INTEGRITY_REVIEW','INTEGRITY_CLEARED') order by created_at desc,id desc limit 1) integrity,
        (select count(*) from private.community_corrections where edge_id=e.id) corrections
        from private.community_edges e join private.social_profiles p on p.id=e.profile_id
        left join lateral(select result,created_at from private.community_settlements where edge_id=e.id order by created_at desc,id desc limit 1)s on true
        where (${filters.profileId ?? null}::uuid is null or e.profile_id=${filters.profileId ?? null})
          and (${filters.sport ?? null}::text is null or e.sport=${filters.sport ?? null}) and (${filters.competition ?? null}::text is null or e.competition=${filters.competition ?? null})
          and (not ${filters.following ?? false} or (private.social_profile_visible(${profileId}::uuid,p.id,false) and exists(select 1 from private.social_follows f where f.actor_id=${profileId} and f.target_id=p.id)))
          and (not ${filters.settled ?? false} or s.result in ('WON','LOST','VOID'))
          and (${cursorTime}::timestamptz is null or (e.submitted_at,e.id)<(${cursorTime}::timestamptz,${cursorId}::uuid))
        order by e.submitted_at desc,e.id desc limit ${limit + 1}`;
        const page = rows.slice(0, limit),
          last = page.at(-1);
        return {
          status: rows.length ? "READY" : "EMPTY",
          message: rows.length
            ? "Permanent community records. Standard one-unit benchmark; wins and losses retained."
            : "No accessible verified community records yet.",
          edges: page.map(edgeFromRow),
          nextCursor:
            rows.length > limit && last
              ? Buffer.from(
                  JSON.stringify({ at: iso(last.submitted_at), id: last.id }),
                ).toString("base64url")
              : null,
        };
      },
    );
  } catch {
    return {
      ...empty,
      status: "NOT_CONFIGURED",
      message: "Community records are temporarily unavailable.",
    };
  }
}
export async function getCommunityEdge(id: string) {
  z.string().uuid().parse(id);
  if (
    !config().database ||
    !config().auth ||
    !(await communityAccess("community_edges")).allowed
  )
    return null;
  return withCommunityActor(
    "community_edges",
    false,
    async (tx, _who, viewerId) => {
      const rows = await tx`select e.*,
      case when private.social_profile_visible(${viewerId}::uuid,p.id,false) then p.handle else 'member-'||left(p.id::text,8) end handle,
      case when private.social_profile_visible(${viewerId}::uuid,p.id,false) then p.display_name else 'Community member' end display_name,
      private.social_profile_visible(${viewerId}::uuid,p.id,false) interactions_allowed,s.result,s.created_at settled_at,(select count(*) from private.community_corrections where edge_id=e.id) corrections,
      (select status from private.community_edge_status where edge_id=e.id and status in ('INTEGRITY_REVIEW','INTEGRITY_CLEARED') order by created_at desc,id desc limit 1) integrity
      from private.community_edges e join private.social_profiles p on p.id=e.profile_id
      left join lateral(select result,created_at from private.community_settlements where edge_id=e.id order by created_at desc,id desc limit 1)s on true
      where e.id=${id}`;
      if (!rows[0]) return null;
      const corrections =
        await tx`select id,correction_type type,reason,actor,created_at,old_result,new_result,evidence_reference from private.community_corrections where edge_id=${id} order by created_at,id`;
      return {
        edge: edgeFromRow(rows[0]),
        corrections: corrections.map((c) => ({
          id: c.id as string,
          type: c.type as string,
          reason: c.reason as string,
          actor: `Authorised reviewer ${digest(c.actor).slice(0, 12)}`,
          at: iso(c.created_at),
          oldResult: c.old_result as string,
          newResult: c.new_result as string,
          evidenceReference: c.evidence_reference as string,
        })),
      };
    },
  );
}

export async function reconcileCommunityResults(
  provider: ResultsProvider,
  eventId: string,
  correctionReason?: string,
) {
  if (!provider.authorised || provider.status !== "READY")
    return { status: "PENDING", settled: 0 };
  const administrator = correctionReason
    ? await requireRole(["owner", "admin"])
    : null;
  const sql = db(),
    edges =
      await sql`select * from private.community_edges where event_id=${eventId}`;
  let settled = 0;
  for (const edge of edges) {
    const result = await provider.result(eventId, edge.market_rules as Rules);
    if (!result || result.source !== provider.id) continue;
    const outcome =
      result.status === "manual_review"
        ? "MANUAL_REVIEW"
        : settle(
            edge.market_rules as Rules,
            edge.selection,
            result,
          ).toUpperCase();
    if (outcome === "PENDING") continue;
    await sql.begin(async (tx) => {
      if (administrator) await setCommunityClaims(tx, administrator);
      await tx`select id from private.community_edges where id=${edge.id} for update`;
      const previous =
        await tx`select * from private.community_settlements where edge_id=${edge.id} order by created_at desc,id desc limit 1`;
      const old = previous[0];
      if (
        old &&
        old.provider === result.source &&
        old.provider_event_id === result.sourceEventId &&
        old.revision === result.revision &&
        old.result === outcome
      )
        return;
      if (old && !administrator)
        throw new Error(
          "Changed result requires explicit administrator correction review",
        );
      await tx`insert into private.community_settlements(edge_id,result,provider,provider_event_id,revision,observed_at,evidence,actor,previous_id,correction_reason)
        values(${edge.id},${outcome},${result.source},${result.sourceEventId},${result.revision},${result.observedAt},${tx.json(result)},${administrator?.user.id ?? `results-provider:${provider.id}`},${old?.id ?? null},${correctionReason ?? null})`;
      settled++;
    });
  }
  return { status: settled ? "SETTLED" : "PENDING", settled };
}

export async function communityVerificationAudit(view: string) {
  await requireRole(["owner", "admin", "auditor"]);
  const sql = db();
  const quotes =
    await sql`select v.id,v.snapshot_id,v.provider_event_id,v.classification,v.classification_version,v.classification_evidence,v.rights_reference,v.created_at,q.provider,q.bookmaker,q.source_at,q.received_at from private.community_quote_evidence v join private.odds_snapshots q on q.id=v.snapshot_id where (${view !== "promotions"} or v.classification in ('PROMOTIONAL_EXCLUDED','UNKNOWN_REVIEW')) order by v.created_at desc,v.id desc limit 100`;
  const reviews =
    await sql`select * from private.community_edge_status where status<>'PENDING' order by created_at desc,id desc limit 100`;
  const sources =
    await sql`select * from private.community_result_sources order by created_at desc,id desc limit 100`;
  const corrections =
    await sql`select * from private.community_corrections order by created_at desc,id desc limit 100`;
  return {
    rule: communityRuleV1,
    providerStatus: providerReadiness(process.env, "odds"),
    quotes,
    reviews,
    resultSourceReviews: sources,
    corrections,
  };
}
export async function reviewCommunityIntegrity(input: unknown) {
  const value = z
    .object({
      edgeId: z.string().uuid(),
      status: z.enum(["INTEGRITY_REVIEW", "INTEGRITY_CLEARED"]),
      reason: z.string().trim().min(12).max(2000),
    })
    .strict()
    .parse(input);
  const who = await requireRole(["owner", "admin"]);
  return db().begin(async (tx) => {
    await setCommunityClaims(tx, who);
    const rows =
      await tx`insert into private.community_edge_status(edge_id,status,actor,reason) values(${value.edgeId},${value.status},${who.user.id},${value.reason}) returning id`;
    return rows[0].id as string;
  });
}
