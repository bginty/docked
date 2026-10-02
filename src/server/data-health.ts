import { db } from "./db";
import { config } from "./config";
import { providerReadiness, freshTimestamp } from "@/core/data-health";
export async function dataHealth() {
  const base = {
    oddsStatus: providerReadiness(process.env, "odds"),
    resultsStatus: providerReadiness(process.env, "results"),
    database: config().database,
    providers: [] as Record<string, unknown>[],
    polls: [] as Record<string, unknown>[],
    candidateCount: null as number | null,
    incidents: [] as string[],
  };
  if (!base.database) return base;
  try {
    const sql = db();
    const [providers, polls, candidates, jobs, observations] =
      await Promise.all([
        sql`select provider,healthy,last_success,last_failure,credits_remaining,credits_used,failure_reason,circuit_until,diagnostics from private.source_health order by provider`,
        sql`select provider,sport,status,diagnostics,error_code,quota_charge,started_at,completed_at from private.provider_poll_runs order by started_at desc limit 30`,
        sql`select count(*) from private.candidate_decisions where decision_at>=now()-interval '24 hours' and status='review'`,
        sql`select kind,state,failure_reason from private.job_runs where state='dead' or (state='leased' and lease_until<now()) order by created_at desc limit 20`,
        sql`select created_at from private.audit_events where action='observation_failure' and created_at>=now()-interval '24 hours' order by created_at desc limit 20`,
      ]);
    return {
      ...base,
      providers: providers.map(
        (p) =>
          ({
            ...p,
            fresh: freshTimestamp(p.last_success),
            pollAgeSeconds:
              p.last_success && new Date(p.last_success).getTime() <= Date.now()
                ? Math.max(
                    0,
                    Math.round(
                      (Date.now() - new Date(p.last_success).getTime()) / 1000,
                    ),
                  )
                : null,
          }) as Record<string, unknown>,
      ),
      polls: polls as Record<string, unknown>[],
      candidateCount: Number(candidates[0].count),
      incidents: [
        ...observations.map(
          (o) =>
            `Observation collection failed at ${new Date(o.created_at).toISOString()}; inspect source/configuration`,
        ),
        ...jobs.map(
          (j) =>
            `${j.kind}: ${j.state}; ${j.failure_reason ?? "lease expired"}`,
        ),
      ],
    };
  } catch {
    return {
      ...base,
      database: false,
      incidents: [
        "Database diagnostics unavailable. New publications must remain paused.",
      ],
    };
  }
}
