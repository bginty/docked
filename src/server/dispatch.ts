import { inspectReferenceTip } from "./reference-publication";
import { db } from "./db";
import { evaluate, hash, validateStrategy, type Quote } from "@/core/pricing";
import Decimal from "decimal.js";
import { observePublication } from "@/core/observations";
import { freshTimestamp } from "@/core/data-health";
import { config } from "./config";
import { currentBookmakerApprovals } from "./bookmaker-approvals";
import { revalidateBookmakers } from "@/core/bookmaker-approval";
import { frozenCodeMatches } from "@/core/code-provenance";
export async function inspectTip(tipId: string) {
  const sql = db();
  const rows =
    await sql`select p.*,e.start_at,e.status event_status,s.config strategy_config,s.code_commit strategy_code_commit,s.lifecycle,s.config_hash strategy_hash,s.active,s.paper_approved_at,s.owner_approved_at,r.country,r.state,r.approved,r.effective_from,r.effective_to,r.review_at,r.operators,r.features from private.tip_publications p join private.events e on e.id=p.event_id join private.strategy_versions s on s.id=p.strategy_id join private.region_policies r on r.id=p.region_policy_id where p.id=${tipId}`;
  const t = rows[0];
  if (!t || t.evidence !== "live_published") return null;
  if (
    ["market_reference_v1", "football_independent_v1"].includes(t.pricing_model)
  )
    return sql.begin((tx) => inspectReferenceTip(tx, t));
  const unavailable = {
    tip: t,
    candidate: null,
    observation: null,
    reference: null,
    referenceStatus: null,
  };
  if (!frozenCodeMatches(t.strategy_code_commit, process.env))
    return unavailable;
  const cfg = validateStrategy(t.strategy_config);
  const now = new Date();
  if (
    !config().publication ||
    !t.active ||
    t.lifecycle !== "APPROVED_FOR_LIVE" ||
    !t.paper_approved_at ||
    !t.owner_approved_at ||
    t.strategy_hash !== hash(cfg) ||
    t.config_hash !== hash(cfg) ||
    t.event_status !== "scheduled" ||
    !t.approved ||
    t.effective_from > now ||
    t.effective_to <= now ||
    t.review_at <= now ||
    !t.features.includes("tips") ||
    !t.operators.includes(t.publication_payload.offer.bookmaker)
  )
    return unavailable;
  const [status, health, flags, snapshots, books] = await Promise.all([
    sql`select status from private.tip_status_events where tip_id=${tipId} order by created_at desc,id desc limit 1`,
    sql`select healthy,last_success from private.source_health where provider='the-odds-api'`,
    sql`select enabled from private.feature_flags where key='publication'`,
    sql`select distinct on (bookmaker) payload from private.odds_snapshots where market_id in (select id from private.markets where event_id=${t.event_id} and rules_hash=${hash(t.market_rules)}) and evidence in ('forward_paper','live_published') order by bookmaker,source_at desc,received_at desc`,
    sql`select bookmaker from private.bookmaker_eligibility where region_policy_id=${t.region_policy_id} and approved and effective_from<=now() and effective_to>now()`,
  ]);
  if (
    (status[0] && status[0].status !== "active") ||
    !health[0]?.healthy ||
    !freshTimestamp(health[0].last_success) ||
    !flags[0]?.enabled ||
    !books.some((b) => b.bookmaker === t.publication_payload.offer.bookmaker)
  )
    return unavailable;
  const sources = revalidateBookmakers(
    snapshots.map((s) => s.payload as Quote),
    await currentBookmakerApprovals(sql),
    now.toISOString(),
  );
  const quotes = sources.quotes,
    delta = (t.start_at.getTime() - now.getTime()) / 1000;
  const assessment = evaluate(
    {
      rules: t.market_rules,
      startAt: t.start_at.toISOString(),
      decisionAt: now.toISOString(),
      quotes,
    },
    { ...cfg, windowsSeconds: [delta], windowToleranceSeconds: 0 },
  );
  const candidate =
    assessment.eligibleCandidates.find(
      (c) =>
        c.selection === t.selection &&
        c.offer.bookmaker === t.publication_payload.offer.bookmaker &&
        new Decimal(c.offer.prices[c.selection]).gte(t.minimum_odds),
    ) ?? null;
  const observation = observePublication(
    {
      rules: t.market_rules,
      startAt: t.start_at.toISOString(),
      observedAt: now.toISOString(),
      publishedAt: t.published_at.toISOString(),
      selection: t.selection,
      bookmaker: t.publication_payload.offer.bookmaker,
      minimumOdds: t.minimum_odds,
      quotes,
      resolutionSeconds: 300,
    },
    cfg,
  );
  return {
    tip: t,
    candidate,
    observation,
    reference: null,
    referenceStatus: null,
  };
}
export async function currentTip(tipId: string) {
  const inspection = await inspectTip(tipId);
  return inspection?.candidate
    ? { tip: inspection.tip, candidate: inspection.candidate }
    : null;
}
export async function expandPublication(
  outboxId: string,
  tipId: string,
  leaseToken: string,
) {
  const current = await currentTip(tipId),
    sql = db();
  if (!current) {
    await sql`update private.outbox set state='suppressed',last_error='Publication no longer qualifies' where id=${outboxId} and lease_token=${leaseToken}`;
    return;
  }
  const t = current.tip;
  const sport =
    t.market_rules.market === "football_1x2" ? "football" : "basketball";
  await sql.begin(async (tx) => {
    const leased =
      await tx`select id from private.outbox where id=${outboxId} and state='leased' and lease_token=${leaseToken} and lease_until>now() and expires_at>now() for update`;
    if (!leased.length) return;
    const members =
      await tx`select p.id from public.profiles p join public.notification_preferences n on n.user_id=p.id where p.disabled_at is null and p.age_attested and p.country=${t.country} and p.state=${t.state} and n.edge_alerts and not n.paused and (cardinality(p.sports)=0 or ${sport}=any(p.sports)) and (cardinality(p.leagues)=0 or ${t.market_rules.competition}=any(p.leagues)) and (${["market_reference_v1", "football_independent_v1"].includes(t.pricing_model)} or cardinality(p.bookmakers)=0 or ${t.publication_payload.offer.bookmaker}=any(p.bookmakers))`;
    for (const m of members)
      await tx`insert into private.outbox(dedupe_key,kind,user_id,payload,expires_at) values(${`edge:${tipId}:${m.id}`},'edge',${m.id},${tx.json({ tipId, editorialApproval: t.approved_by, subject: "Docked: qualifying price observation", text: `${t.selection}. Publication odds ${t.odds}; minimum ${t.minimum_odds}. Check current status before considering any action. Estimated values are uncertain. No guaranteed returns.` })},least(now()+interval '3 minutes',${t.start_at}::timestamptz-interval '10 minutes')) on conflict do nothing`;
    await tx`update private.outbox set state='sent',last_error='Recipient jobs created; no email sent by expansion' where id=${outboxId} and lease_token=${leaseToken}`;
  });
}
