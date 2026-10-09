import "server-only";
import Decimal from "decimal.js";
import { z } from "zod";
import { db } from "./db";
import { requireRole } from "./auth";
import { config } from "./config";
import { regionAccess } from "./queries";
import type { ReferenceSql } from "./market-reference";
import { deployedCodeCommit } from "@/core/code-provenance";
import {
  footballModelLifecycle,
  footballModelProposal,
} from "@/core/football-model";
import { footballCalibration } from "@/core/model-calibration";
import { phase5Hash } from "@/core/phase5-hash";
import { hash } from "@/core/pricing";
import { fittedFootballPrediction } from "./football-fitted";
import {
  validateFootballEdgeStrategy,
  type FootballPredictionEvidence,
} from "@/core/football-edge";
import type {
  OfficialDockedRecord,
  OfficialRecordRow,
} from "@/core/official-docked-record";
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const readRoles = ["owner", "admin", "analyst", "auditor"];
const reason = z.string().trim().min(12).max(2000),
  commit = z.string().regex(/^[a-f0-9]{40}$/);
async function actor(
  tx: ReferenceSql,
  who: Awaited<ReturnType<typeof requireRole>>,
) {
  await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true),set_config('docked.scanner_commit',${deployedCodeCommit(process.env) ?? ""},true)`;
}
/** Current release accepts a descriptive proposal only. No coefficients or estimator are registered. */
export async function createModelVersion(input: unknown) {
  const v = z
    .object({ configuration: z.unknown(), codeCommit: commit, reason })
    .strict()
    .parse(input);
  const proposal = z
    .object({
      modelId: z.literal("football-goals"),
      modelVersion: z.string().regex(/^football-goals-v\d+\.\d+\.\d+$/),
      sport: z.literal("football"),
      market: z.literal("regulation_1x2"),
      proposedMethod: z.literal("independent-poisson-goals"),
      state: z.literal("DRAFT"),
      validationStatus: z.literal("UNVALIDATED"),
      parameters: z.null(),
      trainingDataHash: z.null(),
      operationalStatus: z.literal("NOT_CONFIGURED"),
      advantageClaim: z.literal(false),
    })
    .strict()
    .parse(v.configuration);
  if (v.codeCommit !== deployedCodeCommit(process.env))
    throw Error("Current deployed code review required");
  const who = await requireRole(["owner", "admin"]);
  return db().begin(async (tx) => {
    await actor(tx, who);
    await tx`insert into private.football_model_versions(id,method,configuration,config_hash,code_commit,created_by) values(${proposal.modelVersion},'independent-football-model',${tx.json(proposal)},${phase5Hash(proposal)},${v.codeCommit},${who.user.id})`;
    await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'football_model_created',${proposal.modelVersion},${tx.json({ reason: v.reason, configHash: phase5Hash(proposal) })})`;
    return { id: proposal.modelVersion, lifecycle: "DRAFT" };
  });
}
export async function transitionModelVersion(input: unknown) {
  const v = z
      .object({
        id: z.string().min(1).max(120),
        to: z.enum(footballModelLifecycle),
        reason,
        evidence: z.record(z.string(), z.unknown()),
      })
      .strict()
      .parse(input),
    who = await requireRole(["owner", "admin"]);
  return db().begin(async (tx) => {
    await actor(tx, who);
    const [row] =
      await tx`select private.transition_football_model(${v.id},${v.to},${v.reason},${tx.json(JSON.parse(JSON.stringify(v.evidence)))}) lifecycle`;
    return { id: v.id, lifecycle: String(row.lifecycle) };
  });
}
export async function approveFootballPolicy(input: unknown) {
  const v = z
      .object({ strategyId: z.string().min(1).max(160), reason })
      .strict()
      .parse(input),
    who = await requireRole(["owner", "admin"]);
  return db().begin(async (tx) => {
    await actor(tx, who);
    const [s] =
      await tx`select * from private.strategy_versions where id=${v.strategyId} for share`;
    if (!s) throw Error("Strategy missing");
    const cfg = validateFootballEdgeStrategy(s.config);
    if (hash(cfg) !== s.config_hash) throw Error("Strategy hash mismatch");
    await tx`insert into private.football_edge_policy_approvals(strategy_id,model_version,config_hash,code_commit,actor,reason) values(${s.id},${cfg.modelVersion},${s.config_hash},${s.code_commit},${who.user.id},${v.reason})`;
    return { strategyId: s.id, approved: true };
  });
}
export async function createFootballPolicy(input: unknown) {
  const v = z
      .object({ configuration: z.unknown(), codeCommit: commit, reason })
      .strict()
      .parse(input),
    configuration = validateFootballEdgeStrategy(v.configuration);
  if (v.codeCommit !== deployedCodeCommit(process.env))
    throw Error("Current deployed policy code review required");
  const who = await requireRole(["owner", "admin"]);
  return db().begin(async (tx) => {
    await actor(tx, who);
    const [model] =
      await tx`select id from private.football_model_versions where id=${configuration.modelVersion} and code_commit=${v.codeCommit} for share`;
    if (!model) throw Error("Matching registered model version required");
    await tx`insert into private.strategy_versions(id,config,config_hash,code_commit,football_model_version) values(${configuration.version},${tx.json(configuration)},${hash(configuration)},${v.codeCommit},${configuration.modelVersion})`;
    await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'football_policy_created',${configuration.version},${tx.json({ reason: v.reason, configHash: hash(configuration), modelVersion: configuration.modelVersion })})`;
    return { strategyId: configuration.version, active: false };
  });
}
export async function setFootballPolicyActive(input: unknown) {
  const v = z
      .object({
        strategyId: z.string().min(1).max(160),
        active: z.boolean(),
        reason,
      })
      .strict()
      .parse(input),
    who = await requireRole(["owner", "admin"]);
  return db().begin(async (tx) => {
    await actor(tx, who);
    const [row] =
      await tx`select private.set_football_policy_active(${v.strategyId},${v.active},${v.reason}) active`;
    return { strategyId: v.strategyId, active: Boolean(row.active) };
  });
}
export type RetainedFootballPrediction =
  | { status: "READY"; prediction: FootballPredictionEvidence }
  | { status: "ABSTAIN" | "NOT_CONFIGURED"; id: string; reason: string };
/** Own transaction is deliberately committed before the caller obtains any market prices. */
export async function recordFootballPrediction(input: {
  modelVersion: string;
  eventId: string;
  windowSeconds: number;
  jobId: string;
  leaseToken: string;
  idempotencyKey: string;
}): Promise<RetainedFootballPrediction> {
  const v = z
    .object({
      modelVersion: z.string().min(1).max(120),
      eventId: z.string().min(1),
      windowSeconds: z.number().int().positive(),
      jobId: z.uuid(),
      leaseToken: z.uuid(),
      idempotencyKey: z.string().min(1).max(240),
    })
    .strict()
    .parse(input);
  const code = deployedCodeCommit(process.env);
  if (!code) throw Error("Deployed model code provenance unavailable");
  const result = await db().begin(async (tx) => {
    await tx`select set_config('docked.scanner_job',${v.jobId},true),set_config('docked.scanner_lease',${v.leaseToken},true),set_config('docked.scanner_commit',${code},true)`;
    await tx`select private.scanner_assert_worker(${v.jobId})`;
    await tx`select pg_advisory_xact_lock(hashtext(${JSON.stringify([v.eventId, v.modelVersion, v.windowSeconds])}))`;
    await tx`select private.scanner_assert_worker(${v.jobId})`;
    const [existing] =
      await tx`select * from private.football_model_attempts where idempotency_key=${v.idempotencyKey} or(event_id=${v.eventId} and requested_model_version=${v.modelVersion} and window_seconds=${v.windowSeconds})`;
    if (existing) {
      if (
        existing.event_id !== v.eventId ||
        existing.requested_model_version !== v.modelVersion ||
        existing.window_seconds !== v.windowSeconds
      )
        throw Error("Prediction idempotency conflict");
      return {
        id: String(existing.id),
        status: existing.status,
        reason: existing.reason,
      };
    }
    const fitted = await fittedFootballPrediction(
      tx,
      v.eventId,
      v.modelVersion,
      code,
    );
    if (fitted) {
      const { row: retained, result: calculated, asOfTime } = fitted;
      const ready = calculated.status === "PREDICTED";
      const [row] =
        await tx`insert into private.football_model_attempts(idempotency_key,job_id,event_id,requested_model_version,model_version,input_snapshot_id,window_seconds,status,probabilities,quality,reason,config_hash,input_hash,code_commit,as_of_time,calculated_at,input_cutoff,provenance)
        values(${v.idempotencyKey},${v.jobId},${v.eventId},${v.modelVersion},${v.modelVersion},${retained.input_id},${v.windowSeconds},${ready ? "READY" : "ABSTAIN"},${ready ? tx.json(calculated.probabilities) : null},${tx.json({ status: ready ? "READY" : "INSUFFICIENT_DATA", validationStatus: "UNVALIDATED" })},${ready ? null : calculated.reason},${retained.config_hash},${retained.input_hash},${code},${asOfTime},clock_timestamp(),${retained.input_cutoff}::text::timestamptz,${tx.json({ implementation: "regularised-independent-poisson-v1", manifestId: retained.payload.manifestId, fittedHash: retained.fitted_hash, independentInputRequired: true, advantageClaim: false })}) returning id,status,reason`;
      return { id: String(row.id), status: row.status, reason: row.reason };
    }
    // Unconfigured models still abstain. Callers cannot supply probabilities.
    const [row] =
      await tx`insert into private.football_model_attempts(idempotency_key,job_id,event_id,requested_model_version,window_seconds,status,quality,reason,code_commit,as_of_time,calculated_at,provenance) values(${v.idempotencyKey},${v.jobId},${v.eventId},${v.modelVersion},${v.windowSeconds},'NOT_CONFIGURED',${tx.json({ status: "NO_AUTHORISED_DATA", missingRequired: ["authorised_sporting_dataset", "reviewed_model_parameters", "fitted_estimator"] })},'MODEL_PROBABILITY_UNAVAILABLE',${code},clock_timestamp(),clock_timestamp(),${tx.json({ provider: "NotConfiguredFootballModelProvider", independentInputRequired: true, advantageClaim: false })}) returning id,status,reason`;
    return { id: String(row.id), status: row.status, reason: row.reason };
  });
  if (result.status === "READY")
    return db().begin((tx) => readModelPredictionForComparison(tx, result.id));
  return {
    status: result.status as "ABSTAIN" | "NOT_CONFIGURED",
    id: result.id,
    reason: String(result.reason),
  };
}
export async function readModelPredictionForComparison(
  tx: ReferenceSql,
  id: string,
): Promise<RetainedFootballPrediction> {
  const [p] =
    await tx`select p.*,e.start_at,e.participants from private.football_model_attempts p join private.events e on e.id=p.event_id where p.id=${id} for share of p,e`;
  if (!p) throw Error("Retained prediction missing");
  if (p.status !== "READY")
    return { status: p.status, id: String(p.id), reason: String(p.reason) };
  await tx`select private.assert_football_prediction(${p.id})`;
  return {
    status: "READY",
    prediction: {
      id: p.id,
      eventId: p.event_id,
      modelVersion: p.model_version,
      codeCommit: p.code_commit,
      configHash: p.config_hash,
      inputHash: p.input_hash,
      asOfTime: iso(p.as_of_time),
      calculatedAt: iso(p.calculated_at),
      recordedAt: iso(p.created_at),
      dataCutoff: iso(p.input_cutoff),
      startAt: iso(p.start_at),
      homeTeam: p.participants[0],
      awayTeam: p.participants[1],
      probabilities: p.probabilities,
      quality: "READY",
    },
  };
}
/** Database function revalidates candidate/model/reference and creates the canonical publication atomically. */
export async function publishFootballCandidate(
  tx: ReferenceSql,
  candidateId: string,
  referenceId?: string,
) {
  const [row] =
    await tx`select private.publish_football_candidate(${candidateId},${referenceId ?? null}::uuid) id`;
  return String(row.id);
}
export async function modelDashboard(
  options: { modelVersion?: string; windowSeconds?: number } = {},
) {
  await requireRole(readRoles);
  const empty = {
    versions: [] as {
      id: string;
      lifecycle: string;
      configHash: string;
      codeCommit: string;
      createdAt: string;
      changedAt: string;
    }[],
    attempts: null as {
      total: number;
      ready: number;
      abstained: number;
      notConfigured: number;
    } | null,
    calibration: null as ReturnType<typeof footballCalibration> | null,
    implementationStatus: "NOT_CONFIGURED" as const,
    predictions: [] as {
      id: string;
      eventId: string;
      status: string;
      modelVersion: string;
      recordedAt: string;
      probabilities: { home: string; draw: string; away: string } | null;
      fairOdds: { home: string; draw: string; away: string } | null;
      reason: string | null;
    }[],
    fits: [] as {
      modelVersion: string;
      fittedHash: string;
      trainingHash: string;
      fittedAt: string;
      diagnostics: Record<string, unknown>;
    }[],
    selectedModel: options.modelVersion ?? null,
    selectedWindow: options.windowSeconds ?? null,
    proposal: footballModelProposal,
  };
  if (!config().database)
    return { status: "NOT_CONFIGURED" as const, ...empty };
  try {
    const sql = db(),
      versions =
        await sql`select * from private.football_model_versions order by created_at,id`,
      a =
        await sql`select p.*,p.event_start_at start_at from private.football_model_attempts p where (${options.modelVersion ?? null}::text is null or p.requested_model_version=${options.modelVersion ?? null}) and (${options.windowSeconds ?? null}::integer is null or p.window_seconds=${options.windowSeconds ?? null}) order by p.created_at,p.id`;
    const counts = {
      total: a.length,
      ready: a.filter((r) => r.status === "READY").length,
      abstained: a.filter((r) => r.status === "ABSTAIN").length,
      notConfigured: a.filter((r) => r.status === "NOT_CONFIGURED").length,
    };
    const fits =
      await sql`select model_version,fitted_hash,training_hash,fitted_at,fitted->'diagnostics' diagnostics from private.football_training_manifests order by fitted_at desc`;
    let calibration: ReturnType<typeof footballCalibration> | null = null;
    if (options.modelVersion && options.windowSeconds && a.length) {
      const outcomes =
        await sql`select o.*,p.event_id,e.start_at,s.rights_reference from private.football_model_outcomes o join private.football_model_attempts p on p.id=o.prediction_id join private.events e on e.id=p.event_id join private.football_sporting_sources s on s.id=o.source_id where p.requested_model_version=${options.modelVersion} and p.window_seconds=${options.windowSeconds} order by o.created_at,o.id`;
      calibration = footballCalibration({
        modelVersion: options.modelVersion,
        decisionWindow: String(options.windowSeconds),
        from: iso(a[0].as_of_time),
        to: new Date().toISOString(),
        asOfTime: new Date().toISOString(),
        attempts: a.map((p) => ({
          id: p.id,
          eventId: p.event_id,
          modelVersion: p.requested_model_version,
          decisionWindow: String(p.window_seconds),
          asOfTime: iso(p.as_of_time),
          recordedAt: iso(p.created_at),
          startAt: iso(p.start_at),
          status:
            p.status === "READY"
              ? "PREDICTED"
              : p.status === "ABSTAIN"
                ? "ABSTAINED"
                : "NOT_CONFIGURED",
          probabilities: p.probabilities,
        })),
        outcomes: outcomes.map((o) => {
          return {
            id: o.id,
            eventId: o.event_id,
            revision: Number(o.sequence),
            supersedesId: o.corrects,
            knownAt: iso(o.created_at),
            completedAt: iso(o.observed_at),
            sourceId: o.source_id,
            rightsReference: o.rights_reference,
            result: o.result,
          };
        }),
      });
    }
    return {
      ...empty,
      status: "READY" as const,
      versions: versions.map((v) => ({
        id: String(v.id),
        lifecycle: String(v.lifecycle),
        configHash: String(v.config_hash),
        codeCommit: String(v.code_commit),
        createdAt: iso(v.created_at),
        changedAt: iso(v.changed_at),
      })),
      attempts: counts,
      calibration,
      implementationStatus: fits.length
        ? "RESEARCH_FITTED_UNVALIDATED"
        : "NOT_CONFIGURED",
      fits: fits.map((f) => ({
        modelVersion: String(f.model_version),
        fittedHash: String(f.fitted_hash),
        trainingHash: String(f.training_hash),
        fittedAt: iso(f.fitted_at),
        diagnostics: f.diagnostics,
      })),
      predictions: a.map((p) => ({
        id: String(p.id),
        eventId: String(p.event_id),
        status: String(p.status),
        modelVersion: String(p.requested_model_version),
        recordedAt: iso(p.created_at),
        probabilities: p.probabilities,
        fairOdds: p.fair_odds,
        reason: p.reason,
      })),
    };
  } catch {
    return { status: "UNAVAILABLE" as const, ...empty };
  }
}
export async function modelMethodologyChanges() {
  if (!config().database) return [];
  try {
    return (
      await db()`select t.model_version,t.to_state,t.created_at from private.football_model_transitions t order by t.created_at desc,t.id desc`
    ).map((r) => ({
      modelVersion: String(r.model_version),
      state: String(r.to_state),
      reason: `Model lifecycle changed to ${String(r.to_state)}.`,
      effectiveAt: iso(r.created_at),
    }));
  } catch {
    return [];
  }
}

/** Current private research view only; historical snapshots must not receive later predictions. */
export async function fittedMatchResearch(eventId: string) {
  try {
    await requireRole(readRoles);
    if (!config().database) return null;
    const [p] = await db()`select p.id,p.status,p.reason,p.model_version,p.probabilities,p.fair_odds,p.created_at,
      i.payload,t.fitted,t.fitted_hash,t.training_hash,t.input_cutoff
      from private.football_model_attempts p join private.football_sporting_inputs i on i.id=p.input_snapshot_id
      join private.football_training_manifests t on t.model_version=p.model_version
      where p.event_id=${eventId} order by p.created_at desc,p.id desc limit 1`;
    if (!p || phase5Hash(p.fitted) !== p.fitted_hash) return null;
    const home = p.fitted.teams.indexOf(p.payload.event.homeTeamId), away = p.fitted.teams.indexOf(p.payload.event.awayTeamId), n = p.fitted.teams.length;
    if (home < 0 || away < 0) return null;
    return { id: String(p.id), status: String(p.status), reason: p.reason as string | null, modelVersion: String(p.model_version),
      probabilities: p.probabilities as { home: string; draw: string; away: string } | null,
      fairOdds: p.fair_odds as { home: string; draw: string; away: string } | null,
      recordedAt: iso(p.created_at), dataCutoff: iso(p.input_cutoff), trainingHash: String(p.training_hash),
      strengths: { homeAttack: Math.exp(p.fitted.parameters[2 + home]), homeDefenceWeakness: Math.exp(p.fitted.parameters[2 + n + home]),
        awayAttack: Math.exp(p.fitted.parameters[2 + away]), awayDefenceWeakness: Math.exp(p.fitted.parameters[2 + n + away]), homeAdvantage: Math.exp(p.fitted.parameters[1]) } };
  } catch { return null; }
}
export async function officialDockedRecord(): Promise<OfficialDockedRecord> {
  const empty = { officialRecordStart: null, rows: [] };
  if (!config().database) return { status: "NOT_CONFIGURED", ...empty };
  try {
    const sql = db(),
      [boundary] =
        await sql`select started_at from private.official_record_boundary where singleton`;
    if (!boundary) return { status: "READY", ...empty };
    const start = boundary ? iso(boundary.started_at) : null,
      access = await regionAccess("tips");
    if (!access.allowed)
      return { status: "RESTRICTED", officialRecordStart: start, rows: [] };
    const rows =
      await sql`select t.*,o.model_version,e.competition_id,e.participants,s.result,s.created_at settled_at,(select count(*)::integer from private.correction_events c where c.tip_id=t.id) corrections from private.official_docked_publications o join private.tip_publications t on t.id=o.tip_id join private.events e on e.id=t.event_id left join lateral(select result,created_at from private.settlement_events where tip_id=t.id order by created_at desc,id desc limit 1)s on true where t.evidence='live_published' and private.publication_region_matches(t.region_policy_id,${access.policy}::uuid) order by t.published_at desc,t.id desc`;
    return {
      status: "READY",
      officialRecordStart: start,
      rows: rows.map(
        (r) =>
          ({
            publicationId: String(r.id),
            eventId: String(r.event_id),
            publishedAt: iso(r.published_at),
            selection: String(r.selection),
            odds: String(r.odds),
            estimatedEv:
              r.estimated_ev === null ? null : String(r.estimated_ev),
            benchmarkStake: "1",
            evidence: "live_published",
            result: r.result ?? "pending",
            netUnits:
              r.result === "won"
                ? new Decimal(r.odds).minus(1).toString()
                : r.result === "lost"
                  ? "-1"
                  : r.result === "void"
                    ? "0"
                    : null,
            settledAt: r.settled_at ? iso(r.settled_at) : null,
            correctionCount: Number(r.corrections),
            modelVersion: String(r.model_version),
            competition: String(r.competition_id),
            eventLabel: r.participants.join(" v "),
          }) satisfies OfficialRecordRow,
      ),
    };
  } catch {
    return { status: "UNAVAILABLE", ...empty };
  }
}
