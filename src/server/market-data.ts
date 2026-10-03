import { reservedTransaction } from "./reserved-transaction";
import {
  newTrialProgress,
  trackedTrialFetch,
  trialFailureDiagnostics,
} from "@/core/provider-trial-diagnostics";
import "server-only";
import type { JSONValue } from "postgres";
import { hash, type Rules } from "@/core/pricing";
import { phase5Hash } from "@/core/phase5-hash";
import {
  marketDataEnvironment,
  marketDataPreviewIdentity,
} from "@/core/market-data-environment";
import {
  monitoredWindow,
  validateMarketDataConfig,
  type MonitoredMarkets,
  type ProviderFixture,
} from "@/core/market-data";
import {
  canonicalProviderEventId,
  fetchCurrentMarketData,
  fetchTrialEvents,
  type MarketDataRequestAuthority,
  fixtureRules,
} from "@/providers/market-data";
import { oddsApiCredential } from "@/providers/credentials";
import { pollBudget } from "@/core/data-health";
import { db } from "./db";
import { regionAccess } from "./queries";
import { loadMarketReference } from "./market-reference";
import { registerCommunityQuoteEvidence } from "./community-edges";
import {
  providerTrialEnvironment,
  trialMappingAccepted,
} from "@/core/provider-trial";
import { trialRequestAuthority, completeTrialRequest } from "./provider-trial";
const iso = (v: Date | string) => (v instanceof Date ? v.toISOString() : v);
function key(provider: string) {
  return provider === "the-odds-api"
    ? oddsApiCredential(process.env)
    : process.env.ODDSPAPI_API_KEY?.trim();
}
export async function marketDataReadiness() {
  const provider = process.env.MARKET_DATA_PROVIDER ?? null;
  const base = {
    provider,
    status: "NOT_CONFIGURED" as
      | "NOT_CONFIGURED"
      | "DISABLED"
      | "PENDING_RIGHTS"
      | "READY"
      | "UNAVAILABLE",
    rightsApproved: false,
    configurationVersion: null as string | null,
    lastSuccess: null as string | null,
    remaining: null as number | null,
  };
  try {
    if (!provider || !key(provider)) return base;
    if (
      !marketDataEnvironment(process.env) &&
      !providerTrialEnvironment(process.env)
    )
      return { ...base, status: "DISABLED" as const };
    const [record] =
      await db()`select * from private.market_data_config where provider=${provider} and enabled and effective_from<=clock_timestamp() and effective_to>clock_timestamp() order by created_at desc limit 1`;
    if (!record) return { ...base, status: "PENDING_RIGHTS" as const };
    if (
      providerTrialEnvironment(process.env) &&
      !(
        await db()`select private.provider_trial_active(${record.rights_reference}) allowed`
      )[0]?.allowed
    )
      return { ...base, status: "PENDING_RIGHTS" as const };
    const cfg = validateMarketDataConfig(record.configuration);
    if (
      cfg.provider !== provider ||
      phase5Hash(cfg) !== record.config_hash ||
      cfg.rights.reference !== record.rights_reference
    )
      throw new Error("Configuration mismatch");
    const [health] =
      await db()`select * from private.source_health where provider=${provider}`;
    const current =
      health?.healthy &&
      health.rights_reference === cfg.rights.reference &&
      health.capabilities?.display === true &&
      health.capabilities?.retention === true &&
      health.last_success &&
      health.last_success.getTime() <= Date.now() &&
      Date.now() - health.last_success.getTime() <=
        Math.max(180, cfg.pollIntervalSeconds * 2) * 1000;
    return {
      ...base,
      status: current ? ("READY" as const) : ("UNAVAILABLE" as const),
      rightsApproved: true,
      configurationVersion: cfg.version,
      lastSuccess: health?.last_success ? iso(health.last_success) : null,
      remaining:
        health?.credits_remaining == null
          ? null
          : Number(health.credits_remaining),
    };
  } catch {
    return { ...base, status: "UNAVAILABLE" as const };
  }
}
/** Bounded private raw-payload deletion; canonical immutable observations retain hashes/provenance. */
export async function purgeExpiredMarketData() {
  if (!marketDataPreviewIdentity(process.env))
    return { status: "DISABLED", deleted: 0 };
  const [row] =
    await db()`select private.purge_expired_market_payloads() deleted`;
  return { status: "READY", deleted: Number(row.deleted) };
}

