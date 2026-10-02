import { z } from "zod";
import { db } from "./db";
import { requireRole } from "./auth";
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
  if (body.action === "strategy_activate") {
    await requireRole(["owner"]);
    const v = z
      .object({
        id: z.string(),
        researchRun: z.string().uuid(),
        paperRun: z.string().uuid(),
      })
      .parse(body);
    await sql.begin(async (tx) => {
      const runs =
        await tx`select id,evidence,contaminated from private.validation_runs where strategy_id=${v.id} and id in (${v.researchRun},${v.paperRun})`;
      if (
        !runs.some(
          (r) =>
            r.id === v.researchRun &&
            r.evidence === "retrospective_backtest" &&
            !r.contaminated,
        ) ||
        !runs.some((r) => r.id === v.paperRun && r.evidence === "forward_paper")
      )
        throw new Error("Reviewed research and forward paper required");
      const updated =
        await tx`update private.strategy_versions set active=true,research_approved_at=now(),paper_approved_at=now(),owner_approved_at=now(),approval_evidence=${reason} where id=${v.id} and frozen_at is not null and config_hash=${hash(strategyV1)} returning id`;
      if (!updated.length) throw new Error("Strategy/config mismatch");
      await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'strategy_owner_approval',${v.id},${tx.json({ reason, researchRun: v.researchRun, paperRun: v.paperRun })})`;
    });
    return "Strategy activated with evidence references. Global publication remains separately controlled.";
  }
  if (body.action === "strategy_paper_start") {
    await requireRole(["owner"]);
    const v = z
      .object({ id: z.string(), researchRun: z.string().uuid() })
      .parse(body);
    await sql.begin(async (tx) => {
      const run =
        await tx`select id from private.validation_runs where id=${v.researchRun} and strategy_id=${v.id} and evidence='retrospective_backtest' and not contaminated`;
      if (!run.length) throw new Error("Reviewed research required");
      const changed =
        await tx`update private.strategy_versions set active=true,research_approved_at=now(),approval_evidence=${reason} where id=${v.id} and config_hash=${hash(strategyV1)} and frozen_at is not null returning id`;
      if (!changed.length) throw new Error("Frozen strategy missing");
      await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'forward_paper_start',${v.id},${tx.json({ reason, researchRun: v.researchRun })})`;
    });
    return "Prospective paper research enabled. Live release still requires paper and owner approval.";
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
