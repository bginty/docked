import {
  projectTrialReferenceDiagnostic,
  normalizeTrialReferenceDiagnostic,
} from "@/core/provider-trial-reference-diagnostic";
import {
  trialRequestAuthority,
  completeTrialRequest,
} from "./provider-trial-database";
export {
  trialRequestAuthority,
  completeTrialRequest,
} from "./provider-trial-database";
import {
  newTrialProgress,
  trackedTrialFetch,
  trialFailureDiagnostics,
} from "@/core/provider-trial-diagnostics";
import { reservedTransaction } from "./reserved-transaction";
import "server-only";

import type { JSONValue } from "postgres";
import type { ProviderTrialHealth } from "@/core/provider-trial-health";
import {
  providerTrialEnvironment,
  trialTokenHash,
  trialExecutionAvailable,
} from "@/core/provider-trial";
import { fetchTrialSports, fetchTrialScores } from "@/providers/market-data";
import { oddsApiCredential } from "@/providers/credentials";
import { db } from "./db";
import { requireRole } from "./auth";
import { loadMarketReference } from "./market-reference";
import { validateMarketDataConfig } from "@/core/market-data";
import { marketReferenceV1 } from "@/core/market-reference";
import { trialQuotaSummarySQL } from "./provider-trial-queries";

