import "server-only";
import { approvedResearchFile } from "@/core/research-presentation";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { config } from "./config";
import { requireRole, identity } from "./auth";
import { withCommunityActor } from "./community-social";
import type { ReferenceSql } from "./market-reference";
import { phase5Hash } from "@/core/phase5-hash";
import {
  buildMatchResearchFile,
  researchContentDraft,
  researchFactHash,
  researchFactKey,
  validateResearchFact,
  validateResearchSource,
  type MatchResearchFile,
} from "@/core/research-engine";
import {
  validateResearchFeature,
  assessResearchRecalculation,
} from "@/core/research-features";
import {
  researchActionSchema,
  researchPolicySchema,
  type ResearchDashboard,
  type MatchResearchEnvelope,
  type ReviewedResearch,
  type ResearchCapabilities,
} from "@/core/research-contracts";

const readRoles = ["owner", "admin", "analyst", "editor", "auditor"];
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const json = (v: unknown) => JSON.parse(JSON.stringify(v));
type Staff = Awaited<ReturnType<typeof requireRole>>;
type Row = Record<string, unknown>;
const capabilities = (role: string): ResearchCapabilities => ({
  govern: ["owner", "admin"].includes(role),
  recordFacts: ["owner", "admin", "analyst"].includes(role),
  editorial: ["owner", "admin", "editor"].includes(role),
  enqueue: ["owner", "admin", "analyst"].includes(role),
});
async function claims(tx: ReferenceSql, who: Staff) {
  await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
}
const empty = (
  caps: ResearchCapabilities,
  status: ResearchDashboard["status"],
  message: string,
): ResearchDashboard => ({
  status,
  message,
  capabilities: caps,
  automationEnabled: false,
  sources: [],
  features: [],
  policies: [],
  models: [],
  matches: [],
  schedules: [],
  jobs: [],
  content: [],
  counts: null,
});
const eventOption = (r: Row) => ({
  eventId: String(r.id),
  homeTeam: String((r.participants as string[])[0]),
  awayTeam: String((r.participants as string[])[1]),
  startAt: iso(r.start_at),
  status: String(r.status),
});
export async function researchDashboard(): Promise<ResearchDashboard> {
  const who = await requireRole(readRoles),
    caps = capabilities(who.role);
  if (!config().database)
    return empty(
      caps,
      "NOT_CONFIGURED",
      "Research database is not configured.",
    );
  try {
    const sql = db();
    const sources =
      await sql`select s.*,s.id=(select id from private.research_source_versions x where x.source_key=s.source_key order by revision desc limit 1) current,h.last_success,h.last_failure,h.error_code,(select count(*)::int from private.research_fetch_requests r join private.research_source_versions v on v.id=r.source_review_id where v.source_key=s.source_key and r.started_at>=date_trunc('day',clock_timestamp() at time zone 'UTC')at time zone 'UTC') requests_today,(select count(*)::int from private.research_fetch_requests r join private.research_source_versions v on v.id=r.source_review_id where v.source_key=s.source_key and r.status='RESERVED') reserved_requests,(select http_status from private.research_fetch_requests r where r.source_review_id=s.id order by started_at desc limit 1) last_http_status,(select measured from private.research_fetch_requests r where r.source_review_id=s.id order by started_at desc limit 1) last_measured from private.research_source_versions s left join private.research_source_health h on h.source_key=s.source_key order by revision desc limit 100`;
    const features =
      await sql`select f.*,f.id=(select id from private.research_feature_versions x where x.feature_key=f.feature_key order by created_at desc,id desc limit 1) current from private.research_feature_versions f order by created_at desc limit 100`;
    const policies =
      await sql`select id,configuration from private.research_policies order by created_at desc limit 50`;
    const models =
      await sql`select id from private.football_model_versions order by created_at desc limit 50`;
    const matches =
      await sql`select id,participants,start_at,status from private.events where competition_id='soccer_epl' and start_at>clock_timestamp() and start_at<clock_timestamp()+interval '14 days' order by start_at,id limit 100`;
    const schedules =
      await sql`select * from private.research_schedules order by created_at desc limit 100`;
    const jobs =
      await sql`select id,state,attempts,created_at from private.job_runs where kind='research-update' order by created_at desc limit 50`;
    const content =
      await sql`select c.*,coalesce((select case action when 'PUBLISH' then 'PUBLISHED' else 'WITHDRAWN' end from private.research_content_reviews r where r.content_id=c.id order by created_at desc,id desc limit 1),'DRAFT') status from private.research_content c order by created_at desc limit 50`;
    const [counts] =
      await sql`select (select count(*)::int from private.research_facts) facts,(select count(*)::int from private.research_match_snapshots) snapshots,(select count(*)::int from private.job_runs where kind='research-update' and state in('queued','leased')) pending,(select enabled from private.feature_flags where key='research_engine') enabled`;
    return {
      ...empty(
        caps,
        "READY",
        sources.length
          ? "Rights and source clocks are checked on every use."
          : "No research source is registered. Upcoming matches are factual placeholders.",
      ),
      automationEnabled:
        process.env.RESEARCH_AUTOMATION_ENABLED === "true" &&
        counts.enabled === true,
      sources: sources.map((r) => ({
        id: String(r.id),
        configuration: validateResearchSource(r.configuration),
        createdAt: iso(r.created_at),
        current: r.current === true,
        health: {
          lastSuccess: r.last_success ? iso(r.last_success) : null,
          lastFailure: r.last_failure ? iso(r.last_failure) : null,
          errorCode: r.error_code ? String(r.error_code) : null,
          requestsToday: Number(r.requests_today),
          reservedRequests: Number(r.reserved_requests),
          lastHttpStatus:
            r.last_http_status === null ? null : Number(r.last_http_status),
          lastMeasured: r.last_measured ?? null,
        },
      })),
      features: features.map((r) => ({
        id: String(r.id),
        configuration: validateResearchFeature(r.configuration),
        current: r.current === true,
      })),
      policies: policies.map((r) => ({
        id: String(r.id),
        configuration: researchPolicySchema.parse(r.configuration),
      })),
      models: models.map((r) => ({ id: String(r.id) })),
      matches: matches.map(eventOption),
      schedules: schedules.map((r) => ({
        id: String(r.id),
        sourceReviewId: String(r.source_review_id),
        policyId: String(r.policy_id),
        enabled: r.enabled === true,
        nextRun: r.next_run ? iso(r.next_run) : null,
      })),
      jobs: jobs.map((r) => ({
        id: String(r.id),
        state: String(r.state),
        attempts: Number(r.attempts),
        createdAt: iso(r.created_at),
      })),
      content: content.map((r) => ({
        id: String(r.id),
        eventId: String(r.event_id),
        snapshotId: String(r.snapshot_id),
        type: r.content_type,
        headline: String(r.headline),
        status: r.status,
        createdAt: iso(r.created_at),
      })),
      counts: {
        facts: Number(counts.facts),
        snapshots: Number(counts.snapshots),
        pendingJobs: Number(counts.pending),
      },
    };
  } catch {
    return empty(
      caps,
      "UNAVAILABLE",
      "Research records could not be read. No missing value is a measured zero.",
    );
  }
}

