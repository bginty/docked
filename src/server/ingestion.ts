import { db } from "./db";
import { TheOddsApi, type Mapping } from "@/providers/odds-api";
import { evaluate, hash, strategyV1, type Quote } from "@/core/pricing";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
export async function ingestSport(sport: string) {
  const sql = db();
  const health =
    await sql`select * from private.source_health where provider='the-odds-api'`;
  const h = health[0];
  if (
    !h?.rights_reference ||
    !h.capabilities?.display ||
    (h.circuit_until && new Date(h.circuit_until) > new Date())
  )
    throw new Error("Provider rights/circuit gate closed");
  const events =
    await sql`select e.id,e.start_at,e.source_mappings,m.rules from private.events e join private.markets m on m.event_id=e.id where e.competition_id=${sport} and e.start_at>now() and e.status='scheduled'`;
  const books =
    await sql`select bookmaker,operator_group from private.bookmaker_eligibility where approved and effective_from<=now() and effective_to>now()`;
  const mapping: Mapping = {
    bookmakers: Object.fromEntries(
      books.map((b) => [
        b.bookmaker,
        { operator: b.operator_group, approved: true },
      ]),
    ),
    events: Object.fromEntries(
      events
        .filter((e) => e.source_mappings["the-odds-api"])
        .map((e) => [
          e.source_mappings["the-odds-api"],
          { rules: e.rules, startAt: e.start_at.toISOString() },
        ]),
    ),
  };
  const provider = new TheOddsApi({
    key: process.env.ODDS_API_KEY ?? "",
    rights: h.rights_reference,
    remaining: Number(h.credits_remaining ?? 0),
    regions: process.env.ODDS_REGIONS ?? "au",
    mapping,
    allowPolling: process.env.ODDS_POLLING_ENABLED === "true",
  });
  try {
    const result = await provider.fetch(sport);
    let rawPath: string | null = null;
    if (h.capabilities.retention) {
      rawPath = path.join("private-data", `${hash(result.raw)}.json`);
      await mkdir("private-data", { recursive: true });
      await writeFile(rawPath, JSON.stringify(result.raw));
    }
    await sql.begin(async (tx) => {
      for (const q of result.quotes) {
        const m =
          await tx`select id from private.markets where event_id=${q.rules.eventId} and rules_hash=${hash(q.rules)}`;
        if (!m[0]) continue;
        await tx`insert into private.odds_snapshots(id,market_id,provider,bookmaker,source_at,snapshot_at,received_at,payload,raw_private_path,provenance,evidence) values(${q.id},${m[0].id},'the-odds-api',${q.bookmaker},${q.sourceAt},${q.snapshotAt},${q.receivedAt},${tx.json(q)},${rawPath},${h.rights_reference},'forward_paper') on conflict do nothing`;
      }
      await tx`update private.source_health set healthy=true,last_success=now(),credits_remaining=${result.remaining},credits_used=${result.used},failure_reason=null,circuit_until=null where provider='the-odds-api'`;
    });
  } catch {
    await sql`update private.source_health set healthy=false,last_failure=now(),failure_reason='Provider request failed or quota/rights gate closed',circuit_until=now()+interval '5 minutes' where provider='the-odds-api'`;
    throw new Error("Ingestion failed closed");
  }
}
export async function evaluateDue() {
  const sql = db();
  const strategies =
    await sql`select * from private.strategy_versions where id=${strategyV1.version} and active and frozen_at is not null and research_approved_at is not null`;
  if (!strategies[0] || strategies[0].config_hash !== hash(strategyV1)) return;
  const h =
    await sql`select healthy,last_success from private.source_health where provider='the-odds-api'`;
  if (
    !h[0]?.healthy ||
    Date.now() - new Date(h[0].last_success).getTime() > 180000
  )
    return;
  const events =
    await sql`select e.*,m.rules,m.id market_id from private.events e join private.markets m on m.event_id=e.id where e.status='scheduled' and e.start_at>now()+interval '10 minutes' and e.start_at<=now()+interval '6 hours'`;
  for (const e of events) {
    const quotes =
      await sql`select distinct on (bookmaker) payload from private.odds_snapshots where market_id=${e.market_id} and evidence<>'demo' order by bookmaker,source_at desc`;
    const decisionAt = new Date().toISOString();
    const result = evaluate({
      rules: e.rules,
      startAt: e.start_at.toISOString(),
      decisionAt,
      quotes: quotes.map((q) => q.payload as Quote),
    });
    if (result.rejections[0]?.reason === "outside_decision_window") continue;
    const window =
      result.candidates[0]?.window ??
      strategyV1.windowsSeconds.find(
        (w) =>
          Math.abs(
            (e.start_at.getTime() - Date.parse(decisionAt)) / 1000 - w,
          ) <= 120,
      ) ??
      3600;
    const policy =
      await sql`select id from private.region_policies where approved and effective_from<=now() and effective_to>now() and review_at>now() and 'tips'=any(features) order by country,state limit 1`;
    const c = result.candidates[0];
    await sql`insert into private.candidate_decisions(event_id,strategy_id,decision_at,window_seconds,payload,rejection_reasons,status) values(${e.id},${strategyV1.version},${decisionAt},${window},${sql.json(c ? { ...c, regionPolicyId: policy[0]?.id ?? null } : { universe: result.universe })},${sql.json(result.rejections)},${c && policy[0] ? "review" : "rejected"}) on conflict do nothing`;
  }
}
