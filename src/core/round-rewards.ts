import { allocateNine } from "./card-economy";
import {
  executeCredits,
  validateCredits,
  type CreditsState,
} from "./credits-sandbox";
import type { Operator } from "./commerce-sandbox";
import { digest } from "./scoring-engine";
import { prizeItems, type PrizeItem } from "./prize-schedules";

/** Server-loaded, saved policy only. No member-facing endpoint accepts this object.
 * Each item commits independently through CreditsSandboxStore's locked transition;
 * deterministic item IDs allow a failed later item to resume without re-awarding.
 * No schedule or runner is activated by this module. */
export type RoundRewardContext = {
  competition: string;
  round: string;
  sport: "afl" | "nrl";
  member: string;
  place: number;
  revision: number;
  final: boolean;
  complete: boolean;
  eligible: boolean;
  tied: boolean;
  schedule: {
    version: string;
    active: boolean;
    tiePolicy: "hold" | null;
    items: PrizeItem[];
  };
};
export function roundRewardPlan(c: RoundRewardContext) {
  if (!c.schedule.active) throw Error("Prize-bearing round is not activated");
  if (!c.schedule.tiePolicy)
    throw Error("Approved tie policy required before awarding");
  if (c.schedule.tiePolicy !== "hold") throw Error("Unsupported tie policy");
  if (!c.final || !c.complete || !c.eligible)
    throw Error("Eligible final and complete results required");
  if (c.tied) throw Error("Tied results require review under the saved policy");
  if (
    !Number.isSafeInteger(c.place) ||
    c.place < 1 ||
    !Number.isSafeInteger(c.revision) ||
    c.revision < 1
  )
    throw Error("Invalid final result");
  return prizeItems.parse(c.schedule.items).flatMap((item, index) => {
    if (c.place < item.from || c.place > item.to) return [];
    if (item.type !== "credits" && item.type !== "pack")
      throw Error("Unsupported reward requires manual review");
    const count = item.type === "pack" ? item.amount : 1;
    if (count > 100) throw Error("Pack reward quantity requires manual review");
    return Array.from({ length: count }, (_, unit) => ({
      // Revision/schedule are intentionally excluded: a correction must be reviewed,
      // never turn a prior award into a new payout key.
      id: `round-reward-${digest([c.sport, c.competition, c.round, c.member, index, unit]).slice(0, 48)}`,
      item,
      unit,
    }));
  });
}
export function fulfillRoundReward(
  original: CreditsState,
  actor: Operator,
  c: RoundRewardContext,
  rewardId: string,
  now: number,
) {
  if (actor.role !== "reviewer" || actor.aal !== "aal2")
    throw Error("Owner MFA required");
  const reward = roundRewardPlan(c).find((r) => r.id === rewardId);
  if (!reward) throw Error("Reward is not in the saved schedule");
  const fingerprint = digest({ ...c, reward });
  const prior = original.roundRewards?.[reward.id];
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      throw Error("Award correction requires review");
    return {
      state: original,
      result: { reward: reward.id, reference: prior.reference },
    };
  }
  // Any prior reward for this recipient/round blocks changed finalisation snapshots.
  const previous = Object.values(original.roundRewards ?? {}).filter(
    (r) =>
      r.competition === c.competition &&
      r.round === c.round &&
      r.recipient === c.member,
  );
  if (previous.some((r) => r.contextHash !== digest(c)))
    throw Error("Award correction requires review");
  let state = structuredClone(original),
    reference = reward.id;
  if (reward.item.type === "credits") {
    state = executeCredits(
      state,
      actor,
      reward.id,
      {
        kind: "award",
        competition: c.competition,
        round: c.round,
        sport: c.sport,
        member: c.member,
        amount: reward.item.amount,
        revision: c.revision,
        final: true,
        eligible: true,
        tied: false,
        tiePolicy: "hold",
        schedule: c.schedule.version,
        approved: true,
        redeemable: false,
        reason: `Final round prize · place ${c.place} · ${c.schedule.version}`,
      },
      now,
    ).state;
    reference =
      state.awards[`${c.sport}_${c.competition}_${c.round}_${c.member}`]
        .journal;
  } else {
    const economy = state.economy,
      product =
        reward.item.productVersion &&
        economy?.products[reward.item.productVersion];
    if (
      !economy?.enabled ||
      !product ||
      product.sport !== c.sport ||
      product.cards !== 9
    )
      throw Error("Saved sport-specific reward product is unavailable");
    // Reuses ordinary allocation, supply, serial, eligibility and sport gates.
    const pack = allocateNine(economy, product.id, c.member, reward.id, now);
    for (const id of pack.cards) {
      state.commerce.cards[id] = {
        tier: economy.instances[id].rarity,
        sport: c.sport,
        owner: c.member,
        reserved: null,
      };
      state.cards[id] = {
        version: 1,
        restricted: true,
        locked: false,
        history: [{ from: null, to: c.member, reference: reward.id, at: now }],
      };
    }
    state.entitlements[reward.id] = {
      member: c.member,
      order: reward.id,
      source: `round-reward:${reward.id}`,
      status: "SEALED",
      restricted: true,
    };
    state.events.push({
      id: reward.id,
      actor: actor.id,
      kind: "round-pack-reward",
      at: now,
      command: {
        competition: c.competition,
        round: c.round,
        member: c.member,
        place: c.place,
        product: product.id,
        schedule: c.schedule.version,
      },
    });
  }
  state.roundRewards ??= {};
  state.roundRewards[reward.id] = {
    fingerprint,
    contextHash: digest(c),
    recipient: c.member,
    competition: c.competition,
    round: c.round,
    sport: c.sport,
    place: c.place,
    schedule: c.schedule.version,
    reward: reward.item,
    reference,
    status: "ISSUED",
    at: now,
  };
  validateCredits(state);
  return { state, result: { reward: reward.id, reference } };
}
