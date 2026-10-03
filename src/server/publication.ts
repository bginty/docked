import { publishReference } from "./reference-publication";
import { db } from "./db";
import {
  evaluate,
  hash,
  validateStrategy,
  type Quote,
  type Rules,
} from "@/core/pricing";
import { config } from "./config";
import { requireRole } from "./auth";
import { currentBookmakerApprovals } from "./bookmaker-approvals";
import { revalidateBookmakers } from "@/core/bookmaker-approval";
import { freshTimestamp } from "@/core/data-health";
import { frozenCodeMatches } from "@/core/code-provenance";
export async function publish(
  candidateId: string,
  evidence: "live_published" | "forward_paper" = "live_published",
) {
  const who = await requireRole(["owner", "admin", "analyst"]);
  if (
    evidence === "live_published"
      ? !config().publication
      : process.env.FORWARD_PAPER_ENABLED !== "true"
  )
    throw new Error("Publication paused");
  const sql = db();
  return sql.begin(async (tx) => {
    const cs =
      await tx`select c.*,e.start_at,e.status event_status from private.candidate_decisions c join private.events e on e.id=c.event_id where c.id=${candidateId} for update of c`;
    const c = cs[0];
    if (!c || c.status !== "review") throw new Error("Candidate unavailable");
    const versions =
      await tx`select config,config_hash,lifecycle,code_commit from private.strategy_versions where id=${c.strategy_id} for share`;
    if (!versions[0]) throw new Error("Strategy missing");
    if (!frozenCodeMatches(versions[0].code_commit, process.env))
      throw new Error(
        "Frozen strategy code does not match the deployed commit",
      );
    if (versions[0].config.method === "market-reference-independent-cohorts")
      return publishReference(tx, c, versions[0], who.user.id, evidence);
    const strategy = validateStrategy(versions[0].config);
    if (
      strategy.version !== c.strategy_id ||
      hash(strategy) !== versions[0].config_hash
    )
      throw new Error("Strategy configuration mismatch");
    if (!c.payload.offer?.rules || c.payload.offer.rules.eventId !== c.event_id)
      throw new Error("Candidate market missing");
    const markets =
      await tx`select id,rules from private.markets where event_id=${c.event_id} and rules_hash=${hash(c.payload.offer.rules)}`;
    if (markets.length !== 1) throw new Error("Candidate market ambiguous");
    const market = markets[0];
    const health =
      await tx`select healthy,last_success from private.source_health where provider='the-odds-api' for share`;
    if (!health[0]?.healthy || !freshTimestamp(health[0].last_success))
      throw new Error("Feed unavailable");
    const snapshots =
      await tx`select distinct on (bookmaker) payload from private.odds_snapshots where market_id=${market.id} and evidence in ('forward_paper','live_published') order by bookmaker,source_at desc`;
    const now = new Date().toISOString();
    const sources = revalidateBookmakers(
      snapshots.map((x) => x.payload as Quote),
      await currentBookmakerApprovals(tx),
      now,
    );
    const evaluated = evaluate(
      {
        rules: market.rules as Rules,
        startAt: c.start_at.toISOString(),
        decisionAt: now,
        quotes: sources.quotes,
      },
      strategy,
    );
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
      await tx`insert into private.tip_publications(candidate_id,event_id,strategy_id,evidence,selection,market_rules,probability,odds,minimum_odds,estimated_ev,config_hash,sources,publication_payload,approved_by,region_policy_id) values(${c.id},${c.event_id},${c.strategy_id},${evidence},${candidate.selection},${tx.json(candidate.offer.rules)},${candidate.probability},${candidate.offer.prices[candidate.selection]},${candidate.minimumOdds},${candidate.ev},${candidate.configHash},${tx.json([candidate.offer, ...candidate.references])},${tx.json({ ...candidate, codeCommit: versions[0].code_commit })},${who.user.id},${policy[0].id}) returning id`;
    await tx`update private.candidate_decisions set status='published' where id=${c.id}`;
    return result[0].id;
  });
}
