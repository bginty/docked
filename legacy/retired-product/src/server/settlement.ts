import { db } from "./db";
import { settle, type Result } from "@/core/settlement";
export async function reconcile(result: Result, actor: string) {
  if (!result.authorised || !process.env.RESULTS_RIGHTS_REFERENCE)
    throw new Error("Authorised results rights required");
  const sql = db();
  return sql.begin(async (tx) => {
    const tips =
      await tx`select p.id,p.selection,p.market_rules,e.start_at from private.tip_publications p join private.events e on e.id=p.event_id where p.event_id=${result.eventId}`;
    for (const tip of tips) {
      if (
        new Date(tip.start_at).getTime() > Date.now() ||
        !Number.isFinite(Date.parse(result.observedAt)) ||
        Date.parse(result.observedAt) > Date.now()
      )
        throw new Error("Premature/future settlement evidence");
      const outcome = settle(tip.market_rules, tip.selection, result);
      if (outcome === "pending") continue;
      const previous =
        await tx`select * from private.settlement_events where tip_id=${tip.id} order by created_at desc limit 1`;
      if (previous[0]) {
        const old = previous[0];
        if (
          old.source === result.source &&
          old.source_event_id === result.sourceEventId &&
          old.revision === result.revision &&
          old.result === outcome
        )
          continue;
        throw new Error(
          "Changed or contradictory result requires explicit correction review",
        );
      }
      await tx`insert into private.settlement_events(tip_id,result,source,source_event_id,revision,evidence) values(${tip.id},${outcome},${result.source},${result.sourceEventId},${result.revision},${tx.json(result)}) on conflict do nothing`;
      await tx`insert into private.audit_events(actor,action,subject) values(${actor},'settlement_reconciliation',${tip.id})`;
    }
  });
}