async function researchInputs(
  tx: ReferenceSql,
  eventId: string,
  policyId: string,
  at?: string,
  capturedEvent?: MatchResearchFile["event"],
  capturedFacts?: string[],
  capturedSources?: string[],
  capturedAncestry?: string[],
) {
  const [event] =
    await tx`select * from private.events where id=${eventId} and competition_id='soccer_epl' for share`;
  const [p] =
    await tx`select * from private.research_policies where id=${policyId} for share`;
  if (!event || !p)
    throw Error("Canonical EPL event and explicit research policy required");
  const policy = researchPolicySchema.parse(p.configuration);
  await tx`select private.research_lock_sources(${eventId})`;
  const sourceRows =
    await tx`select s.* from private.research_source_versions s where s.id=(select id from private.research_source_versions x where x.source_key=s.source_key order by revision desc limit 1) and(${capturedSources ?? null}::uuid[] is null or s.id=any(${capturedSources ?? null}::uuid[])) order by source_key`;
  const sources = sourceRows.map((r) =>
    validateResearchSource(r.configuration),
  );
  const factRows =
    await tx`select f.id,p.payload from private.research_facts f join private.research_fact_payloads p on p.fact_id=f.id where f.event_id=${eventId} and p.retain_until>clock_timestamp() and private.research_source_allowed(f.source_review_id,'RETAIN',${policy.jurisdiction}) and(${capturedFacts ?? null}::text[] is null or f.id=any(${capturedFacts ?? null}::text[])) order by f.ingested_at,f.id limit 1001`;
  if (factRows.length > 1000)
    throw Error("Research input requires bounded review");
  const facts = factRows.map((r) => validateResearchFact(r.payload));
  const ledger =
    await tx`select f.id,f.event_id,s.source_key,f.fact_key,f.ingested_at,f.effective_at,f.supersedes_id from private.research_facts f join private.research_source_versions s on s.id=f.source_review_id where f.event_id=${eventId} and(${capturedAncestry ?? null}::text[] is null or f.id=any(${capturedAncestry ?? null}::text[])) order by f.ingested_at,f.id limit 5001`;
  if (ledger.length > 5000)
    throw Error("Research ancestry requires bounded review");
  const ancestry = ledger.map((r) => ({
    id: String(r.id),
    eventId: String(r.event_id),
    sourceId: String(r.source_key),
    factKey: String(r.fact_key),
    ingestedAt: iso(r.ingested_at),
    effectiveAt: iso(r.effective_at),
    supersedesId: r.supersedes_id ? String(r.supersedes_id) : null,
  }));
  const [{ now }] = await tx`select clock_timestamp() now`;
  const asOfTime = at ?? iso(now),
    participants = event.participants as string[];
  const file = buildMatchResearchFile({
    event: capturedEvent ?? {
      eventId,
      competitionId: String(event.competition_id),
      homeTeam: participants[0],
      awayTeam: participants[1],
      homeTeamId: participants[0],
      awayTeamId: participants[1],
      startAt: iso(event.start_at),
      venue: null,
      status: event.status,
    },
    asOfTime,
    sources,
    facts,
    ancestry,
    policy,
  });
  return {
    event,
    policy,
    sources,
    sourceReviewIds: sourceRows.map((r) => String(r.id)),
    facts,
    ancestry,
    file,
    asOfTime,
  };
}
export async function matchResearch(
  eventId: string,
  policyId?: string,
  snapshotId?: string,
): Promise<MatchResearchEnvelope> {
  const dashboard = await researchDashboard();
  const result: MatchResearchEnvelope = {
    status: dashboard.status,
    message: dashboard.message,
    event: dashboard.matches.find((e) => e.eventId === eventId) ?? null,
    file: null,
    snapshots: [],
    dashboard,
  };
  if (dashboard.status !== "READY") return result;
  const chosen = policyId ?? dashboard.policies[0]?.id;
  if (!chosen)
    return {
      ...result,
      status: "NOT_CONFIGURED",
      message:
        "Set an explicit completeness/freshness policy before compiling research.",
    };
  try {
    return await db().begin(async (tx) => {
      const [s] = snapshotId
        ? await tx`select * from private.research_match_snapshots where id=${snapshotId} and event_id=${eventId}`
        : [];
      if (snapshotId && !s) throw Error("Snapshot not found");
      const inputs = await researchInputs(
        tx,
        eventId,
        s ? String(s.policy_id) : chosen,
        s ? iso(s.as_of_time) : undefined,
        s?.manifest?.event,
        s?.manifest?.evidenceFactIds,
        s?.manifest?.sourceReviewIds,
        s?.manifest?.ancestryIds,
      );
      if (s && inputs.file.snapshotHash !== s.research_hash)
        throw Error(
          "Snapshot evidence is no longer retained or its authority has changed",
        );
      const snapshots =
        await tx`select id,as_of_time,research_hash from private.research_match_snapshots where event_id=${eventId} order by as_of_time desc,id desc limit 30`;
      return {
        ...result,
        status: "READY" as const,
        message: s
          ? "Historical snapshot: captured event identity and evidence at the shown time. Current source rights and payload retention still apply."
          : result.message,
        event: s
          ? {
              eventId: inputs.file.event.eventId,
              homeTeam: inputs.file.event.homeTeam,
              awayTeam: inputs.file.event.awayTeam,
              startAt: inputs.file.event.startAt,
              status: inputs.file.event.status,
            }
          : eventOption(inputs.event),
        file: inputs.file,
        snapshots: snapshots.map((r) => ({
          id: String(r.id),
          asOfTime: iso(r.as_of_time),
          hash: String(r.research_hash),
        })),
      };
    });
  } catch {
    return {
      ...result,
      status: "UNAVAILABLE",
      message: "Current event, retained evidence or policy is unavailable.",
    };
  }
}
async function snapshot(
  tx: ReferenceSql,
  eventId: string,
  policyId: string,
  who?: Staff,
  jobId?: string,
) {
  const input = await researchInputs(tx, eventId, policyId),
    ids = input.file.factIds;
  const facts =
    await tx`select id,fact_hash from private.research_facts where id=any(${ids}::text[]) order by id`;
  const features =
    await tx`select id,config_hash from private.research_feature_versions f where f.id=(select x.id from private.research_feature_versions x where x.feature_key=f.feature_key order by created_at desc,id desc limit 1) and(configuration->>'effectiveFrom')::timestamptz<=clock_timestamp() and(configuration->>'effectiveTo')::timestamptz>clock_timestamp() order by id`;
  const manifest = {
    eventId,
    event: input.file.event,
    factIds: ids,
    evidenceFactIds: input.facts.map((f) => f.id).sort(),
    sourceReviewIds: input.sourceReviewIds,
    ancestryIds: input.ancestry.map((f) => f.id).sort(),
    facts: facts.map((r) => ({ id: r.id, hash: r.fact_hash })),
    features: features.map((r) => ({ id: r.id, hash: r.config_hash })),
    policyHash: phase5Hash(input.policy),
    status: input.file.status,
    modelStatus: "NOT_CONFIGURED",
  };
  const [row] =
    await tx`insert into private.research_match_snapshots(event_id,policy_id,event_start_at,event_participants,as_of_time,fact_ids,feature_ids,manifest,manifest_hash,research_hash,created_by,job_id)values(${eventId},${policyId},${input.event.start_at},${tx.json(input.event.participants)},${input.asOfTime},${ids}::text[],${features.map((r) => String(r.id))}::uuid[],${tx.json(json(manifest))},${phase5Hash(manifest)},${input.file.snapshotHash},${who?.user.id ?? null},${jobId ?? null}) on conflict(event_id,policy_id,research_hash)do nothing returning id`;
  const existing =
    row ??
    (
      await tx`select id from private.research_match_snapshots where event_id=${eventId} and policy_id=${policyId} and research_hash=${input.file.snapshotHash}`
    )[0];
  return { id: String(existing.id), file: input.file };
}
export async function recordResearchJobSnapshot(
  tx: ReferenceSql,
  eventId: string,
  policyId: string,
  jobId: string,
) {
  return snapshot(tx, eventId, policyId, undefined, jobId);
}
export async function mutateResearch(value: unknown) {
  const v = researchActionSchema.parse(value),
    mode = [
      "source_review",
      "feature_review",
      "policy_review",
      "schedule",
    ].includes(v.action)
      ? "MANAGE"
      : ["content_draft", "content_review"].includes(v.action)
        ? "CONTENT"
        : "FACT";
  const who = await requireRole(
    mode === "MANAGE"
      ? ["owner", "admin"]
      : mode === "CONTENT"
        ? ["owner", "admin", "editor"]
        : ["owner", "admin", "analyst"],
  );
  return db().begin(async (tx) => {
    await claims(tx, who);
    await tx`select private.research_actor(${mode})`;
    let result: { id: string; status?: string };
    if (v.action === "source_review") {
      const c = v.configuration;
      const [prior] =
        await tx`select id from private.research_source_versions where source_key=${c.sourceId} order by revision desc limit 1`;
      const [r] =
        await tx`insert into private.research_source_versions(source_key,version,configuration,config_hash,supersedes,created_by,reason)values(${c.sourceId},${c.version},${tx.json(c)},${phase5Hash(c)},${prior?.id ?? null},${who.user.id},${v.reason})returning id`;
      result = { id: String(r.id) };
    } else if (v.action === "policy_review") {
      const c = v.configuration;
      const [r] =
        await tx`insert into private.research_policies(version,configuration,config_hash,created_by,reason)values(${c.version},${tx.json(c)},${phase5Hash(c)},${who.user.id},${v.reason})returning id`;
      result = { id: String(r.id) };
    } else if (v.action === "feature_review") {
      const c = v.configuration;
      const [prior] =
        await tx`select id from private.research_feature_versions where feature_key=${c.featureId} order by created_at desc,id desc limit 1`;
      const [r] =
        await tx`insert into private.research_feature_versions(feature_key,version,model_version,configuration,config_hash,supersedes,created_by,reason)values(${c.featureId},${c.version},${c.modelVersion},${tx.json(c)},${phase5Hash(c)},${prior?.id ?? null},${who.user.id},${v.reason})returning id`;
      result = { id: String(r.id) };
    } else if (v.action === "fact_record") {
      const [source] =
        await tx`select * from private.research_source_versions where id=${v.sourceReviewId} for share`;
      if (!source) throw Error("Reviewed source required");
      const c = validateResearchSource(source.configuration);
      const [{ now }] = await tx`select clock_timestamp() now`;
      const fact = validateResearchFact({
        schemaVersion: "research-fact-v1",
        id: randomUUID(),
        type: v.type,
        eventId: v.eventId,
        teamId: v.teamId,
        playerId: v.playerId,
        value: v.value,
        sourceId: c.sourceId,
        sourceVersion: c.version,
        sourceItemId: v.sourceItemId,
        sourceRevision: v.sourceRevision,
        sourcePublishedAt: v.sourcePublishedAt,
        sourceObservedAt: v.sourceObservedAt,
        ingestedAt: iso(now),
        effectiveAt: v.effectiveAt,
        expiresAt: v.expiresAt,
        confidence: v.confidence,
        reliability: c.reliability,
        evidenceUrl: v.evidenceUrl,
        evidenceHash: v.evidenceHash,
        supersedesId: v.supersedesId,
        recordState: v.recordState,
        correctionReason: v.supersedesId ? v.reason : null,
      });
      await tx`insert into private.research_facts(id,event_id,source_review_id,source_item_id,source_revision,fact_type,team_id,player_id,fact_key,fact_hash,source_published_at,source_observed_at,ingested_at,effective_at,expires_at,confidence,reliability,evidence_url,evidence_hash,record_state,supersedes_id,created_by)values(${fact.id},${fact.eventId},${source.id},${fact.sourceItemId},${fact.sourceRevision},${fact.type},${fact.teamId},${fact.playerId},${researchFactKey(fact)},${researchFactHash(fact)},${fact.sourcePublishedAt},${fact.sourceObservedAt},${fact.ingestedAt},${fact.effectiveAt},${fact.expiresAt},${fact.confidence},${fact.reliability},${fact.evidenceUrl},${fact.evidenceHash},${fact.recordState},${fact.supersedesId},${who.user.id})`;
      await tx`insert into private.research_fact_payloads(fact_id,payload,retain_until)values(${fact.id},${tx.json(json(fact))},${fact.expiresAt})`;
      result = { id: fact.id };
    } else if (v.action === "snapshot") {
      result = await snapshot(tx, v.eventId, v.policyId, who);
    } else if (v.action === "content_draft") {
      const [s] =
        await tx`select * from private.research_match_snapshots where id=${v.snapshotId} for share`;
      if (!s) throw Error("Snapshot required");
      const input = await researchInputs(
        tx,
        String(s.event_id),
        String(s.policy_id),
        iso(s.as_of_time),
        s.manifest.event,
        s.manifest.evidenceFactIds,
        s.manifest.sourceReviewIds,
        s.manifest.ancestryIds,
      );
      if (input.file.snapshotHash !== s.research_hash)
        throw Error("Exact retained snapshot required");
      const draft = researchContentDraft(input.file, v.type);
      if (!draft) throw Error("Reviewed facts required");
      const [r] =
        await tx`insert into private.research_content(snapshot_id,event_id,content_type,headline,fact_ids,created_by)values(${s.id},${s.event_id},${draft.type},${draft.headline},${draft.factIds},${who.user.id})returning id`;
      result = { id: String(r.id), status: "DRAFT" };
    } else if (v.action === "content_review") {
      const [r] =
        await tx`insert into private.research_content_reviews(content_id,action,actor,reason)values(${v.id},${v.publish ? "PUBLISH" : "WITHDRAW"},${who.user.id},${v.reason})returning id`;
      result = { id: String(r.id) };
    } else if (v.action === "schedule") {
      const [r] =
        await tx`insert into private.research_schedules(source_review_id,policy_id,enabled,created_by)values(${v.sourceReviewId},${v.policyId},${v.enabled},${who.user.id})on conflict(source_review_id,policy_id)do update set enabled=excluded.enabled returning id`;
      result = { id: String(r.id) };
    } else if (v.action === "enqueue") {
      const [s] =
        await tx`select s.*,p.configuration from private.research_schedules s join private.research_policies p on p.id=s.policy_id where s.id=${v.scheduleId} for share of s`;
      const [e] =
        await tx`select * from private.events where id=${v.eventId} and competition_id='soccer_epl' and status='scheduled' and start_at>clock_timestamp() for share`;
      if (!s || !e) throw Error("Canonical upcoming EPL match required");
      const key = `research:manual:${s.id}:${e.id}:${iso(e.start_at)}:${phase5Hash(e.participants)}:${Math.floor(Date.now() / 60000)}`;
      const [r] =
        await tx`insert into private.job_runs(dedupe_key,kind,payload)values(${key},'research-update',${tx.json({ scheduleId: String(s.id), eventId: String(e.id), startAt: iso(e.start_at), participantHash: phase5Hash(e.participants), origin: "manual", actorId: who.user.id, actorSessionId: who.sessionId })})on conflict(dedupe_key)do update set dedupe_key=excluded.dedupe_key returning id`;
      result = { id: String(r.id) };
    } else {
      const [s] =
        await tx`select * from private.research_match_snapshots where id=${v.snapshotId} for share`;
      const [model] =
        await tx`select * from private.football_model_versions where id=${v.modelVersion}`;
      if (!s || !model) throw Error("Snapshot and model proposal required");
      const input = await researchInputs(
        tx,
        String(s.event_id),
        String(s.policy_id),
      );
      const featureRows =
        await tx`select id,configuration from private.research_feature_versions f where id=any(${s.feature_ids}::uuid[]) and f.id=(select x.id from private.research_feature_versions x where x.feature_key=f.feature_key order by created_at desc,id desc limit 1)`;
      const [prior] =
        await tx`select id from private.football_model_attempts where event_id=${s.event_id} and requested_model_version=${v.modelVersion} order by created_at limit 1`;
      const assessment = assessResearchRecalculation({
        eventId: String(s.event_id),
        startAt: iso(input.event.start_at),
        asOfTime: input.asOfTime,
        jurisdiction: input.policy.jurisdiction,
        modelVersion: v.modelVersion,
        modelConfigHash: String(model.config_hash),
        modelAvailable: false,
        priorPredictionId: prior ? String(prior.id) : null,
        changedFactIds: s.fact_ids,
        facts: input.facts,
        ancestry: input.ancestry,
        sources: input.sources,
        features: featureRows.map((r) =>
          validateResearchFeature(r.configuration),
        ),
      });
      const status =
        featureRows.length !== s.feature_ids.length
          ? "WITHHELD"
          : assessment.status === "NO_ACTIVE_FEATURE_CHANGE"
            ? "DISPLAY_ONLY"
            : assessment.status === "MODEL_NOT_CONFIGURED"
              ? "NOT_CONFIGURED"
              : "WITHHELD";
      const [r] =
        await tx`insert into private.research_recalculations(snapshot_id,model_version,prior_prediction_id,status,trigger_fact_ids,feature_ids,reason,actor)values(${s.id},${v.modelVersion},${prior?.id ?? null},${status},${assessment.triggerFactIds},${featureRows.map((r) => String(r.id))}::uuid[],${v.reason},${who.user.id})returning id`;
      result = { id: String(r.id), status };
    }
    await tx`insert into private.audit_events(actor,action,subject,details)values(${who.user.id},${`research_${v.action}`},${result.id},${tx.json({ reason: v.reason })})`;
    return result;
  });
}

