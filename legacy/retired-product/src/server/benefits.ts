import "server-only";
import {
  competitionDraftSchema,
  dealDraftSchema,
  membershipSummary,
} from "@/core/membership";
import { hash } from "@/core/pricing";
import { db } from "./db";
import { requireRole } from "./auth";

export async function memberBenefits() {
  if (!process.env.DATABASE_URL) return membershipSummary();
  const sql = db();
  const rows =
    await sql`select launched_at from private.launch_record where singleton`;
  return membershipSummary(rows[0]?.launched_at?.toISOString() ?? null);
}

export async function benefitAdminOverview() {
  await requireRole(["owner", "admin", "auditor"]);
  const sql = db();
  const [competitions, deals, subscriptions, approvals] = await Promise.all([
    sql`select c.*,r.version rules_version,r.ranking_rule_version,r.config_hash from private.community_competitions c join private.competition_rules r on r.competition_id=c.id order by c.created_at desc limit 100`,
    sql`select * from private.community_deals order by created_at desc limit 100`,
    sql`select plan_id,state,count(*) count from private.member_subscriptions group by plan_id,state`,
    sql`select feature,country,state,topic,approved,valid_from,valid_to,review_at from private.commercial_approvals order by created_at desc limit 100`,
  ]);
  return { competitions, deals, subscriptions, approvals, enabled: false };
}

export async function createCompetitionDraft(input: unknown) {
  const who = await requireRole(["owner", "admin"]);
  const v = competitionDraftSchema.parse(input),
    sql = db();
  const { reason, ...rules } = v;
  const draftHash = hash(v);
  return sql.begin(async (tx) => {
    const [draft] =
      await tx`insert into private.community_competitions(title,description,country,state,starts_at,ends_at,entry_cutoff,minimum_age,membership,mechanics,actor,draft_hash,reason)
      values(${v.title},${v.description},${v.country},${v.state},${v.startsAt},${v.endsAt},${v.entryCutoff},${v.minimumAge},${v.membership},${v.mechanics},${who.user.id},${draftHash},${reason}) on conflict(actor,draft_hash) do nothing returning id`;
    if (!draft) {
      const [existing] =
        await tx`select id from private.community_competitions where actor=${who.user.id} and draft_hash=${draftHash}`;
      return { id: existing.id as string, state: "DRAFT_DISABLED" };
    }
    await tx`insert into private.competition_rules(competition_id,version,ranking_rule_version,config,config_hash,minimum_settled,minimum_active_days,entry_limit,tie_breaker,actor)
      values(${draft.id},${v.officialRulesVersion},${v.rankingRuleVersion},${tx.json(rules)},${hash(rules)},${v.minimumSettled},${v.minimumActiveDays},${v.entryLimit},${v.tieBreaker},${who.user.id})`;
    await tx`insert into private.competition_prizes(competition_id,description,value,currency,sponsor) values(${draft.id},${v.prize},${v.prizeValue},${v.currency},${v.sponsor})`;
    return { id: draft.id as string, state: "DRAFT_DISABLED" };
  });
}

export async function createDealDraft(input: unknown) {
  const who = await requireRole(["owner", "admin"]);
  const v = dealDraftSchema.parse(input),
    sql = db();
  const draftHash = hash(v);
  return sql.begin(async (tx) => {
    const [draft] =
      await tx`insert into private.community_deals(title,description,sponsor,category,country,state,membership,starts_at,ends_at,terms,disclosure,tracking_class,actor,draft_hash,reason)
      values(${v.title},${v.description},${v.sponsor},${v.category},${v.country},${v.state},${v.membership},${v.startsAt},${v.endsAt},${v.terms},${v.disclosure},${v.trackingClass},${who.user.id},${draftHash},${v.reason}) on conflict(actor,draft_hash) do nothing returning id`;
    if (draft) return { id: draft.id as string, state: "DRAFT_DISABLED" };
    const [existing] =
      await tx`select id from private.community_deals where actor=${who.user.id} and draft_hash=${draftHash}`;
    return { id: existing.id as string, state: "DRAFT_DISABLED" };
  });
}
