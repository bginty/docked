import "server-only";
import {
  compareFootballPrediction,
  validateFootballEdgeStrategy,
} from "@/core/football-edge";
import { buildMarketReference } from "@/core/market-reference";
import { frozenCodeMatches } from "@/core/code-provenance";
import { hash, type Rules } from "@/core/pricing";
import type { ScannerPurpose } from "@/core/edge-scanner";
import { providerTrialEnvironment } from "@/core/provider-trial";
import {
  loadMarketReference,
  retainMarketReference,
  type ReferenceSql,
} from "./market-reference";
import {
  readModelPredictionForComparison,
  recordFootballPrediction,
} from "./model-ledger";
import { db } from "./db";
import type postgres from "postgres";

/** Evaluate sporting events even when no external market exists. Batched across leased ticks. */
export async function recordDueFootballPredictions(
  job: postgres.Row,
  startedAt: Date,
  deadline: number,
) {
  const sql = db(),
    payload = job.payload;
  const [strategy] =
    await sql`select config from private.strategy_versions where id=${payload.strategyId}`;
  if (strategy?.config?.method !== "football-independent-model") return true;
  const cfg = validateFootballEdgeStrategy(strategy.config);
  // Only metadata is read here. No odds/source/reference table is consulted.
  const events =
    await sql`select e.id,w.value::integer window_seconds from private.events e cross join jsonb_array_elements_text(${sql.json(cfg.windowsSeconds)}::jsonb) w
    where e.status='scheduled' and e.competition_id=any(${cfg.competitions}::text[])
    and (${payload.competition ?? null}::text is null or e.competition_id=${payload.competition ?? null})
    and (${payload.marketId ?? null}::text is null or e.id=(select event_id from private.markets where id=${payload.marketId ?? null}))
    and e.start_at>clock_timestamp()+${cfg.safetySeconds}*interval '1 second'
    and e.start_at<=${startedAt}::timestamptz+${Number(payload.horizonSeconds ?? 21600)}*interval '1 second'
    and extract(epoch from(e.start_at-clock_timestamp())) between w.value::integer-${cfg.windowToleranceSeconds} and w.value::integer
    and not exists(select 1 from private.football_model_attempts p where p.event_id=e.id and p.requested_model_version=${cfg.modelVersion} and p.window_seconds=w.value::integer)
    order by e.start_at,e.id,w.value::integer limit 51`;
  for (const event of events.slice(0, 50)) {
    if (Date.now() > deadline) return false;
    await recordFootballPrediction({
      modelVersion: cfg.modelVersion,
      eventId: event.id,
      windowSeconds: Number(event.window_seconds),
      jobId: job.id,
      leaseToken: job.lease_token,
      idempotencyKey: `prediction:${job.id}:${event.id}:${cfg.modelVersion}:${event.window_seconds}`,
    });
  }
  return events.length <= 50;
}

/** Price lookup is reachable only through an already committed, private prediction. */
export async function evaluateFootballCandidate(
  tx: ReferenceSql,
  input: {
    marketId: string;
    strategyId: string;
    regionPolicyId: string;
    purpose: ScannerPurpose;
    selection?: string;
    predictionId?: string;
  },
) {
  if (!input.predictionId)
    return { ready: false as const, reason: "MODEL_PROBABILITY_UNAVAILABLE" };
  const retained = await readModelPredictionForComparison(
    tx,
    input.predictionId,
  );
  if (retained.status !== "READY")
    return { ready: false as const, reason: retained.reason };
  // Preview odds trial authority does not grant modelling/publication rights.
  if (providerTrialEnvironment(process.env))
    return { ready: false as const, reason: "preview_data_only_authority" };
  const [strategy] =
    await tx`select *,private.scanner_strategy_allowed(id,${input.purpose}) allowed from private.strategy_versions where id=${input.strategyId} for share`;
  if (
    !strategy?.allowed ||
    !frozenCodeMatches(strategy.code_commit, process.env)
  )
    return {
      ready: false as const,
      reason: "strategy_authority_or_code_mismatch",
    };
  const cfg = validateFootballEdgeStrategy(strategy.config);
  if (
    hash(cfg) !== strategy.config_hash ||
    cfg.modelVersion !== retained.prediction.modelVersion
  )
    return {
      ready: false as const,
      reason: "strategy_prediction_hash_mismatch",
    };
  const [policy] =
    await tx`select * from private.region_policies where id=${input.regionPolicyId} and approved and not preview_community_only and effective_from<=clock_timestamp() and least(effective_to,review_at)>clock_timestamp() for share`;
  if (
    !policy?.features.includes(
      input.purpose === "research" ? "market_data" : "tips",
    )
  )
    return { ready: false as const, reason: "region_approval_missing" };
  const [market] =
    await tx`select rules,event_id from private.markets where id=${input.marketId}`;
  if (
    !market ||
    market.event_id !== retained.prediction.eventId ||
    market.rules.market !== "football_1x2"
  )
    return {
      ready: false as const,
      reason: "canonical_football_market_missing",
    };
  const loaded = await loadMarketReference(
    tx,
    input.marketId,
    market.rules.outcomes[0],
    input.regionPolicyId,
    cfg.marketReference,
  );
  // All three comparisons share one captured source set and observation clock.
  const rules = loaded.market.rules as Rules,
    at = loaded.market.observed_at.toISOString();
  const references = rules.outcomes
    .map((selection) =>
      buildMarketReference(
        {
          rules,
          startAt: loaded.market.start_at.toISOString(),
          observedAt: at,
          selection,
          sources: loaded.sources,
        },
        cfg.marketReference,
      ),
    )
    .flatMap((r) => (r.status === "READY" ? [r.reference] : []));
  const evaluation = compareFootballPrediction(
    { prediction: retained.prediction, rules, decisionAt: at, references },
    cfg,
  );
  const candidate = evaluation.candidates[0];
  if (
    !candidate ||
    (input.selection && candidate.selection !== input.selection)
  )
    return {
      ready: false as const,
      reason:
        evaluation.rejections[0]?.reason ??
        "selected_candidate_no_longer_qualifies",
      fresh: references.length > 0,
    };
  const chosen = {
    ...loaded,
    result: {
      status: "READY" as const,
      reference: candidate.reference,
      rejections: [],
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
    model: {
      ...retained.prediction,
      predictionId: retained.prediction.id,
      independentModel: true,
    },
  };
}
