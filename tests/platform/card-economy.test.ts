import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialCardEconomy,
  allocateNine,
  validateCardEconomy,
  type EconomyPlayer,
} from "../../src/core/card-economy";
import { rarityConfiguration, rarityPoints } from "../../src/core/card-rarity";
import {
  initialMemberTestCredits,
  memberTestView,
  testReceipt,
} from "../../src/core/member-test-wallet";
import { executeCredits, wallet } from "../../src/core/credits-sandbox";
import {
  lockRarity,
  nflRarityRules,
  rulesets,
  validateLineup,
} from "../../src/core/scoring-v1";

const now = 1791790000000;
export const economyFixturePlayers = (at = now): EconomyPlayer[] =>
  Array.from({ length: 20 }, (_, i) => ({
    id: `fixture-player-${i}`,
    provider: "fixture",
    providerId: `nfl-${i}`,
    name: `Synthetic Player ${i}`,
    sport: "nfl",
    assetKind: "player",
    position: ["QB", "RB", "WR", "TE", "K"][i % 5],
    currentTeam: "TEST",
    status: "active",
    observedAt: at,
    sourceRevision: "synthetic-only",
    presentation: "docked-shirt-v1",
  }));
const member = { id: "qa-member", role: "member" } as const;
function funded() {
  let s = initialMemberTestCredits();
  s = executeCredits(
    s,
    { id: "qa-owner", role: "reviewer", aal: "aal2" },
    "fixture-grant",
    {
      kind: "promotion",
      member: member.id,
      amount: 100000,
      campaign: "fixture",
      reason: "Synthetic isolated test economy acceptance",
      confirmed: true,
      redeemable: false,
    },
    now,
  ).state;
  s.economy = initialCardEconomy(economyFixturePlayers(), now);
  return s;
}
test("six authoritative rarities total 7951 limited cards; Core is unlimited and free", () => {
  assert.equal(Object.keys(rarityConfiguration.rarities).length, 6);
  assert.equal(
    Object.values(rarityConfiguration.rarities).reduce(
      (n, r) => n + (r.lifetimeCap ?? 0),
      0,
    ),
    7951,
  );
  assert.equal(rarityConfiguration.rarities.CORE.lifetimeCap, null);
});
test("both packs yield nine unique non-Core cards and allow a deterministic Icon", () => {
  for (const product of ["standard-nine-test-v1", "premium-nine-test-v1"]) {
    const e = initialCardEconomy(economyFixturePlayers(), now);
    let calls = 0;
    const p = allocateNine(e, product, member.id, product, now, (max) =>
      max === 10000 && calls++ === 0 ? 9999 : 0,
    );
    assert.equal(p.cards.length, 9);
    assert.equal(e.instances[p.cards[0]].rarity, "ICON");
    assert.equal(new Set(p.cards.map((c) => e.instances[c].playerId)).size, 9);
    assert.ok(p.cards.every((c) => e.instances[c].rarity !== "CORE"));
    validateCardEconomy(e);
  }
});
test("insufficient supply is atomic and no rarity substitution occurs", () => {
  const e = initialCardEconomy(economyFixturePlayers().slice(0, 8), now),
    before = structuredClone(e);
  assert.throws(
    () =>
      allocateNine(e, "standard-nine-test-v1", member.id, "fail", now, () => 0),
    /insufficient/,
  );
  assert.deepEqual(e, before);
});
test("inactive/stale players abstain, preserve existing supply and never become retired by absence", () => {
  const e = initialCardEconomy(economyFixturePlayers(), now);
  allocateNine(e, "standard-nine-test-v1", member.id, "first", now, () => 0);
  const before = structuredClone(e.instances);
  Object.values(e.players).forEach((p) => {
    p.status = "inactive";
    p.currentTeam = "NEW";
    p.presentation = "new-art";
  });
  assert.throws(() =>
    allocateNine(e, "standard-nine-test-v1", member.id, "second", now, () => 0),
  );
  assert.deepEqual(e.instances, before);
  Object.values(e.players).forEach((p) => (p.status = "active"));
  assert.throws(() =>
    allocateNine(
      e,
      "standard-nine-test-v1",
      member.id,
      "stale",
      now + 73 * 3600000,
      () => 0,
    ),
  );
  assert.equal(e.players["fixture-player-0"].status, "active");
});
test("provider aliases cannot establish another allocation", () => {
  const ps = economyFixturePlayers();
  ps.push({ ...ps[0], id: "alias" });
  assert.throws(() => initialCardEconomy(ps, now), /Duplicate provider/);
});
test("team/artwork/season do not reset player rarity serials", () => {
  const e = initialCardEconomy(economyFixturePlayers(), now);
  const a = allocateNine(
    e,
    "standard-nine-test-v1",
    member.id,
    "one",
    now,
    () => 0,
  );
  Object.values(e.players).forEach((p) => {
    p.currentTeam = "TRADED";
    p.presentation = "season-2027";
  });
  const b = allocateNine(
    e,
    "standard-nine-test-v1",
    member.id,
    "two",
    now + 1,
    () => 0,
  );
  assert.equal(e.instances[b.cards[0]].serial, 2);
  assert.equal(e.instances[a.cards[0]].printedTeam, "TEST");
  assert.equal(e.instances[a.cards[0]].presentation, "docked-shirt-v1");
});
test("wallet retries preserve nine awards and one debit; open/replay never remints", () => {
  const s = funded(),
    command = {
      kind: "buy-pack",
      product: "standard-nine-test-v1",
      configuration: "standard-nine-test-v1",
      confirmed: true,
      policy: s.policy.version,
    };
  const first = executeCredits(s, member, "purchase", command, now);
  const retry = executeCredits(
    first.state,
    member,
    "purchase",
    command,
    now + 1,
  );
  assert.deepEqual(first, retry);
  assert.equal(wallet(retry.state, member.id).available, 99100);
  assert.equal(memberTestView(retry.state, member.id, []).cards.length, 0);
  const open = executeCredits(
    retry.state,
    member,
    "open",
    { kind: "open-pack", entitlement: "purchase" },
    now + 2,
  );
  const again = executeCredits(
    open.state,
    member,
    "reopen",
    { kind: "open-pack", entitlement: "purchase" },
    now + 3,
  );
  assert.deepEqual(
    testReceipt(open.state, "purchase", member.id),
    testReceipt(again.state, "purchase", member.id),
  );
  assert.equal(Object.keys(again.state.economy!.instances).length, 9);
  assert.equal(memberTestView(again.state, "stranger", []).cards.length, 0);
  assert.equal(wallet(again.state, member.id).withdrawable, 0);
  assert.throws(() =>
    executeCredits(
      again.state,
      { id: "stranger", role: "member" },
      "foreign",
      { kind: "open-pack", entitlement: "purchase" },
      now + 4,
    ),
  );
});
test("new products reject insufficient balance and legacy purchases; old sealed entitlements still open", () => {
  let s = initialMemberTestCredits();
  s = executeCredits(
    s,
    { id: "qa-owner", role: "reviewer", aal: "aal2" },
    "old-grant",
    {
      kind: "promotion",
      member: member.id,
      amount: 4900,
      campaign: "old",
      reason: "Synthetic legacy entitlement acceptance",
      confirmed: true,
      redeemable: false,
    },
    now,
  ).state;
  s = executeCredits(
    s,
    member,
    "old-order",
    {
      kind: "buy-pack",
      product: "premium-single-v1",
      policy: s.policy.version,
      confirmed: true,
    },
    now,
  ).state;
  s.economy = initialCardEconomy(economyFixturePlayers(), now);
  assert.throws(
    () =>
      executeCredits(
        s,
        member,
        "new-order",
        {
          kind: "buy-pack",
          product: "standard-nine-test-v1",
          configuration: "standard-nine-test-v1",
          policy: s.policy.version,
          confirmed: true,
        },
        now,
      ),
    /Insufficient/,
  );
  assert.throws(
    () =>
      executeCredits(
        s,
        member,
        "old-again",
        {
          kind: "buy-pack",
          product: "premium-single-v1",
          policy: s.policy.version,
          confirmed: true,
        },
        now,
      ),
    /retired/,
  );
  const opened = executeCredits(
    s,
    member,
    "old-open",
    { kind: "open-pack", entitlement: "old-order" },
    now,
  ).state;
  assert.equal(testReceipt(opened, "old-order", member.id).cards.length, 1);
});
test("rarity rounding applies to negative complete totals; old competition has no snapshot", () => {
  assert.equal(rarityPoints(105, 11), 116);
  assert.equal(rarityPoints(-105, 11), -116);
  assert.equal(rarityPoints(-200, 15), -300);
  const card = {
    cardId: "a",
    playerId: "a",
    position: "QB",
    rarity: "ICON" as const,
  };
  assert.deepEqual(lockRarity(rulesets.nfl, card), {});
  assert.deepEqual(lockRarity(nflRarityRules(), card), {
    rarity: "ICON",
    multiplierTenths: 15,
    rarityVersion: rarityConfiguration.version,
  });
  assert.throws(() => validateLineup(nflRarityRules(), [card]), /snapshot/);
});
