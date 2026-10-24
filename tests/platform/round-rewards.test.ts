import test from "node:test";
import assert from "node:assert/strict";
import { packFixture, packMember, packNow } from "../fixtures/pack-economy";
import { approvedAustralianPrizes } from "../../src/core/approved-australian-rules";
import {
  roundRewardPlan,
  fulfillRoundReward,
  type RoundRewardContext,
} from "../../src/core/round-rewards";
import { executeCredits, wallet } from "../../src/core/credits-sandbox";
import { memberTestView } from "../../src/core/member-test-wallet";
const owner = { id: "test-owner", role: "reviewer", aal: "aal2" } as const;
test("All AFL/NRL podium rewards use the approved credit amounts, pack quantities and family", () => {
  for (const sport of ["afl", "nrl"] as const)
    for (const mode of ["SALARY_CAP", "OPEN"] as const)
      for (const place of [1, 2, 3]) {
        let state = packFixture(sport);
        const schedule = approvedAustralianPrizes(sport, mode);
        const family = mode === "OPEN" ? "PREMIUM" : "STANDARD";
        const product = Object.values(state.economy!.products).find(
          (p) => p.sport === sport && p.type === family && p.cards === 9,
        )!;
        schedule.items.forEach((p) => {
          if (p.type === "pack") p.productVersion = product.id;
        });
        const context: RoundRewardContext = {
          competition: `fixture-${mode}`,
          round: "one",
          sport,
          member: packMember.id,
          place,
          revision: 1,
          final: true,
          complete: true,
          eligible: true,
          tied: false,
          schedule: { ...schedule, active: true, tiePolicy: "hold" },
        };
        const before = wallet(state, packMember.id).spendable;
        for (const reward of roundRewardPlan(context))
          state = fulfillRoundReward(
            state,
            owner,
            context,
            reward.id,
            packNow,
          ).state;
        const credits =
          place === 3
            ? 0
            : mode === "OPEN"
              ? place === 1
                ? 100000
                : 25000
              : place === 1
                ? 25000
                : 10000;
        assert.equal(wallet(state, packMember.id).spendable - before, credits);
        assert.equal(
          Object.keys(state.entitlements).length,
          place === 1 ? 0 : 5,
        );
        assert.ok(
          Object.values(state.economy!.packs).every(
            (p) =>
              p.product.sport === sport &&
              p.product.type === family &&
              p.cards.length === 9,
          ),
        );
      }
});
test("Round rewards fail closed without activation/tie approval and final eligible results", () => {
  const c: RoundRewardContext = {
    competition: "local",
    round: "one",
    sport: "afl",
    member: packMember.id,
    place: 2,
    revision: 1,
    final: true,
    complete: true,
    eligible: true,
    tied: false,
    schedule: approvedAustralianPrizes("afl", "SALARY_CAP"),
  };
  assert.throws(() => roundRewardPlan(c), /not activated/);
  c.schedule.active = true;
  assert.throws(() => roundRewardPlan(c), /tie policy/);
  c.schedule.tiePolicy = "hold"; // Isolated policy fixture, not an owner approval.
  for (const key of ["final", "complete", "eligible"] as const)
    assert.throws(
      () => roundRewardPlan({ ...c, [key]: false }),
      /final and complete/,
    );
  assert.throws(() => roundRewardPlan({ ...c, tied: true }), /Tied/);
  assert.throws(
    () =>
      fulfillRoundReward(packFixture("afl"), packMember, c, "fake", packNow),
    /MFA/,
  );
});
test("Credit and pack reward retries preserve prior success and award correct sport without charging", () => {
  for (const sport of ["afl", "nrl"] as const) {
    let s = packFixture(sport);
    const schedule = approvedAustralianPrizes(sport, "SALARY_CAP");
    const product = Object.values(s.economy!.products).find(
      (p) => p.sport === sport && p.type === "STANDARD" && p.cards === 9,
    )!;
    // Product IDs in this isolated synthetic fixture differ from the real-roster pool.
    schedule.items.forEach((p) => {
      if (p.type === "pack") p.productVersion = product.id;
    });
    const c: RoundRewardContext = {
      competition: `local-${sport}`,
      round: "one",
      sport,
      member: packMember.id,
      place: 2,
      revision: 1,
      final: true,
      complete: true,
      eligible: true,
      tied: false,
      schedule: { ...schedule, active: true, tiePolicy: "hold" },
    };
    const plan = roundRewardPlan(c),
      original = structuredClone(s),
      before = wallet(s, packMember.id).spendable;
    assert.equal(plan.length, 6);
    s = fulfillRoundReward(s, owner, c, plan[0].id, packNow).state;
    const creditAward = structuredClone(s);
    assert.throws(
      () =>
        fulfillRoundReward(
          s,
          owner,
          { ...c, revision: 2 },
          plan[1].id,
          packNow,
        ),
      /correction/,
    );
    const paused = structuredClone(s);
    paused.economy!.enabled = false;
    assert.throws(
      () => fulfillRoundReward(paused, owner, c, plan[1].id, packNow),
      /unavailable/,
    );
    assert.deepEqual(s, creditAward);
    for (const r of plan)
      s = fulfillRoundReward(s, owner, c, r.id, packNow).state;
    assert.equal(wallet(s, packMember.id).spendable, before + 10000);
    assert.equal(Object.keys(s.entitlements).length, 5);
    const library = memberTestView(s, packMember.id, [], false, packNow);
    assert.equal(library.packs.length, 5);
    assert.ok(
      library.packs.every(
        (p) =>
          p.status === "SEALED" && p.sport === sport && p.paidCredits === 0,
      ),
    );
    assert.equal(Object.keys(s.economy!.instances).length, 45);
    assert.ok(
      Object.values(s.economy!.packs).every(
        (p) => p.product.sport === sport && !p.openedAt,
      ),
    );
    const completed = structuredClone(s);
    for (const r of plan)
      s = fulfillRoundReward(s, owner, c, r.id, packNow + 1).state;
    assert.deepEqual(s, completed);
    assert.throws(
      () =>
        fulfillRoundReward(
          s,
          owner,
          { ...c, revision: 2 },
          plan[0].id,
          packNow,
        ),
      /correction/,
    );
    const opened = executeCredits(
      s,
      packMember,
      "open-reward",
      { kind: "open-pack", entitlement: plan[1].id },
      packNow,
    );
    assert.equal(opened.state.entitlements[plan[1].id].status, "OPENED");
    assert.equal(wallet(opened.state, packMember.id).spendable, before + 10000);
    assert.deepEqual(
      original,
      packFixture(sport),
      "No mutation of supplied state",
    );
  }
});
