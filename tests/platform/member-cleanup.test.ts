import { test } from "node:test";
import assert from "node:assert/strict";
import { playerScoreStatus, roundProgress } from "../../src/core/round-status";
import { saleNotice } from "../../src/core/sale-notice";
import {
  safePushEndpoint,
  pushSubscriptionSchema,
} from "../../src/core/web-push";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../fixtures/marketplace-state";
import { executeCredits } from "../../src/core/credits-sandbox";
import { memberTestView } from "../../src/core/member-test-wallet";
import { retiredProductPath } from "../../src/core/retired-product";
test("sale push worker is reachable without restoring retired internal APIs", () => {
  assert.equal(retiredProductPath("/api/notifications/sale-push-worker"), false);
  assert.equal(retiredProductPath("/api/internal/sale-push"), true);
  assert.equal(retiredProductPath("/api/internal/scanner"), true);
});
test("fixture status separates future games, missing results, review and verified outcomes", () => {
  const now = Date.now(),
    future = [{ scheduledAt: new Date(now + 3600000).toISOString() }],
    past = [{ scheduledAt: new Date(now - 3600000).toISOString() }];
  assert.equal(
    playerScoreStatus("pending-data", future, now),
    "Game not started",
  );
  assert.equal(
    playerScoreStatus("pending-data", past, now),
    "Awaiting player statistics",
  );
  assert.match(
    playerScoreStatus(
      "pending-data",
      [{ ...past[0], status: "in_progress" }],
      now,
    ),
    /scores available after/,
  );
  assert.equal(playerScoreStatus("final", past, now), "Final");
  assert.equal(playerScoreStatus("dnp", past, now), "Did not play");
  assert.equal(playerScoreStatus("bye", [], now), "Bye");
  assert.equal(
    roundProgress({
      closesAt: future[0].scheduledAt,
      finalised: false,
      fixtures: future,
      now,
    }).provisional,
    false,
  );
});
test("sale notice uses readable rarity and immutable recorded fee/net, including historic policies", () => {
  const n = saleNotice({
    price: 10000,
    fee: 750,
    net: 9250,
    cardSnapshot: {
      name: "Austin Ekeler",
      tier: "ULTRA_RARE",
      serial: 1,
      max_supply: 400,
    },
  });
  assert.equal(
    n.body,
    "Your Austin Ekeler · Ultra Rare #001/400 sold for 10,000 credits.",
  );
  assert.match(n.detail, /750 credits · You received: 9,250/);
});
test("push endpoints reject private/arbitrary targets and malformed keys", () => {
  for (const url of [
    "http://fcm.googleapis.com/test",
    "https://localhost/x",
    "https://127.0.0.1/x",
    "https://fcm.googleapis.com.evil.test/x",
    "https://evil@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
  ])
    assert.equal(safePushEndpoint(url), false);
  assert.equal(
    safePushEndpoint("https://fcm.googleapis.com/fcm/send/fixture"),
    true,
  );
  assert.equal(
    pushSubscriptionSchema.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/fixture",
      keys: { auth: "bad", p256dh: "bad" },
    }).success,
    false,
  );
});
test("wallet history reads sale receipt without changing balance or ledger", () => {
  let s = marketplaceFixture();
  const card = Object.keys(s.cards).find(
    (id) => s.commerce.cards[id].owner === marketActors[0].id,
  )!;
  for (const [actor, key, cmd] of [
    [0, "sale-cleanup", { kind: "list", card, price: 1000 }],
    [1, "quote-cleanup", { kind: "review-buy", listing: "sale-cleanup" }],
    [
      1,
      "purchase-cleanup",
      {
        kind: "buy",
        listing: "sale-cleanup",
        review: "quote-cleanup",
        expectedPrice: 1000,
        confirmed: true,
        policy: s.policy.version,
      },
    ],
  ] as const)
    s = executeCredits(s, marketActors[actor], key, cmd, Date.now()).state;
  const before = JSON.stringify(s);
  const v = memberTestView(s, marketActors[0].id, marketLabels);
  const sale = v.history.find((h) => h.id === "purchase-cleanup_sale")!;
  assert.match(sale.label, /Card sold/);
  assert.deepEqual(sale.sale, { price: 1000, fee: 50, net: 950 });
  assert.equal(sale.change, 950);
  assert.equal(JSON.stringify(s), before);
  assert.equal(
    memberTestView(s, marketActors[1].id, marketLabels).history.find(
      (h) => h.id === sale.id,
    )?.sale,
    null,
  );
});