const iso = (v: Date | string | null | undefined) =>
  v ? new Date(v).toISOString() : null;
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
/** Called only by the protected manual endpoint; a permit is consumed even if transport later fails. */
export async function executeProviderTrial(permitId: string, token: string) {
  if (!providerTrialEnvironment(process.env))
    throw Error("Manual trial disabled");
  const tokenHash = trialTokenHash(token),
    key = oddsApiCredential(process.env);
  if (!key) throw Error("Provider not configured");
  const [permit] =
    await db()`select p.*,t.rights_reference from private.provider_trial_permits p join private.provider_trials t on t.id=p.trial_id where p.id=${permitId} and p.token_hash=${tokenHash}`;
  if (!permit) throw Error("Manual permit unavailable");
  const [budget] =
    await db()`select t.credit_cap,t.attempt_cap,h.credits_remaining,(select count(*)::int from private.provider_trial_requests r where r.trial_id=t.id) attempts,(select coalesce(sum(greatest(r.reserved_credits,coalesce(r.reported_credits,0))),0)::int from private.provider_trial_requests r where r.trial_id=t.id) charged from private.provider_trials t left join private.source_health h on h.provider=t.provider where t.id=${permit.trial_id}`;
  if (
    !budget ||
    !trialExecutionAvailable({
      cap: budget.credit_cap,
      charged: budget.charged,
      attempts: budget.attempts,
      attemptCap: budget.attempt_cap,
      remaining: n(budget.credits_remaining),
    })
  )
    throw Error("Trial quota exhausted");
  if (!["sports", "scores"].includes(permit.operation)) {
    const { ingestCurrentMarketData } = await import("./market-data");
    const result = await ingestCurrentMarketData({ permitId, tokenHash });
    if (result.status === "READY")
      await captureTrialDiagnostics(permit.trial_id);
    return result;
  }
  const sql = await db().reserve();
  let pollId: string | undefined;
  const progress = newTrialProgress();
  try {
    const [poll] =
      await sql`insert into private.provider_poll_runs(provider,sport,status,diagnostics) values('the-odds-api','trial_sports','failed','{"purpose":"manual_trial","operation":"sports"}') returning id`;
    pollId = String(poll.id);
    if (permit.operation === "scores") {
      const result = await fetchTrialScores(
        permit.competition,
        trialRequestAuthority(sql, pollId, permitId, tokenHash, key, progress),
        trackedTrialFetch(progress),
      );
      progress.stage = "DATA_PERSISTENCE";
      await reservedTransaction(sql, async (tx) => {
        const [c] =
          await tx`select c.* from private.market_data_config c join private.provider_trials t on t.rights_reference=c.rights_reference where c.id=${permit.config_id} and t.id=${permit.trial_id} for share of c,t`;
        if (
          !c ||
          !(
            await tx`select private.provider_trial_active(${c.rights_reference}) allowed`
          )[0]?.allowed
        )
          throw Error("Score evidence rights expired");
        const cfg = validateMarketDataConfig(c.configuration);
        for (const raw of result.rawRecords)
          await tx`insert into private.market_data_payloads(id,provider,payload,received_at,rights_reference,retain_until) values(${raw.id},'the-odds-api',${tx.json(raw.payload as JSONValue)},${raw.receivedAt},${c.rights_reference},${new Date(Math.min(new Date(c.effective_to).getTime(), Date.parse(raw.receivedAt) + cfg.rights.rawRetentionDays * 86400000))}) on conflict do nothing`;
      });
      progress.stage = "COMPLETING";
      const diagnostics = {
        events: result.scores.length,
        completed: result.scores.filter((s) => s.completed).length,
        withScores: result.scores.filter((s) => s.scores !== null).length,
        settlementReady: false,
      };
      await completeTrialRequest(sql, permitId, pollId, true, diagnostics);
      await sql`update private.provider_poll_runs set status='success',completed_at=clock_timestamp(),diagnostics=${sql.json({ purpose: "manual_trial", operation: "scores", ...diagnostics })} where id=${pollId}`;
      return { status: "READY", operation: "scores", ...diagnostics };
    }
    const result = await fetchTrialSports(
      trialRequestAuthority(sql, pollId, permitId, tokenHash, key, progress),
      trackedTrialFetch(progress),
    );
    progress.stage = "COMPLETING";
    const sports = result.sports.map((s) => ({
      key: s.key,
      active: s.active,
      title: s.title,
    }));
    await completeTrialRequest(sql, permitId, pollId, true, { sports });
    await sql`update private.provider_poll_runs set status='success',completed_at=clock_timestamp(),diagnostics=${sql.json({ purpose: "manual_trial", sports })} where id=${pollId}`;
    return {
      status: result.remaining === 0 ? "QUOTA_EXHAUSTED" : "READY",
      operation: "sports",
      sports,
      remaining: result.remaining,
      used: result.used,
      plan: "UNKNOWN",
      resetAt: null,
    };
  } catch (error) {
    const failure = trialFailureDiagnostics(error, progress);
    if (
      pollId &&
      (await completeTrialRequest(sql, permitId, pollId, false, failure))
    )
      await sql`update private.source_health set healthy=false,last_failure=clock_timestamp(),failure_reason='manual_trial_failed',circuit_until=greatest(circuit_until,clock_timestamp()+interval '5 minutes') where provider='the-odds-api'`;
    if (pollId)
      await sql`update private.provider_poll_runs set completed_at=clock_timestamp(),error_code='trial_sports_failed' where id=${pollId}`;
    throw Error("Manual trial request unavailable");
  } finally {
    sql.release();
  }
}
/** Counts observed market data only. It never invokes ModelProvider or candidate publication. */
export async function captureTrialDiagnostics(trialId: string) {
  if (!providerTrialEnvironment(process.env))
    throw Error("Trial diagnostics disabled");
  return db().begin(async (tx) => {
    const [trial] =
      await tx`select * from private.provider_trials where id=${trialId} for share`;
    if (
      !trial ||
      !(
        await tx`select private.provider_trial_active(${trial.rights_reference}) allowed`
      )[0]?.allowed
    )
      throw Error("Trial review unavailable");
    const [counts] =
      await tx`select count(distinct market_id)::int markets,count(*)::int observations,count(*) filter(where source_at>=clock_timestamp()-interval '180 seconds' and source_at<=clock_timestamp())::int fresh from private.odds_snapshots where provider='the-odds-api' and evidence::text='market_data' and provenance=${trial.rights_reference}`;
    const [configured] =
      await tx`select * from private.market_data_config where provider='the-odds-api' and rights_reference=${trial.rights_reference} and enabled and effective_from<=clock_timestamp() and effective_to>clock_timestamp() limit 1 for share`;
    const cfg = configured
      ? (validateMarketDataConfig(configured.configuration)
          .referenceConfiguration ?? marketReferenceV1)
      : marketReferenceV1;
    const [policy] =
      await tx`select id from private.region_policies where approved and not preview_community_only and features @> '{market_data}' and effective_from<=clock_timestamp() and least(effective_to,review_at)>clock_timestamp() order by id limit 1 for share`;
    const markets =
      await tx`select distinct m.id,m.rules from private.markets m join private.events e on e.id=m.event_id join private.odds_snapshots q on q.market_id=m.id where q.provider='the-odds-api' and q.provenance=${trial.rights_reference} and e.status='scheduled' and e.start_at>clock_timestamp() order by m.id limit 5`;
    const diagnostics: ProviderTrialHealth["references"]["diagnostics"] = [];
    for (const market of markets)
      for (const selection of (market.rules.outcomes as string[]).slice(0, 3)) {
        const loaded = await loadMarketReference(
          tx,
          market.id,
          selection,
          policy?.id ?? "00000000-0000-0000-0000-000000000000",
          cfg,
        );
        diagnostics.push(
          projectTrialReferenceDiagnostic({
            marketId: market.id,
            selection,
            methodVersion: cfg.version,
            observedAt: new Date(loaded.market.observed_at).toISOString(),
            result: loaded.result,
            sourceIds: loaded.sources.map((source) => source.id),
            authorityAllowed:
              !!policy &&
              loaded.sources.some(
                (source) =>
                  source.approved &&
                  source.licensed &&
                  source.mappingVerified &&
                  source.feedHealthy &&
                  source.priceClass === "STANDARD_VERIFIED",
              ),
          }),
        );
      }
    const references = {
      evaluated: diagnostics.length,
      availabilityReady: diagnostics.filter((d) => d.status === "READY").length,
      pricingReady: diagnostics.filter((d) => (d.pricingSources ?? 0) > 0)
        .length,
      diagnostics,
    };
    const payload = {
      status:
        Number(counts.fresh) > 0
          ? "MARKET_DATA_READY"
          : "MARKET_DATA_UNAVAILABLE",
      modelStatus: "MODEL_PROBABILITY_UNAVAILABLE",
      marketsEvaluated: Number(counts.markets),
      observations: Number(counts.observations),
      freshObservations: Number(counts.fresh),
      references,
      candidates: 0,
      providerRequests: 0,
      providerCredits: 0,
    };
    const [row] =
      await tx`insert into private.provider_trial_diagnostics(trial_id,payload) values(${trialId},${tx.json(payload)}) returning observed_at`;
    return { ...payload, observedAt: iso(row.observed_at) };
  });
}
export async function providerTrialDataOnly() {
  const empty = {
    status: "NOT_RUN" as
      "NOT_RUN" | "MARKET_DATA_READY" | "MARKET_DATA_UNAVAILABLE",
    modelStatus: "MODEL_PROBABILITY_UNAVAILABLE" as const,
    observedAt: null as string | null,
    marketsEvaluated: null as number | null,
  };
  if (!providerTrialEnvironment(process.env)) return empty;
  const [row] =
    await db()`select d.* from private.provider_trial_diagnostics d join private.provider_trials t on t.id=d.trial_id where private.provider_trial_active(t.rights_reference) and d.payload->>'modelStatus'='MODEL_PROBABILITY_UNAVAILABLE' order by d.observed_at desc limit 1`;
  return row
    ? {
        ...empty,
        status: row.payload.status,
        observedAt: iso(row.observed_at),
        marketsEvaluated: n(row.payload.marketsEvaluated),
      }
    : empty;
}
export async function providerTrialHealth(): Promise<ProviderTrialHealth> {
  await requireRole(["owner", "admin", "analyst", "auditor"]);
  const base: ProviderTrialHealth = {
    provider: "the-odds-api",
    status: "NOT_CONFIGURED",
    ledgerAvailable: false,
    rights: {
      state: "PENDING_RIGHTS",
      reviewedAt: null,
      nextReviewAt: null,
      reviewer: null,
      evidenceLinks: [],
    },
    pollingEnabled: false,
    productionApproved: false,
    requests: {
      attempted: null,
      successful: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastErrorCode: null,
    },
    quota: {
      trialCap: null,
      reservedTotal: null,
      reportedTotal: null,
      providerRemaining: null,
      utcDate: null,
      reservedToday: null,
      reportedToday: null,
    },
    latestBatch: null,
    references: {
      observedAt: null,
      evaluated: null,
      availabilityReady: null,
      pricingReady: null,
      diagnostics: [],
    },
    historical: {
      status: "NOT_TESTED",
      checkedAt: null,
      earliestObservedAt: null,
      snapshotIntervalSeconds: null,
      sampleCreditCost: null,
    },
  };
  if (process.env.DOCKED_HOSTED_PREVIEW !== "true") return base;
  try {
    const [trial] =
      await db()`select *,clock_timestamp() at,private.provider_trial_active(rights_reference) active from private.provider_trials where provider='the-odds-api'`;
    if (!trial)
      return {
        ...base,
        ledgerAvailable: true,
        requests: { ...base.requests, attempted: 0, successful: 0 },
      };
    const [q] = await db().unsafe(trialQuotaSummarySQL, [trial.id]);
    const [health] =
      await db()`select credits_remaining,circuit_until from private.source_health where provider='the-odds-api'`;
    const [last] =
      await db()`select * from private.provider_trial_requests where trial_id=${trial.id} and status='FAILED' order by completed_at desc limit 1`;
    const [pending] =
      await db()`select count(*)::int count from private.provider_trial_requests where trial_id=${trial.id} and completed_at is null`;
    const [diagnostic] =
      await db()`select * from private.provider_trial_diagnostics where trial_id=${trial.id} and payload->>'modelStatus'='MODEL_PROBABILITY_UNAVAILABLE' order by observed_at desc limit 1`;
    const [capability] =
      await db()`select * from private.provider_trial_diagnostics where trial_id=${trial.id} and payload @> '{"kind":"account_capability","plan":"FREE","historical":"NOT_INCLUDED","source":"owner_confirmation"}' and observed_at<=clock_timestamp() order by observed_at desc limit 1`;
    const fixtures = trial.active
      ? await db()`select distinct on(o.event_id) o.event_id,e.participants,e.start_at,e.status current_status,o.payload from private.market_data_fixture_observations o join private.events e on e.id=o.event_id join private.market_data_payloads raw on raw.id=o.raw_payload_id where o.provider='the-odds-api' and raw.rights_reference=${trial.rights_reference} and raw.retain_until>clock_timestamp() order by o.event_id,o.observed_at desc limit 20`
      : [];
    const [batch] =
      await db()`select * from private.provider_trial_requests where trial_id=${trial.id} and completed_at is not null and diagnostics ? 'eventsReceived' and scope like 'odds:%' order by started_at desc limit 1`;
    const expired =
      new Date(trial.next_review_at) <= new Date(trial.at) ||
      new Date(trial.effective_to) <= new Date(trial.at);
    return {
      ...base,
      ledgerAvailable: true,
      status: !oddsApiCredential(process.env)
        ? "NOT_CONFIGURED"
        : !trial.active ||
            pending.count > 0 ||
            (health?.circuit_until &&
              new Date(health.circuit_until) > new Date(trial.at))
          ? "PAUSED"
          : q.charged >= trial.credit_cap ||
              q.attempts >= trial.attempt_cap ||
              health?.credits_remaining === 0 ||
              health?.credits_remaining === "0"
            ? "QUOTA_EXHAUSTED"
            : providerTrialEnvironment(process.env)
              ? "READY_MANUAL"
              : "PAUSED",
      rights: {
        state: trial.revoked_at
          ? "REVOKED"
          : expired
            ? "EXPIRED"
            : trial.decision,
        reviewedAt: iso(trial.reviewed_at),
        nextReviewAt: iso(trial.next_review_at),
        reviewer: String(trial.reviewed_by),
        evidenceLinks: trial.evidence_links,
      },
      requests: {
        attempted: q.attempts,
        successful: q.successes,
        lastSuccessAt: iso(q.success_at),
        lastFailureAt: iso(q.failure_at),
        lastErrorCode: last?.error_code ?? null,
      },
      quota: {
        trialCap: trial.credit_cap,
        reservedTotal: q.reserved,
        reportedTotal: n(q.reported),
        providerRemaining: n(health?.credits_remaining),
        utcDate: iso(trial.at)!.slice(0, 10),
        reservedToday: q.reserved_today,
        reportedToday: n(q.reported_today),
      },
      fixtures: fixtures.map((f) => ({
        eventId: f.event_id,
        eventLabel: (f.participants as string[]).join(" vs "),
        sport: f.payload.sport,
        competition: f.payload.competition,
        startAt: iso(f.start_at)!,
        status: f.current_status,
      })),
      references: diagnostic?.payload.references
        ? {
            ...diagnostic.payload.references,
            diagnostics: Array.isArray(
              diagnostic.payload.references.diagnostics,
            )
              ? diagnostic.payload.references.diagnostics.map(
                  normalizeTrialReferenceDiagnostic,
                )
              : [],
            observedAt: iso(diagnostic.observed_at),
          }
        : base.references,
      historical: capability
        ? {
            ...base.historical,
            status: "NOT_INCLUDED",
            checkedAt: iso(capability.observed_at),
          }
        : base.historical,
      latestBatch: batch
        ? {
            observedAt: iso(batch.completed_at)!,
            events: n(batch.diagnostics.eventsReceived),
            markets: n(batch.diagnostics.marketsReceived),
            sources: null,
            freshQuotes: null,
            staleQuotes: n(batch.diagnostics.staleMarkets),
            mappingFailures: n(batch.diagnostics.mappingFailures),
            timestampAnomalies: null,
            suspendedMarkets: null,
            providerErrors: Array.isArray(batch.diagnostics.errors)
              ? batch.diagnostics.errors.length
              : null,
          }
        : null,
    };
  } catch {
    return { ...base, status: "UNAVAILABLE" };
  }
}
