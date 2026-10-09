import type postgres from "postgres";
import type { JSONValue } from "postgres";
import type { MarketDataRequestAuthority } from "@/providers/market-data";
import {
  newTrialProgress,
  type TrialProgress,
} from "@/core/provider-trial-diagnostics";
import { reservedTransaction } from "./reserved-transaction";
import { completeTrialRequestSQL } from "./provider-trial-queries";
type Sql = postgres.ReservedSql;
/** Shared committed quota reservation. The provider adapter cannot request before this resolves. */
export function trialRequestAuthority(
  sql: Sql,
  pollId: string,
  permitId: string,
  tokenHash: string,
  key: string,
  progress: TrialProgress = newTrialProgress(),
): MarketDataRequestAuthority {
  return {
    key,
    reserve: async (cost, scope) => {
      progress.stage = "RESERVING";
      await sql`select private.reserve_provider_trial(${permitId},${tokenHash},${scope},${cost},${pollId})`;
      progress.stage = "RESERVED";
    },
    observeQuota: async (q) => {
      progress.stage = "QUOTA_PERSISTENCE";
      await reservedTransaction(sql, async (tx) => {
        const [request] =
          await tx`select r.* from private.provider_trial_requests r join private.provider_trials t on t.id=r.trial_id where r.permit_id=${permitId} and r.poll_run_id=${pollId} for update of t,r`;
        if (!request || request.headers_at || request.completed_at)
          throw Error("Trial response authority unavailable");
        const extra = Math.max(
          0,
          (q.lastRequestCost ?? request.reserved_credits) -
            request.reserved_credits,
        );
        await tx`update private.provider_trial_requests set reported_credits=${q.lastRequestCost},remaining=${q.remaining},used=${q.used},headers_at=clock_timestamp() where id=${request.id}`;
        await tx`update private.provider_poll_runs set quota_charge=quota_charge+${extra} where id=${pollId}`;
        await tx`update private.source_health set credits_remaining=case when ${q.remaining}::bigint is not null then ${q.remaining}::bigint when credits_remaining is null then null else greatest(0,credits_remaining-${extra}) end,credits_used=coalesce(${q.used},credits_used),healthy=case when ${q.remaining}::bigint=0 then false else healthy end,failure_reason=case when ${q.remaining}::bigint=0 then 'provider_quota_exhausted' else failure_reason end,circuit_until=case when ${extra}>0 then clock_timestamp()+interval '30 days' else circuit_until end where provider='the-odds-api'`;
      });
      progress.stage = "PAYLOAD_VALIDATION";
      if (q.lastRequestCost !== null && q.lastRequestCost > q.reservedCost)
        throw Error("Provider cost differed from reviewed reservation");
    },
  };
}
export async function completeTrialRequest(
  sql: Sql,
  permitId: string,
  pollId: string,
  success: boolean,
  diagnostics: Record<string, unknown>,
) {
  const rows = await sql.unsafe(completeTrialRequestSQL, [
    permitId,
    pollId,
    success ? "SUCCESS" : "FAILED",
    success ? null : "TRIAL_REQUEST_FAILED",
    sql.json(diagnostics as JSONValue),
  ]);
  return rows.length === 1;
}
