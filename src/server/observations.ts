import { inspectReferenceTip } from "./reference-publication";
import { db } from "./db";
import { observePublication } from "@/core/observations";
import { hash, validateStrategy, type Quote } from "@/core/pricing";
import { freshTimestamp } from "@/core/data-health";
import { currentBookmakerApprovals } from "./bookmaker-approvals";
import { revalidateBookmakers } from "@/core/bookmaker-approval";
import { frozenCodeMatches } from "@/core/code-provenance";
export async function collectObservations() {
  const sql = db();
  const health =
    await sql`select healthy,last_success from private.source_health where provider='the-odds-api'`;

  const tips =
    await sql`select p.*,e.start_at,s.config strategy_config,s.code_commit strategy_code_commit,s.lifecycle,s.config_hash strategy_hash,s.active,r.approved,r.effective_from,r.effective_to,r.review_at,r.features,e.status event_status from private.tip_publications p join private.events e on e.id=p.event_id join private.strategy_versions s on s.id=p.strategy_id join private.region_policies r on r.id=p.region_policy_id where e.start_at>now()+interval '10 minutes' and p.evidence in ('live_published','forward_paper')`;
  for (const t of tips) {
    if (!frozenCodeMatches(t.strategy_code_commit, process.env)) continue;
    if (t.pricing_model === "market_reference_v1") {
      await sql.begin(async (tx) => {
        const inspected = await inspectReferenceTip(tx, t),
          o = inspected.observation;
        if (!o) return;
        const elapsed =
          (Date.parse(o.observedAt) - t.published_at.getTime()) / 1000;
        for (const minutes of [5, 15, 60])
          if (elapsed >= minutes * 60 && elapsed <= minutes * 60 + 60)
            await tx`insert into private.availability_observations(tip_id,observed_at,target_minutes,odds,qualifies,source_resolution_seconds,source_at) values(${t.id},${o.observedAt},${minutes},${o.odds},${o.qualifies},300,${o.sourceAt}) on conflict do nothing`;
        const remaining =
          (t.start_at.getTime() - Date.parse(o.observedAt)) / 1000;
        if (o.probability && remaining > 600 && remaining <= 780)
          await tx`insert into private.closing_snapshots(tip_id,probability,source_at,cutoff,rules_hash,provenance) values(${t.id},${o.probability},${o.referenceSourceAt},${new Date(t.start_at.getTime() - 600000)},${hash(t.market_rules)},${tx.json({ codeCommit: t.strategy_code_commit, method: "market-reference probability cohort T-13m to T-10m", sourceIds: o.sourceIds, observedAt: o.observedAt })}) on conflict do nothing`;
      });
      continue;
    }
    if (!health[0]?.healthy || !freshTimestamp(health[0].last_success))
      continue;
    const cfg = validateStrategy(t.strategy_config);
    if (t.config_hash !== hash(cfg)) continue;
    const snapshots =
      await sql`select distinct on (bookmaker) payload from private.odds_snapshots where market_id in (select id from private.markets where event_id=${t.event_id} and rules_hash=${hash(t.market_rules)}) and evidence in ('forward_paper','live_published') order by bookmaker,source_at desc,received_at desc`;
    const now = new Date();
    const sources = revalidateBookmakers(
      snapshots.map((s) => s.payload as Quote),
      await currentBookmakerApprovals(sql),
      now.toISOString(),
    );
    const observation = observePublication(
      {
        rules: t.market_rules,
        startAt: t.start_at.toISOString(),
        observedAt: now.toISOString(),
        publishedAt: t.published_at.toISOString(),
        selection: t.selection,
        bookmaker: t.publication_payload.offer.bookmaker,
        minimumOdds: t.minimum_odds,
        quotes: sources.quotes,
        resolutionSeconds: 300,
      },
      cfg,
    );
    if (!observation) continue;
    for (const m of observation.targets)
      await sql`insert into private.availability_observations(tip_id,observed_at,target_minutes,odds,qualifies,source_resolution_seconds,source_at) values(${t.id},${now},${m},${observation.odds},${observation.qualifies},300,${observation.sourceAt}) on conflict do nothing`;
    // Declared closing diagnostic: last safe pre-start window T-13m to T-10m, first eligible sample.
    const remaining = (t.start_at.getTime() - now.getTime()) / 1000;
    if (remaining > 600 && remaining <= 780)
      await sql`insert into private.closing_snapshots(tip_id,probability,source_at,cutoff,rules_hash,provenance) values(${t.id},${observation.probability},${observation.referenceSourceAt},${new Date(t.start_at.getTime() - 600000)},${hash(t.market_rules)},${sql.json({ codeCommit: t.strategy_code_commit, method: "first eligible observation T-13m to T-10m", sourceIds: observation.sourceIds, observedAt: now.toISOString() })}) on conflict do nothing`;
  }
}
