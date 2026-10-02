import { db } from "./db";
import { evaluate, type Quote, type Rules } from "@/core/pricing";
import { config } from "./config";
import { requireRole } from "./auth";
export async function publish(
  candidateId: string,
  evidence: "live_published" | "forward_paper" = "live_published",
) {
  const who = await requireRole(["owner", "admin", "analyst"]);
  if (!config().publication) throw new Error("Publication paused");
  const sql = db();
  return sql.begin(async (tx) => {
    const cs =
      await tx`select c.*,e.start_at,e.status event_status,m.rules from private.candidate_decisions c join private.events e on e.id=c.event_id join private.markets m on m.event_id=e.id where c.id=${candidateId} for update of c`;
    const c = cs[0];
    if (!c || c.status !== "review") throw new Error("Candidate unavailable");
    const health =
      await tx`select healthy,last_success from private.source_health where provider='the-odds-api' for share`;
    if (
      !health[0]?.healthy ||
      Date.now() - new Date(health[0].last_success).getTime() > 180000
    )
      throw new Error("Feed unavailable");
    const snapshots =
      await tx`select distinct on (bookmaker) payload from private.odds_snapshots where market_id in (select id from private.markets where event_id=${c.event_id}) and evidence<>'demo' order by bookmaker,source_at desc`;
    const now = new Date().toISOString();
    const evaluated = evaluate({
      rules: c.rules as Rules,
      startAt: c.start_at.toISOString(),
      decisionAt: now,
      quotes: snapshots.map((x) => x.payload as Quote),
    });
    const candidate = evaluated.candidates[0];
    if (
      !candidate ||
      candidate.selection !== c.payload.selection ||
      candidate.offer.bookmaker !== c.payload.offer.bookmaker
    )
      throw new Error("Candidate no longer qualifies");
    const policy =
      await tx`select * from private.region_policies where id=${c.payload.regionPolicyId} and approved and effective_from<=now() and effective_to>now() and review_at>now() for share`;
    if (!policy[0] || !policy[0].operators.includes(candidate.offer.bookmaker))
      throw new Error("Bookmaker/region approval missing");
    const books =
      await tx`select bookmaker from private.bookmaker_eligibility where region_policy_id=${policy[0].id} and bookmaker=${candidate.offer.bookmaker} and approved and effective_from<=now() and effective_to>now()`;
    if (!books.length) throw new Error("Bookmaker ineligible");
    const result =
      await tx`insert into private.tip_publications(candidate_id,event_id,strategy_id,evidence,selection,market_rules,probability,odds,minimum_odds,estimated_ev,config_hash,sources,publication_payload,approved_by,region_policy_id) values(${c.id},${c.event_id},${c.strategy_id},${evidence},${candidate.selection},${tx.json(candidate.offer.rules)},${candidate.probability},${candidate.offer.prices[candidate.selection]},${candidate.minimumOdds},${candidate.ev},${candidate.configHash},${tx.json([candidate.offer, ...candidate.references])},${tx.json(candidate)},${who.user.id},${policy[0].id}) returning id`;
    await tx`update private.candidate_decisions set status='published' where id=${c.id}`;
    return result[0].id;
  });
}
