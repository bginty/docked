import { hash, binaryPrice, type Rules } from "@/core/pricing";
import {
  evaluateReference,
  validateReferenceStrategy,
  referenceEdgeStatus,
  type ReferenceEdgeStatus,
} from "@/core/reference-pricing";
import {
  loadMarketReference,
  retainMarketReference,
  type ReferenceSql,
} from "./market-reference";
import { frozenCodeMatches } from "@/core/code-provenance";
import { config } from "./config";
import type postgres from "postgres";
type Row = postgres.Row;

export async function publishReference(
  tx: ReferenceSql,
  c: Row,
  version: Row,
  actor: string,
  evidence: "live_published" | "forward_paper",
) {
  const strategy = validateReferenceStrategy(version.config);
  if (
    strategy.version !== c.strategy_id ||
    hash(strategy) !== version.config_hash ||
    c.payload.pricingModel !== "market_reference_v1"
  )
    throw new Error("Reference strategy linkage invalid");
  const loaded = await loadMarketReference(
    tx,
    c.payload.marketId,
    c.payload.selection,
    c.payload.regionPolicyId,
    strategy.marketReference,
  );
  const evaluated = evaluateReference(
    {
      rules: loaded.market.rules as Rules,
      startAt: loaded.market.start_at.toISOString(),
      decisionAt: loaded.market.observed_at.toISOString(),
      sources: loaded.sources,
    },
    strategy,
  );
  const candidate = evaluated.candidates[0];
  if (
    !candidate ||
    candidate.selection !== c.payload.selection ||
    loaded.result.status !== "READY"
  )
    throw new Error("Current reference no longer qualifies");
  const referenceId = await retainMarketReference(tx, loaded),
    r = candidate.reference;
  const retained = new Set([
    ...r.availability.sourceIds,
    ...(r.pricing?.sourceIds ?? []),
  ]);
  const sources = loaded.sources.filter((source) => retained.has(source.id));
  const payload = {
    ...candidate,
    pricingModel: "market_reference_v1",
    referenceConfig: strategy.marketReference,
    marketId: loaded.market.id,
    codeCommit: version.code_commit,
    // Legacy presentation fields remain a neutral display projection, never a source quote.
    offer: { bookmaker: "Market reference", sourceAt: r.sourceAt },
  };
  const [row] =
    await tx`insert into private.tip_publications(candidate_id,event_id,strategy_id,evidence,selection,market_rules,probability,odds,minimum_odds,estimated_ev,config_hash,sources,publication_payload,approved_by,region_policy_id,pricing_model,market_reference_id)
    values(${c.id},${c.event_id},${c.strategy_id},${evidence},${candidate.selection},${tx.json(loaded.market.rules)},${candidate.probability},${r.decimalPrice},${candidate.minimumOdds},${candidate.ev},${candidate.configHash},${tx.json(sources)},${tx.json(payload)},${actor},${c.payload.regionPolicyId},'market_reference_v1',${referenceId}) returning id`;
  await tx`insert into private.market_reference_movements(tip_id,market_reference_id,status) values(${row.id},${referenceId},'ACTIVE')`;
  await tx`update private.candidate_decisions set status='published' where id=${c.id}`;
  return row.id;
}

/** Serialised durable status history makes return-above-threshold explicit and non-reactivating. */
export async function inspectReferenceTip(sql: ReferenceSql, t: Row) {
  const cfg = validateReferenceStrategy(t.strategy_config);
  await sql`select id from private.tip_publications where id=${t.id} for update`;
  const [previous] =
    await sql`select m.status,r.reference from private.market_reference_movements m left join private.market_references r on r.id=m.market_reference_id where m.tip_id=${t.id} order by m.observed_at desc,m.id desc limit 1`;
  const [flag] =
    await sql`select enabled from private.feature_flags where key=${t.evidence === "forward_paper" ? "forward_paper" : "publication"}`;
  const [manual] =
    await sql`select status from private.tip_status_events where tip_id=${t.id} order by created_at desc,id desc limit 1`;
  const [settlement] =
    await sql`select result from private.settlement_events where tip_id=${t.id} order by created_at desc,id desc limit 1`;
  const now = new Date(),
    paper = t.evidence === "forward_paper";
  const enabled =
    (paper ? config().paper : config().publication) &&
    flag?.enabled &&
    t.active &&
    t.lifecycle === (paper ? "FORWARD_PAPER" : "APPROVED_FOR_LIVE") &&
    (!manual || manual.status === "active") &&
    frozenCodeMatches(t.strategy_code_commit, process.env) &&
    hash(cfg) === t.config_hash &&
    t.strategy_hash === t.config_hash &&
    t.event_status === "scheduled" &&
    t.approved &&
    t.effective_from <= now &&
    t.effective_to > now &&
    t.review_at > now &&
    t.features.includes("tips");
  const loaded = enabled
    ? await loadMarketReference(
        sql,
        t.publication_payload.marketId,
        t.selection,
        t.region_policy_id,
        cfg.marketReference,
      )
    : null;
  const reference =
    loaded?.result.status === "READY" ? loaded.result.reference : null;
  const status = referenceEdgeStatus({
    minimumEdgePrice: String(t.minimum_odds),
    currentMarketReference: reference?.decimalPrice ?? null,
    previousStatus: (previous?.status ?? "ACTIVE") as ReferenceEdgeStatus,
    now: new Date().toISOString(),
    startAt: new Date(
      t.start_at.getTime() - cfg.marketReference.cutoffSeconds * 1000,
    ).toISOString(),
    settled:
      !!settlement && ["won", "lost", "void"].includes(settlement.result),
    available: !!enabled && !!reference?.pricing,
    allowReactivation: false,
  });
  const changed =
    !reference ||
    !previous?.reference ||
    hash({
      configuration: reference.configHash,
      price: reference.decimalPrice,
      availability: reference.availability,
      pricing: reference.pricing,
    }) !==
      hash({
        configuration: previous.reference.configHash,
        price: previous.reference.decimalPrice,
        availability: previous.reference.availability,
        pricing: previous.reference.pricing,
      });
  const referenceId =
    (changed || previous?.status !== status) &&
    loaded?.result.status === "READY"
      ? await retainMarketReference(sql, loaded)
      : null;
  if (referenceId || previous?.status !== status)
    await sql`insert into private.market_reference_movements(tip_id,market_reference_id,status) values(${t.id},${referenceId},${status})`;
  const price = reference?.pricing
    ? binaryPrice(
        String(t.probability),
        reference.decimalPrice,
        cfg.minEV,
        cfg.tick,
      )
    : null;
  const candidate =
    status === "ACTIVE" && reference && price
      ? {
          ...price,
          selection: t.selection,
          reference,
          offer: {
            bookmaker: "Market reference",
            rules: t.market_rules,
            prices: { [t.selection]: reference.decimalPrice },
          },
          minimumOdds: String(t.minimum_odds),
        }
      : null;
  const observation = reference
    ? {
        odds: reference.decimalPrice,
        observedAt: reference.observedAt,
        sourceAt: reference.sourceAt,
        qualifies: status === "ACTIVE",
        probability: reference.pricing?.probability ?? null,
        referenceSourceAt: reference.sourceAt,
        sourceIds: [
          ...reference.availability.sourceIds,
          ...(reference.pricing?.sourceIds ?? []),
        ],
      }
    : null;
  return { tip: t, candidate, observation, reference, referenceStatus: status };
}
