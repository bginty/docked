import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allocateNine,
  drawPackRarity,
  initialCardEconomy,
  premiumUltraPackUpgrade,
  premiumUltraVersion,
  sevenPlayerPackUpgrade,
  validateProduct,
} from "../../src/core/card-economy";
import {
  initialMemberTestCredits,
  memberTestView,
  testReceipt,
} from "../../src/core/member-test-wallet";
import { executeCredits, wallet } from "../../src/core/credits-sandbox";
import { packOdds } from "../../src/core/pack-odds";
const now = 1792000000000;
const member = { id: "premium-local-qa", role: "member" } as const;
function economy() {
  const e = initialCardEconomy(
    Array.from({ length: 18 }, (_, i) => ({
      id: `qa-${i}`,
      provider: "synthetic",
      providerId: String(i),
      name: `QA ${i}`,
      sport: "nfl",
      assetKind: "player",
      position: ["QB", "RB", "WR", "TE"][i % 4],
      currentTeam: "TEST",
      status: "active",
      observedAt: now,
      sourceRevision: "local",
      presentation: "docked",
    })),
    now,
  );
  sevenPlayerPackUpgrade(e, now);
  return e;
}
function funded() {
  let s = initialMemberTestCredits();
  s.economy = economy();
  s = executeCredits(
    s,
    { id: "operator", role: "reviewer", aal: "aal2" },
    "qa-fund",
    {
      kind: "promotion",
      member: member.id,
      amount: 10000,
      campaign: "local-only",
      reason: "Isolated Premium configuration test",
      confirmed: true,
      redeemable: false,
    },
    now,
  ).state;
  return s;
}
function buy(
  s: ReturnType<typeof funded>,
  id: string,
  version = premiumUltraVersion,
) {
  return executeCredits(
    s,
    member,
    id,
    {
      kind: "buy-pack",
      product: version,
      configuration: version,
      confirmed: true,
      policy: s.policy.version,
    },
    now + 1,
  );
}
test("all 10000 Premium boundaries in each of nine slots exclude lower rarities; Standard is byte-for-byte unchanged", () => {
  const e = economy(),
    old = structuredClone(e.products);
  const p = premiumUltraPackUpgrade(e, now);
  assert.deepEqual(p.weights, {
    RARE: 0,
    ELITE: 0,
    ULTRA_RARE: 9000,
    LEGENDARY: 990,
    ICON: 10,
  });
  for (let slot = 0; slot < 9; slot++) {
    const counts: Record<string, number> = {};
    for (let n = 0; n < 10000; n++) {
      const r = drawPackRarity(p, slot, () => n);
      assert.equal(
        r,
        n < 9000 ? "ULTRA_RARE" : n < 9990 ? "LEGENDARY" : "ICON",
      );
      counts[r] = (counts[r] ?? 0) + 1;
    }
    assert.deepEqual(counts, { ULTRA_RARE: 9000, LEGENDARY: 990, ICON: 10 });
  }
  for (const [id, product] of Object.entries(old))
    assert.deepEqual(e.products[id], product);
  const {
    id: _id,
    version: _v,
    weights: _w,
    effectiveAt: _at,
    ...preserved
  } = p;
  const {
    id: _oi,
    version: _ov,
    weights: _ow,
    effectiveAt: _ot,
    ...prior
  } = old["premium-nine-seven-test-v2"];
  assert.deepEqual(preserved, prior);
  const snapshot = structuredClone(e);
  premiumUltraPackUpgrade(e, now + 1);
  assert.deepEqual(e, snapshot);
  for (const weights of [
    { ...p.weights, RARE: 1, ULTRA_RARE: 8999 },
    { ...p.weights, ELITE: 1, ULTRA_RARE: 8999 },
  ])
    assert.throws(() => validateProduct({ ...p, weights }), /Premium v3/);
  assert.throws(
    () => validateProduct({ ...p, guaranteedSlots: { 0: "LEGENDARY" } }),
    /Premium v3/,
  );
});
test("nine cards, distinct players, exact serial caps, selected-rarity exhaustion rolls back all earlier draws", () => {
  const e = economy();
  premiumUltraPackUpgrade(e, now);
  // Consume every Icon across two successful packs. No random sampling evidence.
  for (let i = 0; i < 2; i++) {
    const p = allocateNine(
      e,
      premiumUltraVersion,
      member.id,
      `icons-${i}`,
      now,
      (max) => (max === 10000 ? 9990 : 0),
    );
    assert.equal(new Set(p.cards.map((c) => e.instances[c].playerId)).size, 9);
    for (const c of p.cards)
      assert.deepEqual(
        [
          e.instances[c].rarity,
          e.instances[c].serial,
          e.instances[c].lifetimeCap,
        ],
        ["ICON", 1, 1],
      );
  }
  const before = structuredClone(e);
  let rarityDraw = 0;
  assert.throws(
    () =>
      allocateNine(
        e,
        premiumUltraVersion,
        member.id,
        "exhausted",
        now,
        (max) => (max === 10000 && ++rarityDraw === 9 ? 9999 : 0),
      ),
    /insufficient eligible supply/,
  );
  assert.deepEqual(e, before); // Eight provisional Ultra Rares are also discarded.
  const p = allocateNine(
    e,
    premiumUltraVersion,
    member.id,
    "legendary",
    now,
    (max) => (max === 10000 ? 9000 : 0),
  );
  assert.equal(p.cards.length, 9);
  assert.ok(p.cards.every((c) => e.instances[c].rarity === "LEGENDARY"));
});
test("purchase/open retry settles once; old unopened Premium and replay retain purchase-time configuration", () => {
  let s = funded();
  s = buy(s, "old-premium", "premium-nine-seven-test-v2").state;
  const oldPack = structuredClone(s.economy!.packs["old-premium"]);
  premiumUltraPackUpgrade(s.economy!, now);
  assert.deepEqual(s.economy!.packs["old-premium"], oldPack);
  assert.throws(
    () => buy(s, "retired", "premium-nine-seven-test-v2"),
    /Pack unavailable/,
  );
  const bought = buy(s, "new-premium");
  assert.deepEqual(buy(bought.state, "new-premium"), bought);
  s = bought.state;
  assert.equal(wallet(s, member.id).available, 6400);
  assert.ok(
    s.economy!.packs["new-premium"].cards.every((c) =>
      ["ULTRA_RARE", "LEGENDARY", "ICON"].includes(
        s.economy!.instances[c].rarity,
      ),
    ),
  );
  for (const id of ["old-premium", "new-premium"]) {
    s = executeCredits(
      s,
      member,
      `open-${id}`,
      { kind: "open-pack", entitlement: id },
      now + 2,
    ).state;
    const receipt = testReceipt(s, id, member.id);
    s = executeCredits(
      s,
      member,
      `replay-${id}`,
      { kind: "open-pack", entitlement: id },
      now + 3,
    ).state;
    assert.deepEqual(testReceipt(s, id, member.id), receipt);
    assert.deepEqual(
      s.economy!.packs[id].cards,
      id === "old-premium"
        ? oldPack.cards
        : bought.state.economy!.packs[id].cards,
    );
  }
  assert.equal(Object.keys(s.economy!.instances).length, 18);
  assert.deepEqual(s.economy!.packs["old-premium"].product, oldPack.product);
  const view = memberTestView(s, member.id, [], false, now + 3);
  const premium = view.products.find((p) => p.id === premiumUltraVersion)!;
  assert.deepEqual(
    premium.odds,
    packOdds(s.economy!.products[premiumUltraVersion]),
  );
  assert.deepEqual(
    premium.odds!.rows.map((r) => r.percent),
    [90, 9.9, 0.1],
  );
  assert.deepEqual(premium.odds!.excluded, ["Core", "Rare", "Elite"]);
  assert.match(
    premium.odds!.guarantee!,
    /Legendary and Icon cards are not guaranteed/,
  );
});
test("insufficient funds and supply leave no charge, journal, ownership or partial pack", () => {
  const s = funded();
  premiumUltraPackUpgrade(s.economy!, now);
  Object.values(s.economy!.players)
    .slice(8)
    .forEach((p) => (p.status = "inactive"));
  const before = structuredClone(s);
  assert.throws(() => buy(s, "insufficient-supply"), /insufficient/);
  assert.deepEqual(s, before);
  const poor = initialMemberTestCredits();
  poor.economy = economy();
  premiumUltraPackUpgrade(poor.economy, now);
  const empty = structuredClone(poor);
  assert.throws(() => buy(poor, "no-funds"), /insufficient/i);
  assert.deepEqual(poor, empty);
});
