import {
  scannerMaintenanceCountsSQL,
  scannerDailyCountsSQL,
} from "./scanner-queries";
import "server-only";
import { randomUUID } from "node:crypto";
import { db, rateLimit } from "./db";
import { requireRole } from "./auth";
import {
  loadMarketReference,
  retainMarketReference,
  type ReferenceSql,
} from "./market-reference";
import { publishReference } from "./reference-publication";
import { finishJob } from "./queue";
import { config } from "./config";
import { purgeExpiredMarketData } from "./market-data";
import { providerTrialEnvironment } from "@/core/provider-trial";
import { providerTrialDataOnly } from "./provider-trial";
import { deployedCodeCommit, frozenCodeMatches } from "@/core/code-provenance";
import {
  evaluateReference,
  validateReferenceStrategy,
} from "@/core/reference-pricing";
import { hash, type Rules } from "@/core/pricing";
import { MarketBaselineModel } from "@/providers/model";
import {
  scannerActionSchema,
  scannerCadence,
  scannerCandidateKey,
  scannerExpiry,
  scannerMetrics,
  scannerScheduleSchema,
  scannerSlot,
  scannerStrategyAllowed,
  type ScannerCandidate,
  type ScannerDashboard,
  type ScannerMetrics,
  type ScannerPurpose,
  type ScannerStatus,
} from "@/core/edge-scanner";
import type postgres from "postgres";
const readRoles = ["owner", "admin", "analyst", "auditor"];
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const zeroMetrics = (): ScannerMetrics => ({
  events: 0,
  markets: 0,
  fresh: 0,
  stale: 0,
  unknownFreshness: 0,
  candidates: 0,
  qualified: 0,
  rejected: 0,
  errors: 0,
});
async function actorClaims(
  tx: ReferenceSql,
  who: Awaited<ReturnType<typeof requireRole>>,
) {
  await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true),set_config('docked.scanner_commit',${deployedCodeCommit(process.env) ?? ""},true)`;
}
async function workerClaims(tx: ReferenceSql, job: postgres.Row) {
  await tx`select set_config('docked.scanner_job',${job.id},true),set_config('docked.scanner_lease',${job.lease_token},true),set_config('docked.scanner_commit',${deployedCodeCommit(process.env) ?? ""},true)`;
  await tx`select private.scanner_assert_worker(${job.id})`;
}
export async function scannerAlert(
  tx: ReferenceSql,
  input: {
    key: string;
    kind: string;
    message: string;
    severity?: "info" | "warning" | "critical";
    href?: string;
    payload?: Record<string, unknown>;
  },
) {
  await tx`insert into private.operational_alerts(dedupe_key,kind,severity,message,href,payload,expires_at) values(${input.key},${input.kind},${input.severity ?? "warning"},${input.message},${input.href ?? null},${tx.json(JSON.parse(JSON.stringify(input.payload ?? {})))},clock_timestamp()+interval '2 days') on conflict do nothing`;
}
function strategyState(s: postgres.Row) {
  return {
    lifecycle: s.lifecycle,
    active: s.active,
    frozen: !!s.frozen_at,
    researchApproved: !!s.research_approved_at,
    paperApproved: !!s.paper_approved_at,
    ownerApproved: !!s.owner_approved_at,
  };
}
/** The manual and automatic paths share this exact evaluator. No caller supplies odds/probability. */
async function evaluateCanonical(
  tx: ReferenceSql,
  input: {
    marketId: string;
    strategyId: string;
    regionPolicyId: string;
    purpose: ScannerPurpose;
    selection?: string;
  },
) {
  if (providerTrialEnvironment(process.env))
    return { ready: false as const, reason: "MODEL_PROBABILITY_UNAVAILABLE" };
  const [strategy] =
    await tx`select * from private.strategy_versions where id=${input.strategyId} for share`;
  if (
    !strategy ||
    !scannerStrategyAllowed(input.purpose, strategyState(strategy)) ||
    !frozenCodeMatches(strategy.code_commit, process.env)
  )
    return {
      ready: false as const,
      reason: "strategy_not_research_ready_or_code_mismatch",
    };
  const cfg = validateReferenceStrategy(strategy.config);
  if (hash(cfg) !== strategy.config_hash)
    return { ready: false as const, reason: "strategy_hash_mismatch" };
  const [policy] =
    await tx`select * from private.region_policies where id=${input.regionPolicyId} and approved and not preview_community_only and effective_from<=clock_timestamp() and least(effective_to,review_at)>clock_timestamp() for share`;
  if (
    !policy ||
    !policy.features.includes(
      input.purpose === "research" ? "market_data" : "tips",
    )
  )
    return { ready: false as const, reason: "region_approval_missing" };
  const [market] =
    await tx`select rules from private.markets where id=${input.marketId}`;
  if (!market)
    return { ready: false as const, reason: "canonical_market_missing" };
  const loaded = await loadMarketReference(
    tx,
    input.marketId,
    input.selection ?? market.rules.outcomes[0],
    input.regionPolicyId,
    cfg.marketReference,
  );
  const at = iso(loaded.market.observed_at),
    start = iso(loaded.market.start_at);
  const evaluation = evaluateReference(
    {
      rules: loaded.market.rules as Rules,
      startAt: start,
      decisionAt: at,
      sources: loaded.sources,
    },
    cfg,
  );
  const candidate = evaluation.candidates[0];
  if (
    !candidate ||
    (input.selection && candidate.selection !== input.selection)
  )
    return {
      ready: false as const,
      reason: evaluation.rejections[0]?.reason ?? "threshold_not_met",
      fresh: loaded.result.status === "READY",
      stale: evaluation.rejections.some((r) => r.reason === "stale"),
    };
  // Rebuild for the selected candidate using the same captured clock/sources.
  const model = await new MarketBaselineModel(cfg.marketReference).estimate({
    rules: loaded.market.rules as Rules,
    startAt: start,
    observedAt: at,
    selection: candidate.selection,
    sources: loaded.sources,
    asOfTime: at,
    generatedAt: at,
    codeCommit: strategy.code_commit,
  });
  if (model.status !== "READY")
    return { ready: false as const, reason: "model_unavailable" };
  if (
    input.purpose === "live" &&
    model.validationStatus !== ("VALIDATED" as string)
  )
    return { ready: false as const, reason: "model_not_validated_for_live" };
  const chosen = {
    ...loaded,
    result: {
      status: "READY" as const,
      reference: candidate.reference,
      rejections: evaluation.rejections,
    },
  };
  const referenceId = await retainMarketReference(tx, chosen);
  return {
    ready: true as const,
    loaded: chosen,
    candidate,
    strategy,
    cfg,
    referenceId,
    model,
  };
}
/** Enqueues durable scanner jobs only. Polling is a separate quota-reserved ingestion job. */
export async function scheduleEdgeScans() {
  if (process.env.EDGE_SCANNER_ENABLED !== "true") return 0;
  return db().begin(async (tx) => {
    const [flag] =
      await tx`select enabled from private.feature_flags where key='edge_scanner' for share`;
    if (!flag?.enabled) return 0;
    await tx`select set_config('docked.scanner_scheduler','true',true)`;
    const schedules =
      await tx`select * from private.scanner_schedules where enabled and (next_run is null or next_run<=clock_timestamp()) order by next_run nulls first,id for update skip locked limit 20`;
    let count = 0;
    for (const row of schedules) {
      const schedule = scannerScheduleSchema.parse(row.configuration);
      const [clock] = await tx`select clock_timestamp() now`;
      const [health] =
        await tx`select credits_remaining from private.source_health where provider=${schedule.provider}`;
      const [event] =
        await tx`select min(start_at) at from private.events where competition_id=${schedule.competition} and status='scheduled' and start_at>clock_timestamp()+interval '10 minutes'`;
      const next = scannerCadence(
        schedule,
        iso(clock.now),
        event?.at ? iso(event.at) : null,
        health?.credits_remaining == null
          ? null
          : Number(health.credits_remaining),
      );
      const key = scannerSlot(
        schedule.id,
        iso(clock.now),
        next.intervalSeconds,
      );
      const jobs =
        await tx`insert into private.job_runs(dedupe_key,kind,payload) values(${key},'edge-scan',${tx.json({ scheduleId: schedule.id, strategyId: schedule.strategyId, regionPolicyId: schedule.regionPolicyId, purpose: schedule.purpose, competition: schedule.competition, horizonSeconds: schedule.horizonSeconds, origin: "scheduled" })}) on conflict do nothing returning id`;
      await tx`update private.scanner_schedules set next_run=${next.nextAt} where id=${row.id}`;
      count += jobs.length;
    }
    return count;
  });
}
export async function runEdgeScan(job: postgres.Row) {
  if (process.env.EDGE_SCANNER_ENABLED !== "true")
    throw Error("Scanner runtime disabled");
  const sql = db(),
    payload = job.payload;
  const purpose = payload.purpose as ScannerPurpose;
  if (!["research", "paper", "live"].includes(purpose))
    throw Error("Scanner purpose required");
  const metrics = zeroMetrics(),
    rejections: { marketId: string; reason: string }[] = [],
    events = new Set<string>(),
    deadline = Date.now() + 25000;
  const [run] = await sql.begin(async (tx) => {
    await workerClaims(tx, job);
    const [existing] =
      await tx`select * from private.scanner_runs where job_id=${job.id} for update`;
    if (existing) return [existing];
    return tx`insert into private.scanner_runs(job_id,schedule_id,purpose,strategy_id,region_policy_id) values(${job.id},${payload.scheduleId ?? null},${purpose},${payload.strategyId},${payload.regionPolicyId}) returning *`;
  });
  if (run.status !== "RUNNING") return true;
  try {
    const markets = payload.marketId
      ? await sql`select m.id,m.event_id from private.markets m where m.id=${payload.marketId}`
      : await sql`select m.id,m.event_id from private.markets m join private.events e on e.id=m.event_id where e.competition_id=${payload.competition} and e.status='scheduled' and e.start_at>clock_timestamp()+interval '10 minutes' and e.start_at<=${run.started_at}::timestamptz+${Number(payload.horizonSeconds ?? 21600)}*interval '1 second' and not exists(select 1 from private.scanner_run_markets done where done.run_id=${run.id} and done.market_id=m.id) order by e.start_at,m.id limit 51`;
    for (const market of markets.slice(0, 50)) {
      if (Date.now() > deadline) {
        await sql`update private.job_runs set state='queued',available_at=clock_timestamp()+interval '1 second',lease_until=null,lease_token=null,attempts=greatest(0,attempts-1) where id=${job.id} and lease_token=${job.lease_token} and state='leased'`;
        return false;
      }
      const renewed =
        await sql`update private.job_runs set lease_until=clock_timestamp()+interval '60 seconds' where id=${job.id} and state='leased' and lease_token=${job.lease_token} and lease_until>clock_timestamp() returning id`;
      if (!renewed.length) throw Error("Scanner lease lost");
      try {
        const outcome = await sql.begin(async (tx) => {
          await workerClaims(tx, job);
          await tx`select id from private.scanner_runs where id=${run.id} for update`;
          const [done] =
            await tx`select outcome from private.scanner_run_markets where run_id=${run.id} and market_id=${market.id}`;
          if (done) return done.outcome;
          const result = await evaluateCanonical(tx, {
            marketId: market.id,
            strategyId: payload.strategyId,
            regionPolicyId: payload.regionPolicyId,
            purpose,
            selection: payload.selection,
          });
          if (!result.ready) {
            await tx`insert into private.scanner_run_markets(run_id,market_id,event_id,outcome) values(${run.id},${market.id},${market.event_id},${tx.json(result)})`;
            return result;
          }
          const c = result.candidate,
            r = c.reference;
          const key = scannerCandidateKey({
            marketId: market.id,
            strategyId: payload.strategyId,
            strategyHash: c.configHash,
            selection: c.selection,
            purpose,
            sourceIds: [
              ...r.availability.sourceIds,
              ...(r.pricing?.sourceIds ?? []),
            ],
            windowSeconds: c.window,
            regionPolicyId: payload.regionPolicyId,
          });
          const inserted =
            await tx`insert into private.scanner_candidates(dedupe_key,run_id,event_id,market_id,strategy_id,strategy_hash,code_commit,region_policy_id,purpose,selection,market_reference_id,model_version,model_evidence,probability,fair_odds,minimum_odds,required_ev,estimated_ev,window_seconds,scanned_at,expires_at,origin,created_by,warnings)
      values(${key},${run.id},${market.event_id},${market.id},${payload.strategyId},${c.configHash},${result.strategy.code_commit},${payload.regionPolicyId},${purpose},${c.selection},${result.referenceId},${result.model.modelVersion},${tx.json(result.model)},${c.probability},${c.fairOdds},${c.minimumOdds},${result.cfg.minEV},${c.ev},${c.window},${c.decisionAt},${scannerExpiry({ sourceAt: r.sourceAt, startAt: c.startAt, scannedAt: c.decisionAt, maxAgeSeconds: result.cfg.maxAgeSeconds, cutoffSeconds: result.cfg.marketReference.cutoffSeconds })},${payload.origin ?? "scheduled"},${payload.actorId ?? null},${tx.json(["Research baseline is market-derived, not validated predictive advantage."])}) on conflict(dedupe_key) do nothing returning id`;
          if (inserted.length)
            await scannerAlert(tx, {
              key: `candidate:${inserted[0].id}`,
              kind: "candidate_review",
              severity: "info",
              message:
                "A research candidate requires review. Current prices and all activation gates will be checked again.",
              href: `/admin/candidate-edges/${inserted[0].id}`,
            });
          const outcome = { ready: true as const, inserted: inserted.length };
          await tx`insert into private.scanner_run_markets(run_id,market_id,event_id,outcome) values(${run.id},${market.id},${market.event_id},${tx.json(outcome)})`;
          return outcome;
        });
        void outcome;
      } catch {
        await sql.begin(async (tx) => {
          await workerClaims(tx, job);
          await tx`insert into private.scanner_run_markets(run_id,market_id,event_id,outcome) values(${run.id},${market.id},${market.event_id},'{"ready":false,"error":true,"reason":"market_evidence_or_gate_failed"}') on conflict do nothing`;
        });
      }
    }
    if (markets.length > 50) {
      await sql`update private.job_runs set state='queued',available_at=clock_timestamp()+interval '1 second',lease_until=null,lease_token=null,attempts=greatest(0,attempts-1) where id=${job.id} and lease_token=${job.lease_token} and state='leased'`;
      return false;
    }
    const completed =
      await sql`select * from private.scanner_run_markets where run_id=${run.id}`;
    for (const row of completed) {
      const outcome = row.outcome;
      events.add(row.event_id);
      metrics.markets!++;
      if (outcome.ready) {
        metrics.fresh!++;
        metrics.qualified!++;
        metrics.candidates! += outcome.inserted;
      } else {
        metrics.rejected!++;
        if (outcome.error) metrics.errors!++;
        if (outcome.fresh) metrics.fresh!++;
        else if (outcome.stale) metrics.stale!++;
        else metrics.unknownFreshness!++;
        rejections.push({ marketId: row.market_id, reason: outcome.reason });
      }
    }
    metrics.events = events.size;
    await sql.begin(async (tx) => {
      await workerClaims(tx, job);
      const status =
        metrics.errors ||
        !metrics.markets ||
        rejections.some(
          (r) => r.reason.includes("strategy") || r.reason.includes("approval"),
        )
          ? "DEGRADED"
          : "SUCCEEDED";
      await tx`update private.scanner_runs set status=${status},metrics=${tx.json({ ...metrics, providerRequests: 0, creditsConsumed: 0 })},rejections=${tx.json(rejections)} where id=${run.id}`;
      if (status === "DEGRADED")
        await scannerAlert(tx, {
          key: `scan:${run.id}`,
          kind: "scanner_degraded",
          message:
            "Scanner completed with missing data or closed gates. Inspect the run; no provider fetch or publication was attempted.",
          href: "/admin/edge-scanner",
        });
    });
    return true;
  } catch {
    await sql.begin(async (tx) => {
      await workerClaims(tx, job);
      await tx`update private.scanner_runs set status='FAILED',metrics=${tx.json(metrics)},rejections=${tx.json(rejections)},error_code='scan_failed' where id=${run.id}`;
      await scannerAlert(tx, {
        key: `scan:${run.id}`,
        kind: "scanner_failure",
        severity: "critical",
        message:
          "Scanner failed. Evidence is retained and publication has not been attempted.",
        href: "/admin/edge-scanner",
      });
    });
    throw Error("Scanner failed; inspect sanitized run status");
  }
}
export async function scannerMaintenance() {
  const sql = db();
  await purgeExpiredMarketData();
  await sql.begin(async (tx) => {
    await tx`select set_config('docked.scanner_scheduler','true',true)`;
    const expired =
      await tx`select c.id from private.scanner_candidates c left join lateral(select status from private.scanner_reviews r where r.candidate_id=c.id order by created_at desc,id desc limit 1) s on true where c.expires_at<=clock_timestamp() and coalesce(s.status,'CANDIDATE') in ('CANDIDATE','NEEDS_REVIEW') for update of c skip locked limit 100`;
    for (const c of expired)
      await tx`insert into private.scanner_reviews(candidate_id,status,reason) values(${c.id},'EXPIRED','Source evidence expired before an authorized approval.')`;
    const [counts] = await tx.unsafe(scannerMaintenanceCountsSQL);
    const [day] =
      await tx`select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD') value`;
    for (const [kind, count] of Object.entries(counts))
      if (Number(count) > 0)
        await scannerAlert(tx, {
          key: `operations:${kind}:${day.value}`,
          kind,
          message: `${kind.replaceAll("_", " ")} requires operational review.`,
          href: "/admin/daily",
          payload: { count },
        });
  });
}
/** Authenticated scheduled endpoint and private CLI worker share these durable job records. */
export async function runScannerTick() {
  await scheduleEdgeScans();
  await scannerMaintenance();
  if (process.env.EDGE_SCANNER_ENABLED !== "true")
    return { processed: 0, status: "PAUSED" };
  const sql = db(),
    token = randomUUID();
  const [job] =
    await sql`update private.job_runs set state='leased',lease_token=${token},lease_until=clock_timestamp()+interval '60 seconds',attempts=attempts+1 where id=(select id from private.job_runs where kind='edge-scan' and (state='queued' or(state='leased' and lease_until<clock_timestamp())) and available_at<=clock_timestamp() and attempts<5 order by created_at for update skip locked limit 1) returning *`;
  if (!job) return { processed: 0, status: "IDLE" };
  const started = Date.now();
  try {
    if (!(await runEdgeScan(job))) return { processed: 0, status: "YIELDED" };
    await finishJob(job.id, token, Date.now() - started);
    return { processed: 1, status: "DONE" };
  } catch {
    await finishJob(
      job.id,
      token,
      Date.now() - started,
      "Scanner failed; inspect private run evidence",
    );
    return { processed: 1, status: "DEGRADED" };
  }
}
const candidateSelect = `select c.*,e.participants,e.start_at,e.competition_id,m.rules,co.sport_id,r.decimal_price,r.reference,coalesce(s.status,'CANDIDATE') review_status,s.publication_id from private.scanner_candidates c join private.events e on e.id=c.event_id join private.markets m on m.id=c.market_id join private.competitions co on co.id=e.competition_id join private.market_references r on r.id=c.market_reference_id left join lateral(select status,publication_id from private.scanner_reviews where candidate_id=c.id order by created_at desc,id desc limit 1)s on true`;
function candidateProjection(c: postgres.Row): ScannerCandidate {
  const status = (
    ["CANDIDATE", "NEEDS_REVIEW"].includes(c.review_status) &&
    new Date(c.expires_at).getTime() <= Date.now()
      ? "EXPIRED"
      : c.review_status
  ) as ScannerStatus;
  return {
    id: c.id,
    purpose: c.purpose,
    status,
    sport: c.sport_id,
    competition: c.competition_id,
    event: (c.participants as string[]).join(" v "),
    eventId: c.event_id,
    market: c.rules.market,
    marketId: c.market_id,
    selection: c.selection,
    probability: String(c.probability),
    fairOdds: String(c.fair_odds),
    minimumOdds: String(c.minimum_odds),
    requiredEV: String(c.required_ev),
    currentMarketReference: String(c.decimal_price),
    estimatedEV: String(c.estimated_ev),
    sourceCount: c.reference.availability.sourceCount,
    dataAgeSeconds: Math.max(
      0,
      Math.floor((Date.now() - Date.parse(c.reference.sourceAt)) / 1000),
    ),
    strategyVersion: c.strategy_id,
    modelVersion: c.model_version,
    scannedAt: iso(c.scanned_at),
    startAt: iso(c.start_at),
    expiresAt: iso(c.expires_at),
    warnings: c.warnings,
    publicationId: c.publication_id ?? null,
  };
}
export async function candidateQueue(
  input: { status?: ScannerStatus; cursor?: string } = {},
) {
  await requireRole(readRoles);
  const rows = await db().unsafe(
    `${candidateSelect} where ($1::uuid is null or (c.scanned_at,c.id)<(select scanned_at,id from private.scanner_candidates where id=$1::uuid)) and ($2::text is null or case when c.expires_at<=clock_timestamp() and coalesce(s.status,'CANDIDATE') in ('CANDIDATE','NEEDS_REVIEW') then 'EXPIRED' else coalesce(s.status,'CANDIDATE') end=$2) order by c.scanned_at desc,c.id desc limit 51`,
    [input.cursor ?? null, input.status ?? null],
  );
  return {
    status: "ready" as const,
    candidates: rows.slice(0, 50).map(candidateProjection),
    nextCursor: rows.length > 50 ? String(rows[49].id) : null,
  };
}
export async function candidateDetail(id: string) {
  await requireRole(readRoles);
  const [row] = await db().unsafe(`${candidateSelect} where c.id=$1::uuid`, [
    id,
  ]);
  return row ? candidateProjection(row) : null;
}
export async function scannerDashboard(): Promise<ScannerDashboard> {
  await requireRole(readRoles);
  const sql = db();
  const [flags, runs, schedules, health, alerts] = await Promise.all([
    sql`select enabled from private.feature_flags where key='edge_scanner'`,
    sql`select * from private.scanner_runs order by started_at desc limit 20`,
    sql`select * from private.scanner_schedules order by id`,
    sql`select provider,credits_remaining,healthy from private.source_health order by provider`,
    sql`select * from private.operational_alerts where expires_at>clock_timestamp() order by created_at desc limit 30`,
  ]);
  const enabled =
    process.env.EDGE_SCANNER_ENABLED === "true" && !!flags[0]?.enabled;
  return {
    configured: true,
    status: !enabled
      ? "PAUSED"
      : runs[0]?.status === "FAILED" ||
          runs[0]?.status === "DEGRADED" ||
          health.some((h) => !h.healthy)
        ? "DEGRADED"
        : "RUNNING",
    lastSuccessfulScan: runs.find((r) => r.status === "SUCCEEDED")?.finished_at
      ? iso(runs.find((r) => r.status === "SUCCEEDED")!.finished_at)
      : null,
    nextScheduledScan:
      schedules
        .filter((s) => s.enabled && s.next_run)
        .map((s) => iso(s.next_run))
        .sort()[0] ?? null,
    provider: health.map((h) => h.provider).join(", ") || null,
    quotaRemaining:
      health.length === 1 && health[0].credits_remaining !== null
        ? Number(health[0].credits_remaining)
        : null,
    metrics: scannerMetrics(runs[0]?.metrics),
    dataOnly: await providerTrialDataOnly(),
    schedules: schedules.map((s) => ({
      ...scannerScheduleSchema.parse(s.configuration),
      nextAt: s.next_run ? iso(s.next_run) : null,
    })),
    runs: runs.map((r) => ({
      id: r.id,
      status: r.status,
      startedAt: iso(r.started_at),
      finishedAt: r.finished_at ? iso(r.finished_at) : null,
      metrics: scannerMetrics(r.metrics),
    })),
    alerts: alerts.map((a) => ({
      id: a.id,
      kind: a.kind,
      severity: a.severity,
      message: a.message,
      createdAt: iso(a.created_at),
      href: a.href,
    })),
  };
}
export async function dailyOperations() {
  await requireRole(readRoles);
  const sql = db();
  const [counts] = await sql.unsafe(scannerDailyCountsSQL);
  const strategies =
    await sql`select id,lifecycle,active,frozen_at,research_approved_at,paper_approved_at from private.strategy_versions order by id`;
  return {
    asOf: new Date().toISOString(),
    counts,
    strategies: strategies.map((s) => ({
      id: s.id,
      state: s.lifecycle,
      active: s.active,
      researchValidated: !!s.research_approved_at,
      paperStarted: s.lifecycle === "FORWARD_PAPER",
    })),
    autoPublication: false,
    notifications: "ADMIN_ONLY_NO_EXTERNAL_SENDS" as const,
  };
}
export async function scannerOperation(value: unknown) {
  const action = scannerActionSchema.parse(value),
    manage = ["pause", "resume", "schedule"].includes(action.action);
  const who = await requireRole(
    manage ? ["owner", "admin"] : ["owner", "admin", "analyst"],
  );
  if (!(await rateLimit(`scanner:${who.user.id}`, 12, 60)))
    throw Error("Scanner action limit");
  const sql = db();
  return sql.begin(async (tx) => {
    await actorClaims(tx, who);
    await tx`select private.scanner_assert_actor(${manage})`;
    if (action.action === "pause" || action.action === "resume") {
      const enabled = action.action === "resume";
      await tx`update private.feature_flags set enabled=${enabled},reason=${action.reason},updated_by=${who.user.id},updated_at=clock_timestamp() where key='edge_scanner'`;
      await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},${action.action},'edge_scanner',${tx.json({ reason: action.reason, runtimeEnabled: process.env.EDGE_SCANNER_ENABLED === "true" })})`;
      return {
        ok: true,
        message: enabled
          ? "Schedule resumed. The server runtime and all data/research gates must also be configured."
          : "Scheduled scanner paused.",
      };
    }
    if (action.action === "schedule") {
      await tx`insert into private.scanner_schedules(id,configuration,enabled,next_run) values(${action.schedule.id},${tx.json(action.schedule)},${action.schedule.enabled},clock_timestamp()) on conflict(id) do update set configuration=excluded.configuration,enabled=excluded.enabled,next_run=excluded.next_run`;
      return {
        ok: true,
        message:
          "Durable scanner schedule saved; provider polling remains separately budgeted.",
      };
    }
    if (action.action === "run_now" || action.action === "manual_candidate") {
      let payload: Record<string, unknown>;
      if (action.action === "run_now") {
        const [row] =
          await tx`select configuration from private.scanner_schedules where id=${action.scheduleId} for share`;
        if (!row) throw Error("Schedule required");
        const s = scannerScheduleSchema.parse(row.configuration);
        payload = {
          scheduleId: s.id,
          strategyId: s.strategyId,
          regionPolicyId: s.regionPolicyId,
          purpose: s.purpose,
          competition: s.competition,
          horizonSeconds: s.horizonSeconds,
          origin: "manual",
          actorId: who.user.id,
          actorSessionId: who.sessionId,
        };
      } else
        payload = {
          ...action,
          origin: "manual",
          actorId: who.user.id,
          actorSessionId: who.sessionId,
        };
      const [clock] = await tx`select clock_timestamp() at`;
      const key = `edge-scan:manual:${who.user.id}:${hash(payload)}:${Math.floor(new Date(clock.at).getTime() / 60000)}`;
      await tx`insert into private.job_runs(dedupe_key,kind,payload) values(${key},'edge-scan',${tx.json(JSON.parse(JSON.stringify(payload)))}) on conflict do nothing`;
      await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},${action.action},'edge_scanner',${tx.json({ dedupeKey: key })})`;
      return {
        ok: true,
        message:
          "Safe scan queued durably. No publication or provider request was triggered by this action.",
      };
    }
    if (!("id" in action)) throw Error("Candidate action required");
    const [candidate] =
      await tx`select * from private.scanner_candidates where id=${action.id} for update`;
    if (!candidate) throw Error("Candidate unavailable");
    const [prior] =
      await tx`select status,publication_id from private.scanner_reviews where candidate_id=${candidate.id} order by created_at desc,id desc limit 1`;
    if (prior?.status === "APPROVED")
      return {
        ok: true,
        message: "Candidate already approved; no duplicate publication.",
        publicationId: prior.publication_id,
      };
    if (prior && !["NEEDS_REVIEW"].includes(prior.status))
      throw Error("Candidate is final");
    if (action.action === "reject") {
      await tx`insert into private.scanner_reviews(candidate_id,status,actor,reason,category) values(${candidate.id},'REJECTED',${who.user.id},${action.reason},${action.category})`;
      return {
        ok: true,
        message: "Candidate rejected. Original research evidence retained.",
      };
    }
    if (new Date(candidate.expires_at).getTime() <= Date.now()) {
      await tx`insert into private.scanner_reviews(candidate_id,status,actor,reason) values(${candidate.id},'EXPIRED',${who.user.id},'Source evidence expired before approval.')`;
      return {
        ok: false,
        message: "Candidate no longer qualifies: evidence expired.",
      };
    }
    const checked = await evaluateCanonical(tx, {
      marketId: candidate.market_id,
      strategyId: candidate.strategy_id,
      regionPolicyId: candidate.region_policy_id,
      purpose: candidate.purpose,
      selection: candidate.selection,
    });
    if (!checked.ready) {
      await tx`insert into private.scanner_reviews(candidate_id,status,actor,reason) values(${candidate.id},'INVALIDATED',${who.user.id},${`Candidate no longer qualifies: ${checked.reason}`})`;
      return {
        ok: false,
        message:
          "Candidate no longer qualifies. Fresh evidence and approval gates failed.",
      };
    }
    let publicationId: string | null = null,
      referenceId = checked.referenceId;
    if (candidate.purpose !== "research") {
      const evidence =
        candidate.purpose === "paper" ? "forward_paper" : "live_published";
      if (
        evidence === "forward_paper" ? !config().paper : !config().publication
      )
        throw Error("Publication paused; review has not activated it");
      const c = checked.candidate;
      const [legacy] =
        await tx`insert into private.candidate_decisions(event_id,strategy_id,decision_at,window_seconds,payload,rejection_reasons,status) values(${candidate.event_id},${candidate.strategy_id},${c.decisionAt},${c.window},${tx.json({ ...c, pricingModel: "market_reference_v1", marketId: candidate.market_id, regionPolicyId: candidate.region_policy_id, codeCommit: candidate.code_commit, scannerCandidateId: candidate.id })},'[]','review') on conflict do nothing returning *`;
      if (!legacy)
        throw Error(
          "Existing canonical decision requires review; no duplicate benchmark created",
        );
      publicationId = await publishReference(
        tx,
        { ...legacy, start_at: checked.loaded.market.start_at },
        checked.strategy,
        who.user.id,
        evidence,
      );
      const [published] =
        await tx`select market_reference_id from private.tip_publications where id=${publicationId}`;
      referenceId = published.market_reference_id;
    }
    await tx`insert into private.scanner_reviews(candidate_id,status,actor,reason,market_reference_id,publication_id) values(${candidate.id},'APPROVED',${who.user.id},${action.reason},${referenceId},${publicationId})`;
    return {
      ok: true,
      message:
        candidate.purpose === "research"
          ? "Research review approved. This is not an official Edge or performance record."
          : "Freshly revalidated candidate published through the existing gated immutable ledger.",
      publicationId,
    };
  });
}