/** No publication, strategy approval, results settlement or messaging occurs in this importer. */
export async function ingestCurrentMarketData(trial?: {
  permitId: string;
  tokenHash: string;
}) {
  if (
    trial
      ? !providerTrialEnvironment(process.env)
      : !marketDataEnvironment(process.env)
  )
    throw new Error("Market data preview authority is disabled");
  const provider = process.env.MARKET_DATA_PROVIDER!;
  const credential = key(provider);
  if (!credential) throw new Error("MARKET_DATA_STATUS=NOT_CONFIGURED");
  const connection = await db().reserve();
  let runId: string | undefined;
  const progress = newTrialProgress();
  try {
    const [lock] =
      await connection`select pg_try_advisory_lock(6729383) acquired`;
    if (!lock.acquired) return { status: "BUSY", events: 0, quotes: 0 };
    await connection`select private.purge_expired_market_payloads()`;
    const [permit] = trial
      ? await connection`select * from private.provider_trial_permits where id=${trial.permitId} and token_hash=${trial.tokenHash}`
      : [];
    if (trial && (!permit || !["odds", "events"].includes(permit.operation)))
      throw Error("Manual ingestion permit unavailable");
    const [record] =
      await connection`select * from private.market_data_config where provider=${provider} and enabled and effective_from<=clock_timestamp() and effective_to>clock_timestamp() and (${!trial} or id=${permit?.config_id ?? null}) order by created_at desc limit 1`;
    if (!record)
      throw new Error("Reviewed market data configuration is unavailable");
    const cfg = validateMarketDataConfig(record.configuration);
    if (
      cfg.provider !== provider ||
      record.config_hash !== phase5Hash(cfg) ||
      record.rights_reference !== cfg.rights.reference
    )
      throw new Error("Market data configuration provenance mismatch");
    const [recent] =
      await connection`select started_at from private.provider_poll_runs where provider=${provider} order by started_at desc limit 1`;
    if (
      !trial &&
      recent &&
      Date.now() - new Date(recent.started_at).getTime() <
        cfg.pollIntervalSeconds * 1000
    )
      return { status: "CADENCE_WAIT", events: 0, quotes: 0 };
    const [run] =
      await connection`insert into private.provider_poll_runs(provider,sport,status,diagnostics) values(${provider},'market_data','failed',${connection.json({ purpose: "market_data", configId: record.id, configHash: record.config_hash })}) returning id`;
    runId = String(run.id);
    const authority: MarketDataRequestAuthority = trial
      ? trialRequestAuthority(
          connection,
          runId!,
          trial.permitId,
          trial.tokenHash,
          credential,
          progress,
        )
      : {
          key: credential,
          observeQuota: async (quota) => {
            await reservedTransaction(connection, async (tx) => {
              const extra = Math.max(
                0,
                (quota.lastRequestCost ?? quota.reservedCost) -
                  quota.reservedCost,
              );
              await tx`update private.provider_poll_runs set quota_charge=quota_charge+${extra} where id=${runId!}`;
              await tx`update private.source_health set credits_remaining=case when ${quota.remaining}::bigint is not null then ${quota.remaining}::bigint when credits_remaining is null then null else greatest(0,credits_remaining-${extra}) end,credits_used=coalesce(${quota.used},credits_used) where provider=${provider}`;
            });
          },
          reserve: async (cost, scope) => {
            await reservedTransaction(connection, async (tx) => {
              const [active] =
                await tx`select * from private.market_data_config where id=${record.id} for share`;
              await tx`insert into private.source_health(provider,rights_reference,capabilities) values(${provider},${cfg.rights.reference},${tx.json({ display: true, retention: true, derived: true, community_standard_prices: false })}) on conflict(provider) do nothing`;
              const [health] =
                await tx`select * from private.source_health where provider=${provider} for update`;
              const [clock] = await tx`select clock_timestamp() at`;
              if (
                !active?.enabled ||
                active.config_hash !== record.config_hash ||
                new Date(active.effective_from) > clock.at ||
                new Date(active.effective_to) <= clock.at
              )
                throw new Error("Market data approval expired or revoked");
              if (
                health.rights_reference !== cfg.rights.reference ||
                health.capabilities?.display !== true ||
                health.capabilities?.retention !== true ||
                (health.circuit_until && health.circuit_until > clock.at)
              )
                throw new Error(
                  "Provider rights or outage circuit blocks polling",
                );
              const [spent] =
                await tx`select coalesce(sum(quota_charge),0) total from private.provider_poll_runs where provider=${provider} and started_at>=date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC'`;
              const budget = pollBudget({
                limit: cfg.monthlyCreditLimit,
                spent: Number(spent.total),
                remaining:
                  health.credits_remaining === null
                    ? null
                    : Number(health.credits_remaining),
                cost,
              });
              if (!budget.allowed)
                throw new Error("Market data request budget unavailable");
              await tx`update private.provider_poll_runs set quota_charge=quota_charge+${cost},diagnostics=diagnostics||${tx.json({ lastScope: scope })} where id=${runId!}`;
              // Failed requests remain charged. Unknown provider balances remain NULL.
              await tx`update private.source_health set credits_remaining=case when credits_remaining is null then null else greatest(0,credits_remaining-${cost}) end where provider=${provider}`;
            });
          },
        };
    const scoped = trial
      ? {
          ...cfg,
          competitions: cfg.competitions.filter(
            (c) => c.providerCompetitionId === permit.competition,
          ),
          maxRequestsPerRun: 1,
        }
      : cfg;
    const batch =
      trial && permit.operation === "events"
        ? await fetchTrialEvents(
            scoped,
            permit.competition,
            authority,
            trackedTrialFetch(progress),
          )
        : await fetchCurrentMarketData(
            scoped,
            authority,
            trackedTrialFetch(progress),
          );
    progress.stage = "DATA_PERSISTENCE";
    let imported = 0,
      insertedQuotes = 0,
      mappingRejected = 0;
    const acceptedQuoteIds: string[] = [];
    await reservedTransaction(connection, async (tx) => {
      const [active] =
        await tx`select * from private.market_data_config where id=${record.id} for share`;
      const [clock] = await tx`select clock_timestamp() at`;
      if (
        !active?.enabled ||
        active.config_hash !== record.config_hash ||
        new Date(active.effective_from) > clock.at ||
        new Date(active.effective_to) <= clock.at ||
        (trial &&
          !(
            await tx`select private.provider_trial_active(${cfg.rights.reference}) allowed`
          )[0]?.allowed)
      )
        throw new Error("Market data rights revoked before persistence");
      for (const raw of batch.rawRecords) {
        const id = raw.id;
        await tx`insert into private.market_data_payloads(id,provider,payload,received_at,rights_reference,retain_until) values(${id},${provider},${tx.json(raw.payload as JSONValue)},${raw.receivedAt},${cfg.rights.reference},${new Date(Math.min(new Date(record.effective_to).getTime(), Date.parse(raw.receivedAt) + cfg.rights.rawRetentionDays * 86400000))}) on conflict do nothing`;
      }
      const accepted = new Set<string>();
      for (const f of batch.fixtures) {
        const eventId = canonicalProviderEventId(provider, f.providerEventId);
        const mapping = cfg.competitions.find(
          (c) => c.competitionId === f.competitionId,
        )!;
        const [competition] =
          await tx`select id,sport_id from private.competitions where id=${f.competitionId}`;
        if (!competition || competition.sport_id !== f.sport) {
          mappingRejected++;
          continue;
        }
        const [existing] =
          await tx`select * from private.events where id=${eventId} for update`;
        if (
          existing &&
          (hash(existing.participants) !== hash(f.participants) ||
            existing.competition_id !== f.competitionId ||
            iso(existing.start_at) !== new Date(f.startAt).toISOString())
        ) {
          await tx`insert into private.audit_events(actor,action,subject,details) values('market-data','provider_event_mapping_changed',${eventId},${tx.json({ provider, configId: record.id })})`;
          await tx`update private.events set status='manual_review' where id=${eventId}`;
          mappingRejected++;
          continue;
        }
        if (!existing)
          await tx`insert into private.events(id,competition_id,participants,start_at,status,source_mappings) values(${eventId},${f.competitionId},${tx.json(f.participants)},${f.startAt},${f.status},${tx.json({ [provider]: f.providerEventId })})`;
        else if (existing.status === "scheduled")
          await tx`update private.events set status=${f.status} where id=${eventId}`;
        else if (f.status !== existing.status) {
          mappingRejected++;
          continue;
        } // Terminal or review state cannot silently reactivate.
        await tx`insert into private.market_data_event_mappings(provider,provider_event_id,event_id,provider_competition_id,canonical_competition_id,mapping_evidence) values(${provider},${f.providerEventId},${eventId},${f.providerCompetitionId},${f.competitionId},${mapping.mappingEvidence}) on conflict do nothing`;
        const rawId = batch.fixtureEvidence[f.providerEventId];
        if (!rawId) throw new Error("Fixture payload evidence missing");
        await tx`insert into private.market_data_fixture_observations(id,provider,event_id,provider_event_id,observed_at,payload,raw_payload_id) values(${phase5Hash({ provider, eventId, fixture: f })},${provider},${eventId},${f.providerEventId},${f.observedAt},${tx.json(f)},${rawId}) on conflict do nothing`;
        const rules = fixtureRules(f);
        if (rules && f.status === "scheduled") {
          const marketId = hash(rules);
          await tx`insert into private.markets(id,event_id,rules,rules_hash) values(${marketId},${eventId},${tx.json(rules)},${hash(rules)}) on conflict do nothing`;
          accepted.add(eventId);
        }
        imported++;
      }
      for (const q of batch.quotes) {
        if (!accepted.has(q.rules.eventId)) {
          mappingRejected++;
          continue;
        }
        const rows =
          await tx`insert into private.odds_snapshots(id,market_id,provider,bookmaker,source_at,snapshot_at,received_at,payload,raw_private_path,provenance,evidence) values(${q.id},${hash(q.rules)},${provider},${q.bookmaker},${q.sourceAt},${q.snapshotAt},${q.receivedAt},${tx.json(q)},${"db:" + q.rawPayloadId},${cfg.rights.reference},'market_data') on conflict do nothing returning id`;
        insertedQuotes += rows.length;
        acceptedQuoteIds.push(q.id);
      }
      batch.stats.mappingFailures += mappingRejected;
      const healthy =
        !trial ||
        (trialMappingAccepted(mappingRejected) && batch.remaining !== 0);
      await tx`update private.source_health set healthy=${healthy},last_success=case when ${healthy} then ${batch.receivedAt}::timestamptz else last_success end,last_failure=case when ${healthy} then last_failure else clock_timestamp() end,failure_reason=${healthy ? null : batch.remaining === 0 ? "provider_quota_exhausted" : "trial_mapping_rejected"},circuit_until=case when not ${healthy} then greatest(circuit_until,clock_timestamp()+interval '5 minutes') when ${!!trial} then circuit_until else null end,credits_remaining=coalesce(${batch.remaining},credits_remaining),credits_used=coalesce(${batch.used},credits_used),diagnostics=${tx.json(batch.stats)} where provider=${provider}`;
      await tx`update private.provider_poll_runs set status='success',completed_at=clock_timestamp(),diagnostics=diagnostics||${tx.json(batch.stats)} where id=${runId!}`;
    });
    // Independent classification guard reads trusted retained payload and source approvals.
    for (const quote of batch.quotes)
      if (acceptedQuoteIds.includes(quote.id) && quote.communityMetadata)
        try {
          await registerCommunityQuoteEvidence(quote.id, connection);
        } catch {
          await connection`insert into private.audit_events(actor,action,subject,details) values('market-data','classification_review_required',${quote.id},${connection.json({ provider })})`;
        }
    progress.stage = "COMPLETING";
    if (trial)
      await completeTrialRequest(
        connection,
        trial.permitId,
        runId!,
        trialMappingAccepted(mappingRejected),
        {
          ...batch.stats,
          eventsImported: imported,
          quotesImported: insertedQuotes,
        },
      );
    return {
      status:
        trial && batch.remaining === 0
          ? "QUOTA_EXHAUSTED"
          : trial && !trialMappingAccepted(mappingRejected)
            ? "BLOCKED_MAPPING"
            : "READY",
      events: imported,
      quotes: insertedQuotes,
      mappingRejected,
    };
  } catch (error) {
    const failure = trialFailureDiagnostics(error, progress);
    const ownedFailure =
      trial && runId
        ? await completeTrialRequest(
            connection,
            trial.permitId,
            runId,
            false,
            failure,
          )
        : !trial;
    if (runId) {
      await connection`update private.provider_poll_runs set completed_at=clock_timestamp(),status='failed',error_code='market_data_poll_failed' where id=${runId}`;
      if (ownedFailure)
        await connection`update private.source_health set healthy=false,last_failure=clock_timestamp(),failure_reason='market_data_poll_failed',circuit_until=greatest(circuit_until,clock_timestamp()+interval '5 minutes') where provider=${provider}`;
    }
    throw error;
  } finally {
    await connection`select pg_advisory_unlock(6729383)`;
    connection.release();
  }
}

