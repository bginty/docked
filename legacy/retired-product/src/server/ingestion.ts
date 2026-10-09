import { reservedTransaction } from "./reserved-transaction";
import {
  evaluateReference,
  validateReferenceStrategy,
} from "@/core/reference-pricing";
import { loadMarketReference } from "./market-reference";
import { db } from "./db";
import { TheOddsApi, type Mapping } from "@/providers/odds-api";
import { evaluate, hash, validateStrategy, type Quote } from "@/core/pricing";
import {
  freshTimestamp,
  pollBudget,
  providerReadiness,
} from "@/core/data-health";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { currentBookmakerApprovals } from "./bookmaker-approvals";
import { revalidateBookmakers } from "@/core/bookmaker-approval";
import { frozenCodeMatches } from "@/core/code-provenance";
import { registerCommunityQuoteEvidence } from "./community-edges";
import { oddsApiCredential } from "@/providers/credentials";
export async function ingestSport(sport: string) {
  if (
    !["direct", "session"].includes(process.env.DATABASE_CONNECTION_MODE ?? "")
  )
    throw new Error(
      "Ingestion requires an explicitly configured direct or session-mode database connection",
    );
  if (providerReadiness(process.env, "odds") !== "READY")
    throw new Error(
      "ODDS_PROVIDER_STATUS=" + providerReadiness(process.env, "odds"),
    );
  const sql = db(),
    connection = await sql.reserve();
  let pollId: string | undefined;
  try {
    // Session lock serializes shared quota across processes. Reservation commits
    // before the network call so a crash cannot refund a possibly billed request.
    await connection`select pg_advisory_lock(6729382)`;
    const health =
      await connection`select * from private.source_health where provider='the-odds-api'`;
    const h = health[0];
    if (
      !h?.rights_reference ||
      h.rights_reference !== process.env.ODDS_RIGHTS_REFERENCE ||
      !h.capabilities?.display ||
      !h.capabilities?.retention ||
      (h.circuit_until && new Date(h.circuit_until) > new Date())
    )
      throw new Error("Provider rights/circuit gate closed");
    const cost = (process.env.ODDS_REGIONS ?? "au").split(",").length;
    const spent =
      await connection`select coalesce(sum(quota_charge),0) total from private.provider_poll_runs where provider='the-odds-api' and started_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'`;
    const limit = Number(process.env.ODDS_MONTHLY_CREDIT_LIMIT ?? 0),
      remaining =
        h.credits_remaining === null ? null : Number(h.credits_remaining);
    const budget = pollBudget({
      limit,
      spent: Number(spent[0].total),
      remaining,
      cost,
    });
    if (!budget.allowed) {
      await connection`insert into private.provider_poll_runs(provider,sport,status,error_code,completed_at) values('the-odds-api',${sport},'rejected',${budget.reason},now())`;
      throw new Error(budget.reason);
    }
    const events =
      await connection`select e.id,e.start_at,e.source_mappings,m.rules from private.events e join private.markets m on m.event_id=e.id where e.competition_id=${sport} and e.start_at>now() and e.status='scheduled'`;
    const books =
      await connection`select b.bookmaker,b.operator_group,b.rights_reference,b.effective_from,b.effective_to from private.bookmaker_eligibility b join private.region_policies r on r.id=b.region_policy_id where b.approved and b.effective_from<=now() and b.effective_to>now() and r.approved and r.review_at>now() and r.effective_from<=now() and r.effective_to>now()`;
    const mappings: Mapping["bookmakers"] = {};
    for (const b of books) {
      if (
        mappings[b.bookmaker] &&
        mappings[b.bookmaker].operator !== b.operator_group
      )
        throw new Error("Conflicting bookmaker ownership mapping");
      mappings[b.bookmaker] = {
        operator: b.operator_group,
        approved: true,
        evidence: b.rights_reference,
        effectiveFrom: b.effective_from.toISOString(),
        effectiveTo: b.effective_to.toISOString(),
      };
    }
    const mapping: Mapping = {
      bookmakers: mappings,
      events: Object.fromEntries(
        events
          .filter((e) => e.source_mappings["the-odds-api"])
          .map((e) => [
            e.source_mappings["the-odds-api"],
            { rules: e.rules, startAt: e.start_at.toISOString() },
          ]),
      ),
    };
    const reservation = await reservedTransaction(connection, async (tx) => {
      const rows =
        await tx`insert into private.provider_poll_runs(provider,sport,status,error_code,quota_charge) values('the-odds-api',${sport},'failed','request_in_progress_or_interrupted',${cost}) returning id`;
      await tx`update private.source_health set credits_remaining=case when credits_remaining is null then null else greatest(0,credits_remaining-${cost}) end where provider='the-odds-api'`;
      return rows;
    });
    pollId = reservation[0].id;
    const provider = new TheOddsApi({
      key: oddsApiCredential(process.env)!,
      rights: h.rights_reference,
      remaining: Math.min(
        remaining ?? Infinity,
        limit - Number(spent[0].total),
      ),
      regions: process.env.ODDS_REGIONS ?? "au",
      mapping,
      allowPolling: true,
    });
    const result = await provider.fetch(sport);
    const rawPath = path.join("private-data", `${hash(result.raw)}.json`);
    await mkdir("private-data", { recursive: true });
    await writeFile(rawPath, JSON.stringify(result.raw));
    await reservedTransaction(connection, async (tx) => {
      for (const q of result.quotes) {
        const market =
          await tx`select id from private.markets where event_id=${q.rules.eventId} and rules_hash=${hash(q.rules)}`;
        if (!market[0]) continue;
        await tx`insert into private.odds_snapshots(id,market_id,provider,bookmaker,source_at,snapshot_at,received_at,payload,raw_private_path,provenance,evidence) values(${q.id},${market[0].id},'the-odds-api',${q.bookmaker},${q.sourceAt},${q.snapshotAt},${q.receivedAt},${tx.json(q)},${rawPath},${h.rights_reference},'forward_paper') on conflict do nothing`;
      }
      const valid = result.quotes.length > 0;
      await tx`update private.source_health set healthy=${valid},last_success=case when ${valid} then now() else last_success end,last_failure=case when ${valid} then last_failure else now() end,credits_remaining=${result.remaining},credits_used=${result.used},failure_reason=${valid ? null : "No valid mapped markets in provider response"},circuit_until=null,diagnostics=${tx.json({ ...result.stats, snapshotAt: result.snapshotAt, historicalSnapshotId: result.historicalSnapshotId })} where provider='the-odds-api'`;
      await tx`update private.provider_poll_runs set status=${valid ? "success" : "rejected"},error_code=${valid ? null : "no_valid_mapped_markets"},diagnostics=${tx.json(result.stats)},quota_charge=${Math.max(cost, result.lastRequestCost ?? cost)},completed_at=now() where id=${pollId!}`;
    });
    // Community classification is a separate, fail-closed consumer of retained
    // trusted adapter metadata. Failure cannot roll back official ingestion.
    for (const quote of result.quotes)
      if (quote.communityMetadata) {
        try {
          await registerCommunityQuoteEvidence(quote.id, connection);
        } catch {
          try {
            await connection`insert into private.audit_events(actor,action,subject,details) values('community-verifier','community_quote_rejected',${quote.id},'{"reason":"metadata_or_rights_verification_failed"}')`;
          } catch {
            /* Community diagnostics must not change official ingestion outcome. */
          }
        }
      }
  } catch {
    if (pollId) {
      await connection`update private.provider_poll_runs set status='failed',error_code='provider_or_ingestion_failed',completed_at=now() where id=${pollId}`;
      await connection`update private.source_health set healthy=false,last_failure=now(),failure_reason='Provider request or ingestion failed; quota reservation retained',circuit_until=now()+interval '5 minutes' where provider='the-odds-api'`;
    }
    throw new Error(
      "Ingestion failed closed; inspect private poll diagnostics",
    );
  } finally {
    try {
      await connection`select pg_advisory_unlock(6729382)`;
    } finally {
      connection.release();
    }
  }
}
export async function evaluateDue() {
  const sql = db();
  const strategies =
    await sql`select * from private.strategy_versions where lifecycle in ('FORWARD_PAPER','APPROVED_FOR_LIVE') and active and frozen_at is not null and research_approved_at is not null`;
  for (const strategy of strategies) {
    if (!frozenCodeMatches(strategy.code_commit, process.env)) continue;
    if (strategy.config.method === "market-reference-independent-cohorts") {
      const cfg = validateReferenceStrategy(strategy.config);
      if (strategy.config_hash !== hash(cfg)) continue;
      const events =
        await sql`select m.id market_id,m.rules from private.markets m join private.events e on e.id=m.event_id where e.status='scheduled' and e.start_at>now()+interval '10 minutes' and e.start_at<=now()+interval '6 hours' order by m.id`;
      for (const event of events)
        await sql.begin(async (tx) => {
          const [policy] =
            await tx`select id from private.region_policies where approved and effective_from<=now() and effective_to>now() and review_at>now() and 'tips'=any(features) order by country,state limit 1 for share`;
          if (!policy) return;
          const loaded = await loadMarketReference(
            tx,
            event.market_id,
            event.rules.outcomes[0],
            policy.id,
            cfg.marketReference,
          );
          const at = loaded.market.observed_at.toISOString(),
            start = loaded.market.start_at.toISOString();
          const result = evaluateReference(
            {
              rules: loaded.market.rules,
              startAt: start,
              decisionAt: at,
              sources: loaded.sources,
            },
            cfg,
          );
          const window = cfg.windowsSeconds.find(
            (w) =>
              Math.abs((Date.parse(start) - Date.parse(at)) / 1000 - w) <=
              cfg.windowToleranceSeconds,
          );
          if (window === undefined) return;
          const candidate = result.candidates[0];
          await tx`insert into private.candidate_decisions(event_id,strategy_id,decision_at,window_seconds,payload,rejection_reasons,status) values(${loaded.market.event_id},${strategy.id},${at},${window},${tx.json(candidate ? { ...candidate, pricingModel: "market_reference_v1", marketId: event.market_id, regionPolicyId: policy.id, codeCommit: strategy.code_commit } : { pricingModel: "market_reference_v1", marketId: event.market_id, universe: result.universe })},${tx.json(result.rejections)},${candidate ? "review" : "rejected"}) on conflict do nothing`;
        });
      continue;
    }
    const cfg = validateStrategy(strategy.config);
    if (strategy.config_hash !== hash(cfg)) continue;
    const h =
      await sql`select healthy,last_success from private.source_health where provider='the-odds-api'`;
    if (!h[0]?.healthy || !freshTimestamp(h[0].last_success)) return;
    const events =
      await sql`select e.*,m.rules,m.id market_id from private.events e join private.markets m on m.event_id=e.id where e.status='scheduled' and e.start_at>now()+interval '10 minutes' and e.start_at<=now()+interval '6 hours'`;
    for (const e of events) {
      const quotes =
        await sql`select distinct on (bookmaker) payload from private.odds_snapshots where market_id=${e.market_id} and evidence in ('forward_paper','live_published') order by bookmaker,source_at desc`;
      const decisionAt = new Date().toISOString();
      const sources = revalidateBookmakers(
        quotes.map((q) => q.payload as Quote),
        await currentBookmakerApprovals(sql),
        decisionAt,
      );
      const result = evaluate(
        {
          rules: e.rules,
          startAt: e.start_at.toISOString(),
          decisionAt,
          quotes: sources.quotes,
        },
        cfg,
      );
      result.rejections.push(...sources.rejections);
      if (result.rejections[0]?.reason === "outside_decision_window") continue;
      const window =
        result.candidates[0]?.window ??
        cfg.windowsSeconds.find(
          (w) =>
            Math.abs(
              (e.start_at.getTime() - Date.parse(decisionAt)) / 1000 - w,
            ) <= 120,
        ) ??
        3600;
      const policy =
        await sql`select id from private.region_policies where approved and effective_from<=now() and effective_to>now() and review_at>now() and 'tips'=any(features) order by country,state limit 1`;
      const c = result.candidates[0];
      await sql`insert into private.candidate_decisions(event_id,strategy_id,decision_at,window_seconds,payload,rejection_reasons,status) values(${e.id},${strategy.id},${decisionAt},${window},${sql.json(c ? { ...c, codeCommit: strategy.code_commit, marketId: e.market_id, regionPolicyId: policy[0]?.id ?? null } : { codeCommit: strategy.code_commit, marketId: e.market_id, universe: result.universe })},${sql.json(result.rejections)},${c && policy[0] ? "review" : "rejected"}) on conflict do nothing`;
    }
  }
}
