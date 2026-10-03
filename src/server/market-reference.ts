import { hash, type Quote, type Rules } from "@/core/pricing";
import {
  buildMarketReference,
  marketReferenceV1,
  validateMarketReferenceConfig,
  type MarketReferenceConfig,
  type MarketReference,
  type MarketSourceObservation,
} from "@/core/market-reference";
import type postgres from "postgres";
export type ReferenceSql = postgres.Sql | postgres.TransactionSql;
export function configuredMarketReference(): MarketReferenceConfig {
  return process.env.MARKET_REFERENCE_CONFIG_JSON
    ? validateMarketReferenceConfig(
        JSON.parse(process.env.MARKET_REFERENCE_CONFIG_JSON),
      )
    : marketReferenceV1;
}
export function referenceProjection(reference: MarketReference) {
  return {
    methodologyVersion: reference.methodologyVersion,
    configHash: reference.configHash,
    decimalPrice: reference.decimalPrice,
    sourceAt: reference.sourceAt,
    observedAt: reference.observedAt,
    sourceCount: reference.availability.sourceCount,
    validationStatus: "UNVALIDATED" as const,
  };
}
/** All provenance is resolved from private retained provider records and current legal approvals. */
export async function loadMarketReference(
  sql: ReferenceSql,
  marketId: string,
  selection: string,
  policyId: string,
  configuration = configuredMarketReference(),
) {
  const [market] =
    await sql`select m.*,e.start_at,e.status,e.source_mappings,e.competition_id,c.sport_id,clock_timestamp() observed_at from private.markets m join private.events e on e.id=m.event_id join private.competitions c on c.id=e.competition_id where m.id=${marketId} for update of m`;
  if (!market || market.status !== "scheduled")
    throw new Error("Current scheduled market required");
  const rows =
    await sql`select distinct on(q.bookmaker) q.*,v.classification,v.classification_version,v.classification_evidence,v.metadata,v.provider_event_id,v.observed_start_at,h.healthy,h.last_success,h.rights_reference,h.capabilities,
    b.operator_group,b.rights_reference ownership_evidence,b.approved book_approved,
    exists(select 1 from private.bookmaker_eligibility ab join private.region_policies ar on ar.id=ab.region_policy_id where ab.region_policy_id=${policyId} and ar.approved and ar.effective_from<=clock_timestamp() and ar.effective_to>clock_timestamp() and ar.review_at>clock_timestamp() and ab.approved and ab.bookmaker=q.bookmaker and q.bookmaker=any(ar.operators) and ab.effective_from<=clock_timestamp() and ab.effective_to>clock_timestamp()) availability_approved
    from private.odds_snapshots q left join private.community_quote_evidence v on v.snapshot_id=q.id left join private.source_health h on h.provider=q.provider
    left join lateral(select be.operator_group,be.rights_reference,be.approved from private.bookmaker_eligibility be join private.region_policies rp on rp.id=be.region_policy_id where be.bookmaker=q.bookmaker and be.approved and be.effective_from<=clock_timestamp() and be.effective_to>clock_timestamp() and rp.approved and rp.effective_from<=clock_timestamp() and rp.effective_to>clock_timestamp() and rp.review_at>clock_timestamp() and be.bookmaker=any(rp.operators) order by be.id limit 1) b on true
    where q.market_id=${marketId} and q.evidence in ('forward_paper','live_published') order by q.bookmaker,q.source_at desc,q.received_at desc,q.id desc`;
  const [clock] = await sql`select clock_timestamp() observed_at`;
  market.observed_at = clock.observed_at;
  const observedAt = market.observed_at.toISOString();
  const sources: MarketSourceObservation[] = rows.map((row) => {
    const q = row.payload as Quote;
    return {
      ...q,
      provider: row.provider,
      approved:
        !!row.book_approved &&
        q.operator === row.operator_group &&
        (!configuration.availabilityBookmakers.includes(q.bookmaker) ||
          !!row.availability_approved),
      sourceKind:
        row.metadata?.sourceType === "bookmaker" ? "bookmaker" : "exchange",
      licensed:
        !!row.rights_reference &&
        row.rights_reference === row.provenance &&
        row.capabilities?.display === true &&
        row.capabilities?.retention === true &&
        row.capabilities?.community_standard_prices === true,
      rightsReference: row.rights_reference ?? "",
      ownershipEvidence: row.ownership_evidence ?? "",
      mappingVerified:
        row.provider_event_id === market.source_mappings[row.provider] &&
        row.observed_start_at?.getTime() === market.start_at.getTime() &&
        hash(q.rules) === hash(market.rules),
      feedHealthy:
        !!row.healthy &&
        !!row.last_success &&
        row.last_success <= market.observed_at &&
        market.observed_at.getTime() - row.last_success.getTime() <= 180000,
      priceClass: row.classification ?? "UNKNOWN_REVIEW",
      classificationVersion: row.classification_version ?? "",
      classificationEvidence: row.classification_evidence ?? "",
      promotionFlags: row.metadata?.promotionFlags ?? ["unknown"],
      provenance: "current_provider",
    };
  });
  const result = buildMarketReference(
    {
      rules: market.rules as Rules,
      startAt: market.start_at.toISOString(),
      observedAt,
      selection,
      sources,
    },
    configuration,
  );
  return { market, configuration, sources, result, policyId };
}
export type LoadedMarketReference = Awaited<
  ReturnType<typeof loadMarketReference>
>;
export async function retainMarketReference(
  sql: ReferenceSql,
  loaded: LoadedMarketReference,
) {
  if (loaded.result.status !== "READY")
    throw new Error("Current market reference unavailable");
  const r = loaded.result.reference;
  const ids = [...r.availability.sourceIds, ...(r.pricing?.sourceIds ?? [])];
  const [row] =
    await sql`insert into private.market_references(market_id,selection,methodology_version,config_hash,configuration,reference,snapshot_ids,decimal_price,observed_at,region_policy_id)
    values(${loaded.market.id},${r.selection},${r.methodologyVersion},${r.configHash},${sql.json(loaded.configuration)},${sql.json(r)},${ids},${r.decimalPrice},${r.observedAt},${loaded.policyId}) returning id`;
  return row.id as string;
}
