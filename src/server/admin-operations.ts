import { z } from "zod";
import { db } from "./db";
import { requireRole } from "./auth";
import {
  referenceStrategyV2,
  validateReferenceStrategy,
} from "@/core/reference-pricing";
import { configuredMarketReference } from "./market-reference";
import { strategyV1, hash } from "@/core/pricing";
import { DateTime } from "luxon";
import { nextScheduleAt } from "@/core/notifications";
export async function adminOperation(body: Record<string, unknown>) {
  const who = await requireRole(["owner", "admin"]);
  const sql = db();
  const reason = z.string().min(12).max(2000).parse(body.reason);
  if (body.action === "schedule") {
    const v = z
      .object({
        id: z.string().min(1),
        enabled: z.boolean(),
        hour: z.coerce.number().int().min(0).max(23),
        minute: z.coerce.number().int().min(0).max(59),
        zone: z.string().refine((x) => DateTime.now().setZone(x).isValid),
      })
      .parse(body);
    await sql.begin(async (tx) => {
      const old =
        await tx`select config from private.schedules where id=${v.id} for update`;
      if (!old[0]) throw new Error("Seed schedules first");
      const schedule = {
        ...old[0].config,
        hour: v.hour,
        minute: v.minute,
        zone: v.zone,
        enabled: v.enabled,
      };
      await tx`update private.schedules set config=${tx.json(schedule)},enabled=${v.enabled},next_run=${nextScheduleAt(schedule, new Date().toISOString())},updated_by=${who.user.id} where id=${v.id}`;
      await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'schedule_edit',${v.id},${tx.json({ reason })})`;
    });
    return "Schedule updated.";
  }
  if (body.action === "suspend_region") {
    const id = z.string().uuid().parse(body.id);
    await sql.begin(async (tx) => {
      await tx`update private.region_policies set approved=false where id=${id}`;
      await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'region_suspended',${id},${tx.json({ reason })})`;
    });
    return "Region suspended.";
  }
  if (body.action === "suspend_provider") {
    const id = z.string().min(1).parse(body.id);
    await sql.begin(async (tx) => {
      await tx`update private.source_health set healthy=false,circuit_until=now()+interval '100 years',failure_reason=${reason} where provider=${id}`;
      await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'provider_suspended',${id},${tx.json({ reason })})`;
    });
    return "Provider suspended.";
  }
  if (body.action === "strategy_create") {
    const v = z
      .object({
        id: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,80}$/),
        codeCommit: z.string().regex(/^[0-9a-f]{40}$/),
      })
      .parse(body);
    const strategy =
      body.pricingModel === "market_reference_v1"
        ? validateReferenceStrategy({
            ...referenceStrategyV2,
            version: v.id,
            marketReference: configuredMarketReference(),
          })
        : { ...strategyV1, version: v.id };
    await sql.begin(async (tx) => {
      await tx`insert into private.strategy_versions(id,config,config_hash,code_commit) values(${v.id},${tx.json(strategy)},${hash(strategy)},${v.codeCommit})`;
      await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'strategy_draft_created',${v.id},${tx.json({ reason, codeCommit: v.codeCommit, configHash: hash(strategy) })})`;
    });
    return "Draft created. A different material configuration requires a separately reviewed code version and research.";
  }
  if (body.action === "strategy_transition") {
    const v = z
      .object({
        id: z.string().min(1),
        to: z.enum([
          "RESEARCH",
          "VALIDATED",
          "FROZEN_FOR_FORWARD_PAPER",
          "FORWARD_PAPER",
          "APPROVED_FOR_LIVE",
          "RETIRED",
        ]),
        codeCommit: z.string().regex(/^[0-9a-f]{40}$/),
        validationRun: z.union([z.string().uuid(), z.literal("")]).optional(),
      })
      .parse(body);
    const result =
      await sql`select private.transition_strategy(${v.id},${v.to},${who.user.id},${reason},${v.codeCommit},${v.validationRun || null}::uuid) state`;
    return `Strategy moved to ${result[0].state}. Data, region and publication switches remain independent gates.`;
  }
  if (body.action === "correction") {
    await requireRole(["owner", "admin"]);
    const v = z
      .object({
        id: z.string().uuid(),
        result: z.enum(["won", "lost", "void", "disputed"]),
        source: z.string().min(3),
        sourceEventId: z.string().min(1),
        revision: z.string().min(1),
        evidence: z.string().min(12),
      })
      .parse(body);
    if (!process.env.RESULTS_RIGHTS_REFERENCE)
      throw new Error("Results rights required");
    await sql.begin(async (tx) => {
      const old =
        await tx`select * from private.settlement_events where tip_id=${v.id} order by created_at desc limit 1 for update`;
      if (!old[0]) throw new Error("No original settlement");
      const next =
        await tx`insert into private.settlement_events(tip_id,result,source,source_event_id,revision,evidence) values(${v.id},${v.result},${v.source},${v.sourceEventId},${v.revision},${tx.json({ reference: v.evidence, rights: process.env.RESULTS_RIGHTS_REFERENCE })}) returning id`;
      await tx`insert into private.correction_events(tip_id,settlement_id,replacement_settlement_id,reason,actor) values(${v.id},${old[0].id},${next[0].id},${reason},${who.user.id})`;
    });
    return "Visible correction appended. Original evidence preserved.";
  }
  if (body.action === "retry_job") {
    const id = z.string().uuid().parse(body.id);
    await sql.begin(async (tx) => {
      await tx`update private.job_runs set state='queued',attempts=0,available_at=now(),lease_until=null,lease_token=null where id=${id} and state='dead'`;
      await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'retry_dead_job',${id},${tx.json({ reason })})`;
    });
    return "Dead job queued for a reviewed retry.";
  }
  throw new Error("Unsupported operation");
}