/** Approved content only. Staff source notes, raw payloads and internal review reasons never enter this DTO. */
export async function reviewedResearch(
  options: { contentId?: string; eventId?: string; limit?: number } = {},
): Promise<ReviewedResearch> {
  if (!config().database || !config().auth)
    return { status: "NOT_CONFIGURED", items: [] };
  const who = await identity();
  if (!who) return { status: "RESTRICTED", items: [] };
  try {
    return await withCommunityActor("community_social", false, async (tx) => {
      const jurisdiction = `${who.profile.country}:${who.profile.state}`;
      const rows =
        await tx`select c.*,s.policy_id,s.event_start_at,s.event_participants,r.created_at reviewed_at from private.research_content c join private.research_match_snapshots s on s.id=c.snapshot_id join private.events e on e.id=c.event_id join lateral(select action,created_at from private.research_content_reviews x where x.content_id=c.id order by created_at desc,id desc limit 1)r on true where r.action='PUBLISH' and e.status='scheduled' and e.start_at>clock_timestamp() and e.start_at=s.event_start_at and e.participants=s.event_participants and(${options.contentId ?? null}::uuid is null or c.id=${options.contentId ?? null}) and(${options.eventId ?? null}::text is null or c.event_id=${options.eventId ?? null}) order by r.created_at desc,c.id desc limit ${Math.min(20, Math.max(1, options.limit ?? 6))}`;
      const items: ReviewedResearch["items"] = [];
      for (const r of rows) {
        const [eligible] =
          await tx`select bool_and(private.research_fact_current(f,${jurisdiction})) ok from unnest(${r.fact_ids}::text[])f`;
        if (!eligible?.ok) continue;
        const input = await researchInputs(
            tx,
            String(r.event_id),
            String(r.policy_id),
          ),
          draft = researchContentDraft(input.file, r.content_type);
        if (
          !draft ||
          !(r.fact_ids as string[]).every((id) => draft.factIds.includes(id))
        )
          continue;
        const safeFile = approvedResearchFile(
          input.file,
          r.fact_ids,
          input.policy.requiredFactTypes,
          String(r.id),
          String(r.snapshot_id),
        );
        if (!safeFile) continue;
        items.push({
          id: String(r.id),
          eventId: String(r.event_id),
          type: r.content_type,
          headline: String(r.headline),
          updatedAt: iso(r.reviewed_at),
          snapshotId: String(r.snapshot_id),
          file: safeFile,
          disclaimer: "DISPLAY_CONTEXT_ONLY",
        });
      }
      return { status: "READY", items };
    });
  } catch {
    return { status: "RESTRICTED", items: [] };
  }
}

export async function purgeResearchRetention(limit = 100) {
  const sql = db();
  return sql.begin(async (tx) => {
    const facts =
      await tx`delete from private.research_fact_payloads where fact_id in(select fact_id from private.research_fact_payloads where retain_until<=clock_timestamp() order by retain_until limit ${Math.min(500, Math.max(1, limit))})returning fact_id`;
    const datasets =
      await tx`delete from private.research_dataset_payloads where snapshot_id in(select snapshot_id from private.research_dataset_payloads where retain_until<=clock_timestamp() order by retain_until limit ${Math.min(500, Math.max(1, limit))})returning snapshot_id`;
    return { facts: facts.length, datasets: datasets.length };
  });
}