export async function monitoredMarkets(
  input: { window: MonitoredMarkets["window"]; limit?: number } = {
    window: "upcoming",
  },
): Promise<MonitoredMarkets> {
  const bounds = monitoredWindow(input.window),
    provider = process.env.MARKET_DATA_PROVIDER ?? null;
  const empty: MonitoredMarkets = {
    status: "NOT_CONFIGURED",
    message: "Authorised current market data is not configured.",
    provider,
    observedAt: null,
    events: [],
    window: input.window,
    ...bounds,
  };
  try {
    if (!provider || !key(provider)) return empty;
    if (
      !marketDataEnvironment(process.env) &&
      !providerTrialEnvironment(process.env)
    )
      return {
        ...empty,
        status: "DISABLED",
        message: "Current market display awaits explicit preview activation.",
      };
    const access = await regionAccess("market_data");
    if (!access.allowed || !access.policy)
      return {
        ...empty,
        status: "DISABLED",
        message: "Current market display awaits regional approval.",
      };
    return await db().begin(async (tx) => {
      const [record] =
        await tx`select * from private.market_data_config where provider=${provider} and enabled and effective_from<=clock_timestamp() and effective_to>clock_timestamp() order by created_at desc limit 1 for share`;
      if (!record)
        return {
          ...empty,
          status: "DISABLED" as const,
          message: "Current data display rights await review.",
        };
      const cfg = validateMarketDataConfig(record.configuration);
      if (
        providerTrialEnvironment(process.env) &&
        !(
          await tx`select private.provider_trial_active(${record.rights_reference}) allowed`
        )[0]?.allowed
      )
        throw Error("Current trial rights unavailable");
      if (phase5Hash(cfg) !== record.config_hash)
        throw new Error("Configuration mismatch");
      const [health] =
        await tx`select * from private.source_health where provider=${provider}`;
      const [policy] =
        await tx`select * from private.region_policies where id=${access.policy!} for share`;
      const [clock] = await tx`select clock_timestamp() at`;
      if (
        !record.enabled ||
        new Date(record.effective_from) > clock.at ||
        new Date(record.effective_to) <= clock.at ||
        !policy?.approved ||
        policy.preview_community_only ||
        policy.minimum_age > 18 ||
        !policy.features.includes("market_data") ||
        policy.effective_from > clock.at ||
        policy.effective_to <= clock.at ||
        policy.review_at <= clock.at
      )
        return {
          ...empty,
          status: "DISABLED" as const,
          message: "Current data display approval is unavailable.",
        };
      if (
        !health?.healthy ||
        health.rights_reference !== cfg.rights.reference ||
        health.capabilities?.display !== true ||
        health.capabilities?.retention !== true ||
        !health.last_success ||
        health.last_success > clock.at ||
        clock.at.getTime() - health.last_success.getTime() >
          Math.max(180, cfg.pollIntervalSeconds * 2) * 1000
      )
        return {
          ...empty,
          status: "UNAVAILABLE" as const,
          message:
            "Current data is unavailable or stale; no fresh market is implied.",
        };
      const rows =
        await tx`with latest as(select distinct on(o.event_id) o.*,e.status current_status,e.start_at current_start from private.market_data_fixture_observations o join private.events e on e.id=o.event_id join private.market_data_payloads raw on raw.id=o.raw_payload_id where o.provider=${provider} and raw.provider=${provider} and raw.rights_reference=${cfg.rights.reference} and raw.retain_until>clock_timestamp() and e.competition_id=any(${cfg.competitions.map((c) => c.competitionId)}) and e.start_at>=${bounds.from} and e.start_at<${bounds.to} and o.observed_at>clock_timestamp()-${Math.max(180, cfg.pollIntervalSeconds * 2)}*interval '1 second' order by o.event_id,o.observed_at desc,o.id desc) select * from latest order by current_start,event_id limit ${Math.max(1, Math.min(30, input.limit ?? 8))}`;
      const events: MonitoredMarkets["events"] = [];
      for (const row of rows) {
        const f = row.payload as ProviderFixture;
        const item: MonitoredMarkets["events"][number] = {
          eventId: row.event_id,
          eventLabel: f.participants.join(" vs "),
          sport: f.sport,
          competition: f.competition,
          startAt: iso(row.current_start),
          status: row.current_status,
          markets: [],
        };
        const markets =
          await tx`select id,rules from private.markets where event_id=${row.event_id}`;
        for (const m of markets) {
          const rules = m.rules as Rules;
          for (const selection of rules.outcomes) {
            const entry: MonitoredMarkets["events"][number]["markets"][number] =
              {
                marketId: m.id,
                label: `${selection} · ${rules.market === "football_1x2" ? "Regulation result" : "Full-game winner including overtime"}`,
                referencePrice: null,
                sourceAt: null,
                observedAt: null,
                freshness: "UNKNOWN",
                standardStatus: "UNKNOWN_REVIEW",
              };
            if (
              cfg.referenceConfiguration &&
              row.current_status === "scheduled"
            ) {
              const loaded = await loadMarketReference(
                tx,
                m.id,
                selection,
                access.policy!,
                cfg.referenceConfiguration,
              );
              if (loaded.result.status === "READY")
                Object.assign(entry, {
                  referencePrice: loaded.result.reference.decimalPrice,
                  sourceAt: loaded.result.reference.sourceAt,
                  observedAt: loaded.result.reference.observedAt,
                  freshness: "FRESH",
                  standardStatus: "STANDARD_VERIFIED",
                });
            }
            item.markets.push(entry);
          }
        }
        events.push(item);
      }
      return {
        ...empty,
        status: "READY" as const,
        message: events.length
          ? "Observed licensed fixtures and market references. These are market facts, not tips."
          : "No monitored fixtures in this UTC window.",
        observedAt: iso(health.last_success),
        configurationReference: {
          version: cfg.version,
          hash: record.config_hash,
        },
        events: events.sort((a, b) => a.startAt.localeCompare(b.startAt)),
      };
    });
  } catch {
    return {
      ...empty,
      status: "UNAVAILABLE",
      message: "Current market data is temporarily unavailable.",
    };
  }
}
