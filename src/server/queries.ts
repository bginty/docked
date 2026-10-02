import { config } from "./config";
import { db } from "./db";
import { identity } from "./auth";
import { eligible, type RegionPolicy } from "@/core/policy";
import { currentTip } from "./dispatch";
import type { Rules } from "@/core/pricing";
type PublicTip = {
  id: string;
  event_id: string;
  selection: string;
  odds: string;
  minimum_odds: string;
  probability: string;
  estimated_ev: string;
  published_at: Date;
  strategy_id: string;
  evidence: "live_published";
  market_rules: Rules;
  benchmark_stake: string;
  publication_payload: {
    fairOdds: string;
    configHash: string;
    offer: { bookmaker: string; sourceAt: string };
  };
  start_at: Date;
  competition_id: string;
  participants: string[];
  availability: string;
  result: "pending" | "won" | "lost" | "void" | "disputed";
  settled_at: Date | null;
  clv: string | null;
  delayed: { odds: string; qualifies: boolean; at: string } | null;
};
export async function regionAccess(feature = "tips", operator?: string) {
  if (!config().database || !config().auth)
    return { allowed: false, policy: null };
  const who = await identity();
  if (!who) return { allowed: false, policy: null };
  const sql = db();
  const rows =
    await sql`select * from private.region_policies where country=${who.profile.country} and state=${who.profile.state} and effective_from<=now() and effective_to>now() order by effective_from desc limit 1`;
  if (!rows[0]) return { allowed: false, policy: null };
  const r = rows[0];
  const p: RegionPolicy = {
    country: r.country,
    state: r.state,
    effectiveFrom: r.effective_from.toISOString(),
    effectiveTo: r.effective_to.toISOString(),
    reviewAt: r.review_at.toISOString(),
    approved: r.approved,
    minimumAge: r.minimum_age,
    features: r.features,
    operators: r.operators,
    evidence: r.evidence,
    version: r.version,
  };
  return {
    allowed: eligible(
      p,
      {
        country: who.profile.country,
        state: who.profile.state,
        ageAttested: who.profile.age_attested,
      },
      feature,
      new Date().toISOString(),
      operator,
    ),
    policy: r.id as string,
  };
}
export async function publicTips() {
  const region = await regionAccess("tips");
  if (!region.allowed) return [];
  const sql = db();
  const rows = await sql<
    PublicTip[]
  >`select p.id,p.event_id,p.selection,p.odds,p.minimum_odds,p.probability,p.estimated_ev,p.published_at,p.strategy_id,p.evidence,p.market_rules,p.benchmark_stake,
  jsonb_build_object('fairOdds',p.publication_payload->>'fairOdds','configHash',p.config_hash,'offer',jsonb_build_object('bookmaker',p.publication_payload->'offer'->>'bookmaker','sourceAt',p.publication_payload->'offer'->>'sourceAt')) publication_payload,e.start_at,e.competition_id,e.participants,
  coalesce((select status from private.tip_status_events where tip_id=p.id order by created_at desc limit 1),'active') availability,
  coalesce((select result from private.settlement_events where tip_id=p.id order by created_at desc limit 1),'pending') result,
  (select created_at from private.settlement_events where tip_id=p.id order by created_at desc limit 1) settled_at,
  (select p.odds*c.probability-1 from private.closing_snapshots c where c.tip_id=p.id and c.source_at<=c.cutoff and c.cutoff<e.start_at) clv,
  (select jsonb_build_object('odds',a.odds,'qualifies',a.qualifies,'at',a.observed_at) from private.availability_observations a where a.tip_id=p.id and a.target_minutes=5) delayed
  from private.tip_publications p join private.events e on e.id=p.event_id where p.evidence='live_published' and p.region_policy_id=${region.policy} order by p.published_at desc`;
  return Promise.all(
    rows.map(async (t) => ({
      ...t,
      availability:
        t.availability !== "active"
          ? t.availability
          : new Date(t.start_at).getTime() <= Date.now() + 600000
            ? "expired"
            : (await currentTip(t.id))
              ? "active"
              : "suspended",
    })),
  );
}
export async function serviceStatus() {
  const base = {
    feed: false,
    strategy: false,
    publication: false,
    database: config().database,
    reason:
      "Providers are not connected. No successful scan has been recorded.",
  };
  if (!base.database) return base;
  try {
    const sql = db();
    const [health, strategy, flags] = await Promise.all([
      sql`select healthy,last_success from private.source_health where provider='the-odds-api'`,
      sql`select id from private.strategy_versions where active and research_approved_at is not null and paper_approved_at is not null and owner_approved_at is not null`,
      sql`select enabled from private.feature_flags where key='publication'`,
    ]);
    return {
      ...base,
      feed:
        !!health[0]?.healthy &&
        Date.now() - new Date(health[0].last_success).getTime() < 180000,
      strategy: strategy.length > 0,
      publication: config().publication && !!flags[0]?.enabled,
      reason: health[0]?.healthy
        ? "Freshness is evaluated from the last successful shared ingestion. Individual quote age is checked again before publication."
        : "Source health is unavailable; no new tips can publish.",
    };
  } catch {
    return {
      ...base,
      database: false,
      reason: "Database health check failed; publication is paused.",
    };
  }
}
